// Mirrors the local store to Supabase + R2. Safe to call any time; every step is idempotent.
import { File, UploadType } from 'expo-file-system';

import { track } from '@/lib/analytics';
import { localDayKey } from '@/lib/dates';
import * as local from '@/lib/local-db';
import { deleteLocalFiles } from '@/lib/media';
import { reportError } from '@/lib/monitoring';
import { supabase } from '@/lib/supabase';
import { isDue, isPermanent, PermanentError, retryDelayMs } from '@/lib/sync-policy';

const PULL_LIMIT = 500;

// media-sign errors keep their HTTP status (for retry decisions) and carry the server's reason
// (e.g. "storage quota exceeded", which the sync badge shows as storage full).
async function mediaSign<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('media-sign', { body });
  if (error) {
    const detail = await (error.context as Response | undefined)?.json?.().catch(() => null);
    if (detail?.error) error.message = detail.error;
    throw error;
  }
  return data as T;
}

async function uploadVariant(m: local.LocalMemory, variant: 'display' | 'thumbnail', path: string) {
  // Always re-sign: signed URLs expire in minutes and must never be queued.
  const data = await mediaSign<{ url: string; content_type: string }>({ action: 'upload', memory_id: m.id, variant, ext: 'jpg' });
  const put = await new File(path).upload(data.url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': data.content_type },
  });
  if (put.status < 200 || put.status >= 300) throw new Error(`upload failed (${put.status})`);
  // The server measures the stored object and records the asset; retries are idempotent.
  await mediaSign({ action: 'confirm', memory_id: m.id, variant, ext: 'jpg' });
}

// Rows the server has seen are updated, never upserted: if another family member deleted
// them meanwhile, an upsert would silently bring them back.
async function write(table: 'memories' | 'tracker_events', serverSeen: number, row: { id: string } & Record<string, unknown>) {
  if (!serverSeen) {
    const { error } = await supabase.from(table).upsert(row as never);
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.from(table).update(row as never).eq('id', row.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new PermanentError('Deleted by a family member');
}

async function push(m: local.LocalMemory) {
  await write('memories', m.server_seen, {
    id: m.id,
    family_id: m.family_id,
    baby_id: m.baby_id,
    author_id: m.author_id,
    occurred_at: m.occurred_at, // capture time, not sync time
    type: m.type,
    raw_text: m.raw_text,
  });

  if (m.photo_path && !m.display_asset_id) {
    await uploadVariant(m, 'thumbnail', m.thumb_path!);
    await uploadVariant(m, 'display', m.photo_path);
  }
  const { data: assets } = await supabase.from('memory_assets').select('id, variant').eq('memory_id', m.id);
  local.markSynced(m.id, {
    display: assets?.find((a) => a.variant === 'display')?.id,
    thumbnail: assets?.find((a) => a.variant === 'thumbnail')?.id,
  });
  // AI suggestions are optional and never block the memory (§54): fire and forget.
  if (m.raw_text) {
    supabase.functions
      .invoke('ai-journal', { body: { memory_id: m.id, tz: deviceTz() } })
      .then(({ data }) => (data?.status === 'done' ? syncNow(m.baby_id) : undefined))
      .catch(() => undefined);
  }
}

async function remove(m: local.LocalMemory) {
  const { error } = await supabase.from('memories').delete().eq('id', m.id);
  if (error) throw error;
  // Best effort: queued objects are purged by the next caller if this fails.
  await supabase.functions.invoke('media-sign', { body: { action: 'purge' } }).catch(() => undefined);
  deleteLocalFiles(m.id);
  local.removeLocal(m.id);
}

// Only called inside syncNow: a pull racing a push could prune a just-synced memory
// and delete its device-only original.
async function pull(babyId: string) {
  const { data, error } = await supabase
    .from('memories')
    .select('id, family_id, baby_id, author_id, occurred_at, type, raw_text, story_text, milestone_candidate, milestone_title, author:profiles!memories_author_profile_fk(display_name), memory_assets(id, variant)')
    .eq('baby_id', babyId)
    .order('occurred_at', { ascending: false })
    .limit(PULL_LIMIT);
  if (error) throw error;
  const rows = data.map(({ memory_assets, author, ...m }) => ({
    ...m,
    author_name: author?.display_name ?? null,
    display_asset_id: memory_assets.find((a) => a.variant === 'display')?.id ?? null,
    thumb_asset_id: memory_assets.find((a) => a.variant === 'thumbnail')?.id ?? null,
  }));
  // ponytail: pulls the newest 500 only; paginate when a family has more.
  const pruned = local.mergeRemote(babyId, rows, rows.length < PULL_LIMIT);
  pruned.forEach(deleteLocalFiles);
}

const EVENT_WINDOW_DAYS = 30;

async function pushEvent(e: local.LocalEvent) {
  if (e.status === 'deleting') {
    const { error } = await supabase.from('tracker_events').delete().eq('id', e.id);
    if (error) throw error;
    return local.removeEventLocal(e.id);
  }
  await write('tracker_events', e.server_seen, {
    id: e.id,
    family_id: e.family_id,
    baby_id: e.baby_id,
    author_id: e.author_id,
    kind: e.kind,
    started_at: e.started_at,
    ended_at: e.ended_at,
    data: JSON.parse(e.data),
    note: e.note,
  });
  local.markEventSynced(e.id);
}

// Only called inside syncNow (see pull).
async function pullEvents(babyId: string) {
  const since = new Date(Date.now() - EVENT_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('tracker_events')
    .select('id, family_id, baby_id, author_id, kind, started_at, ended_at, data, note')
    .eq('baby_id', babyId)
    .or(`started_at.gte.${since},kind.eq.growth`); // all growth measurements: they chart the whole childhood
  if (error) throw error;
  local.mergeRemoteEvents(babyId, data as local.RemoteEvent[], since);
}

// Confirmed milestones are few; mirror them all.
async function pullMilestones(babyId: string) {
  const { data, error } = await supabase.from('milestones').select('id, baby_id, memory_id, title, occurred_on').eq('baby_id', babyId);
  if (error) throw error;
  local.replaceMilestones(babyId, data);
}

let running: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function syncNow(babyId: string | undefined, { force = false } = {}): Promise<void> {
  running ??= (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const now = Date.now();
      for (const m of local.queued()) {
        if (!isDue(m.next_attempt_at, now, force)) continue;
        try {
          await (m.status === 'deleting' ? remove(m) : push(m));
        } catch (e) {
          const attempts = m.attempts + 1;
          if (isPermanent(e)) reportError(e, 'upload failed permanently');
          local.markFailed(m.id, e instanceof Error ? e.message : String(e), attempts, now + retryDelayMs(attempts), isPermanent(e));
        }
      }
      for (const e of local.queuedEvents()) {
        if (!isDue(e.next_attempt_at, now, force)) continue;
        try {
          await pushEvent(e);
        } catch (err) {
          const attempts = e.attempts + 1;
          if (isPermanent(err)) reportError(err, 'log upload failed permanently');
          local.markEventFailed(e.id, err instanceof Error ? err.message : String(err), attempts, now + retryDelayMs(attempts), isPermanent(err));
        }
      }
      if (babyId) {
        // Offline: keep showing local data.
        await pull(babyId).catch(() => undefined);
        await pullEvents(babyId).catch(() => undefined);
        await pullMilestones(babyId).catch(() => undefined);
      }
    } finally {
      running = null;
      scheduleRetry(babyId);
    }
  })();
  return running;
}

// Wake up when the earliest failed item is due, so backoff retries happen without user action.
function scheduleRetry(babyId: string | undefined) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const next = Math.min(...[...local.queued(), ...local.queuedEvents()].map((m) => m.next_attempt_at));
  if (Number.isFinite(next)) retryTimer = setTimeout(() => syncNow(babyId), Math.max(1_000, next - Date.now()));
}

// Milestone + story decisions need the server (they are family-visible). Online only for now.
// ponytail: queue these offline like memories if parents often decide without signal.
export async function confirmMilestone(m: local.LocalMemory, title: string) {
  const { error } = await supabase.from('milestones').insert({
    family_id: m.family_id,
    baby_id: m.baby_id,
    memory_id: m.id,
    title,
    occurred_on: localDayKey(new Date(m.occurred_at)),
  });
  if (error && error.code !== '23505') throw error; // already saved is fine
  track('milestone_confirmed');
  await dismissMilestone(m);
  await syncNow(m.baby_id); // refresh the local milestone mirror
}

export async function dismissMilestone(m: local.LocalMemory) {
  const { error } = await supabase.from('memories').update({ milestone_candidate: false }).eq('id', m.id);
  if (error) throw error;
  local.clearMilestone(m.id);
}

export async function editStory(m: local.LocalMemory, text: string) {
  // story_edited stops the AI from overwriting the parent's words unless they ask to regenerate.
  const { error } = await supabase.from('memories').update({ story_text: text.trim() || null, story_edited: true }).eq('id', m.id);
  if (error) throw error;
  await syncNow(m.baby_id);
}

// Returns false when AI could not help right now (off, not configured, limit, provider down).
export async function regenerateStory(m: local.LocalMemory): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('ai-journal', {
    body: { memory_id: m.id, regenerate: true, tz: deviceTz() },
  });
  if (error) throw error;
  if (data?.status !== 'done') return false;
  await syncNow(m.baby_id);
  return true;
}

const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export async function discardStory(m: local.LocalMemory) {
  const { error } = await supabase.from('memories').update({ story_text: null }).eq('id', m.id);
  if (error) throw error;
  await syncNow(m.baby_id);
}
