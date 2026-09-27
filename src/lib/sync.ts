// Mirrors the local store to Supabase + R2. Safe to call any time; every step is idempotent.
import { File, UploadType } from 'expo-file-system';

import { localDayKey } from '@/lib/dates';
import * as local from '@/lib/local-db';
import { deleteLocalFiles } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { isDue, retryDelayMs } from '@/lib/sync-policy';

const PULL_LIMIT = 500;

async function uploadVariant(m: local.LocalMemory, variant: 'display' | 'thumbnail', path: string) {
  // Always re-sign: signed URLs expire in minutes and must never be queued.
  const { data, error } = await supabase.functions.invoke('media-sign', {
    body: { action: 'upload', memory_id: m.id, variant, ext: 'jpg' },
  });
  if (error) throw error;
  const file = new File(path);
  const put = await file.upload(data.url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': data.content_type },
  });
  if (put.status < 200 || put.status >= 300) throw new Error(`upload failed (${put.status})`);
  // Asset row only after the object exists; duplicates from retries are ignored.
  const { error: rowError } = await supabase.from('memory_assets').upsert(
    {
      memory_id: m.id,
      family_id: m.family_id,
      object_key: data.object_key,
      asset_type: 'photo',
      mime_type: data.content_type,
      variant,
      bytes: file.size,
    },
    { onConflict: 'memory_id,variant', ignoreDuplicates: true },
  );
  if (rowError) throw rowError;
}

async function push(m: local.LocalMemory) {
  const { error } = await supabase.from('memories').upsert({
    id: m.id,
    family_id: m.family_id,
    baby_id: m.baby_id,
    author_id: m.author_id,
    occurred_at: m.occurred_at, // capture time, not sync time
    type: m.type,
    raw_text: m.raw_text,
  });
  if (error) throw error;

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
      .invoke('ai-journal', { body: { memory_id: m.id } })
      .then(({ data }) => (data?.status === 'done' ? pull(m.baby_id) : undefined))
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

async function pull(babyId: string) {
  const { data, error } = await supabase
    .from('memories')
    .select('id, family_id, baby_id, author_id, occurred_at, type, raw_text, story_text, milestone_candidate, milestone_title, memory_assets(id, variant)')
    .eq('baby_id', babyId)
    .order('occurred_at', { ascending: false })
    .limit(PULL_LIMIT);
  if (error) throw error;
  const rows = data.map(({ memory_assets, ...m }) => ({
    ...m,
    display_asset_id: memory_assets.find((a) => a.variant === 'display')?.id ?? null,
    thumb_asset_id: memory_assets.find((a) => a.variant === 'thumbnail')?.id ?? null,
  }));
  // ponytail: pulls the newest 500 only; paginate when a family has more.
  const pruned = local.mergeRemote(babyId, rows, rows.length < PULL_LIMIT);
  pruned.forEach(deleteLocalFiles);
}

let running: Promise<void> | null = null;

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
          local.markFailed(m.id, e instanceof Error ? e.message : String(e), attempts, now + retryDelayMs(attempts));
        }
      }
      if (babyId) await pull(babyId).catch(() => undefined); // offline: keep showing local data
    } finally {
      running = null;
    }
  })();
  return running;
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
  await dismissMilestone(m);
}

export async function dismissMilestone(m: local.LocalMemory) {
  const { error } = await supabase.from('memories').update({ milestone_candidate: false }).eq('id', m.id);
  if (error) throw error;
  local.clearMilestone(m.id);
}

export async function discardStory(m: local.LocalMemory) {
  const { error } = await supabase.from('memories').update({ story_text: null }).eq('id', m.id);
  if (error) throw error;
  await pull(m.baby_id);
}
