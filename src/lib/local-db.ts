// Device-side source of truth for memories (§28). Capture writes here first; sync mirrors to the server.
import { openDatabaseSync } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { EventKind } from '@/lib/tracker';

// failed = permanent error (e.g. no longer allowed); kept on the device, never retried.
export type SyncStatus = 'pending' | 'synced' | 'deleting' | 'failed';

export type LocalMemory = {
  id: string;
  family_id: string;
  baby_id: string;
  author_id: string | null;
  occurred_at: string;
  type: string;
  raw_text: string | null;
  photo_path: string | null; // local display-size file
  thumb_path: string | null;
  original_path: string | null; // the only original for camera captures; never deleted after sync
  display_asset_id: string | null;
  thumb_asset_id: string | null;
  status: SyncStatus;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  server_seen: number;
  story_text: string | null; // AI suggestion; raw_text is never changed by AI
  milestone_candidate: number; // 0/1 (SQLite)
  milestone_title: string | null;
  author_name: string | null;
  ai_status: string | null; // server: null (not yet), 'done', 'failed', 'skipped'
};

const db = openDatabaseSync('journal.db');

db.execSync(`
  pragma journal_mode = wal;
  create table if not exists memories (
    id text primary key,
    family_id text not null,
    baby_id text not null,
    author_id text,
    occurred_at text not null,
    type text not null,
    raw_text text,
    photo_path text,
    thumb_path text,
    original_path text,
    display_asset_id text,
    thumb_asset_id text,
    status text not null,
    attempts integer not null default 0,
    next_attempt_at integer not null default 0,
    last_error text
  );
  create index if not exists memories_baby_time on memories (baby_id, occurred_at desc);
`);

// Additive local schema changes, keyed by user_version.
const LOCAL_MIGRATIONS = [
  `alter table memories add column story_text text;
   alter table memories add column milestone_candidate integer not null default 0;
   alter table memories add column milestone_title text;`,
  `alter table memories add column author_name text;`,
  `create table tracker_events (
     id text primary key,
     family_id text not null,
     baby_id text not null,
     author_id text,
     kind text not null,
     started_at text not null,
     ended_at text,
     data text not null default '{}',
     note text,
     status text not null,
     attempts integer not null default 0,
     next_attempt_at integer not null default 0,
     last_error text
   );
   create index tracker_baby_time on tracker_events (baby_id, started_at desc);`,
  // server_seen: the server has had this row, so a missing row later means it was deleted there.
  `alter table memories add column server_seen integer not null default 0;
   alter table tracker_events add column server_seen integer not null default 0;
   update memories set server_seen = 1 where status = 'synced';
   update tracker_events set server_seen = 1 where status = 'synced';`,
  `create table milestones (
     id text primary key,
     baby_id text not null,
     memory_id text,
     title text not null,
     occurred_on text not null
   );`,
  // Uploads moved to server-measured asset rows (media-sign confirm): give items that failed under the
  // old path one more try. Anything still not allowed simply fails again and stays on the phone.
  `update memories set status = 'pending', attempts = 0, next_attempt_at = 0 where status = 'failed';
   update tracker_events set status = 'pending', attempts = 0, next_attempt_at = 0 where status = 'failed';`,
  // Append only: installed apps run the entries after their stored version.
  `alter table memories add column ai_status text;`,
];
const localVersion = db.getFirstSync<{ user_version: number }>('pragma user_version')?.user_version ?? 0;
LOCAL_MIGRATIONS.slice(localVersion).forEach((sql, i) => {
  db.execSync(sql);
  db.execSync(`pragma user_version = ${localVersion + i + 1}`);
});

// Tiny change feed so screens re-query after writes or sync.
const listeners = new Set<() => void>();
let version = 0;
function changed() {
  version++;
  listeners.forEach((l) => l());
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function listMemories(babyId: string): LocalMemory[] {
  return db.getAllSync<LocalMemory>(
    `select * from memories where baby_id = ? and status != 'deleting' order by occurred_at desc`,
    babyId,
  );
}

// Basic search (§62) over what is on this device: the parent's words, suggested stories, milestones.
export function searchMemories(babyId: string, query: string): LocalMemory[] {
  const q = `%${query.trim().replace(/[!%_]/g, (c) => '!' + c)}%`; // '!' escapes LIKE wildcards
  return db.getAllSync<LocalMemory>(
    `select * from memories where baby_id = ? and status != 'deleting'
       and (raw_text like ? escape '!' or story_text like ? escape '!' or milestone_title like ? escape '!')
     order by occurred_at desc limit 100`,
    babyId, q, q, q,
  );
}

export function getMemory(id: string): LocalMemory | null {
  return db.getFirstSync<LocalMemory>(`select * from memories where id = ?`, id);
}

type NewMemory = Pick<LocalMemory, 'id' | 'family_id' | 'baby_id' | 'author_id' | 'occurred_at' | 'type' | 'raw_text' | 'photo_path' | 'thumb_path' | 'original_path'>;

export function insertMemory(m: NewMemory) {
  db.runSync(
    `insert into memories (id, family_id, baby_id, author_id, occurred_at, type, raw_text, photo_path, thumb_path, original_path, status)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    m.id, m.family_id, m.baby_id, m.author_id, m.occurred_at, m.type, m.raw_text, m.photo_path, m.thumb_path, m.original_path,
  );
  changed();
}

export function updateText(id: string, rawText: string) {
  db.runSync(
    `update memories set raw_text = ?, status = 'pending', attempts = 0, next_attempt_at = 0 where id = ? and status != 'deleting'`,
    rawText, id,
  );
  changed();
}

// Local echo of a milestone decision; the server write happens in sync.ts.
export function clearMilestone(id: string) {
  db.runSync(`update memories set milestone_candidate = 0 where id = ?`, id);
  changed();
}

export function markDeleting(id: string) {
  db.runSync(`update memories set status = 'deleting', attempts = 0, next_attempt_at = 0 where id = ?`, id);
  changed();
}

export function removeLocal(id: string) {
  db.runSync(`delete from memories where id = ?`, id);
  changed();
}

export function queued(): LocalMemory[] {
  return db.getAllSync<LocalMemory>(`select * from memories where status in ('pending', 'deleting') order by occurred_at`);
}

export function pendingCount(): number {
  return count('pending', 'deleting');
}

// Items that can never upload (kept on the device until sign-out).
export function failedCount(): number {
  return count('failed');
}

function count(...statuses: SyncStatus[]): number {
  const marks = statuses.map(() => '?').join(', ');
  const n = (table: string) =>
    db.getFirstSync<{ n: number }>(`select count(*) as n from ${table} where status in (${marks})`, ...statuses)?.n ?? 0;
  return n('memories') + n('tracker_events');
}

export function markSynced(id: string, assets: { display?: string; thumbnail?: string }) {
  db.runSync(
    `update memories set status = 'synced', server_seen = 1, attempts = 0, next_attempt_at = 0, last_error = null,
       display_asset_id = coalesce(?, display_asset_id), thumb_asset_id = coalesce(?, thumb_asset_id)
     where id = ? and status = 'pending'`,
    assets.display ?? null, assets.thumbnail ?? null, id,
  );
  changed();
}

export function markFailed(id: string, error: string, attempts: number, nextAttemptAt: number, permanent = false) {
  db.runSync(
    `update memories set attempts = ?, next_attempt_at = ?, last_error = ?,
       status = case when ? then 'failed' else status end where id = ?`,
    attempts, nextAttemptAt, error.slice(0, 500), permanent ? 1 : 0, id,
  );
  changed();
}

export type RemoteMemory = Pick<LocalMemory, 'id' | 'family_id' | 'baby_id' | 'author_id' | 'occurred_at' | 'type' | 'raw_text' | 'display_asset_id' | 'thumb_asset_id' | 'story_text' | 'milestone_title' | 'author_name' | 'ai_status'> & { milestone_candidate: boolean };

// Server rows never overwrite local edits that haven't synced yet.
// Returns ids removed locally so the caller can delete their files.
export function mergeRemote(babyId: string, rows: RemoteMemory[], complete: boolean): string[] {
  const pruned: string[] = [];
  db.withTransactionSync(() => {
    for (const r of rows) {
      db.runSync(
        `insert into memories (id, family_id, baby_id, author_id, occurred_at, type, raw_text, display_asset_id, thumb_asset_id, story_text, milestone_candidate, milestone_title, author_name, ai_status, status, server_seen)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1)
         on conflict (id) do update set
           occurred_at = excluded.occurred_at, type = excluded.type, raw_text = excluded.raw_text,
           display_asset_id = excluded.display_asset_id, thumb_asset_id = excluded.thumb_asset_id,
           story_text = excluded.story_text, milestone_candidate = excluded.milestone_candidate, milestone_title = excluded.milestone_title,
           author_name = excluded.author_name, ai_status = excluded.ai_status
         where memories.status = 'synced'`,
        r.id, r.family_id, r.baby_id, r.author_id, r.occurred_at, r.type, r.raw_text, r.display_asset_id, r.thumb_asset_id,
        r.story_text, r.milestone_candidate ? 1 : 0, r.milestone_title, r.author_name, r.ai_status,
      );
    }
    // Deleted elsewhere (e.g. by another family member): drop our synced copy.
    if (complete) {
      const keep = new Set(rows.map((r) => r.id));
      for (const { id } of db.getAllSync<{ id: string }>(`select id from memories where baby_id = ? and status = 'synced'`, babyId)) {
        if (!keep.has(id)) {
          db.runSync(`delete from memories where id = ?`, id);
          pruned.push(id);
        }
      }
    }
  });
  changed();
  return pruned;
}

// After losing access to a family: drop what came from the server (§37). Returns memory ids
// so the caller can delete their files. Unsynced items stay and will surface as failed.
export function wipeSynced(): string[] {
  const ids = db.getAllSync<{ id: string }>(`select id from memories where status = 'synced'`).map((r) => r.id);
  db.runSync(`delete from memories where status = 'synced'`);
  db.runSync(`delete from tracker_events where status = 'synced'`);
  changed();
  return ids;
}

export function wipe() {
  db.runSync(`delete from memories`);
  db.runSync(`delete from tracker_events`);
  db.runSync(`delete from milestones`);
  changed();
}

// Re-renders whenever the local store changes. Reads are synchronous SQLite queries on small tables.
export function useLocal<T>(read: () => T): T {
  'use no memo'; // the compiler must not cache read(): its input is the database, not props
  useSyncExternalStore(subscribe, () => version);
  return read();
}

// ---------------------------------------------------------------- tracker events (M4)

export type LocalEvent = {
  id: string;
  family_id: string;
  baby_id: string;
  author_id: string | null;
  kind: EventKind;
  started_at: string;
  ended_at: string | null;
  data: string; // JSON object
  note: string | null;
  status: SyncStatus;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  server_seen: number;
};
export type NewEvent = Pick<LocalEvent, 'id' | 'family_id' | 'baby_id' | 'author_id' | 'kind' | 'started_at' | 'ended_at' | 'note'> & {
  data: Record<string, unknown>;
};

export function listEvents(babyId: string, sinceIso: string): LocalEvent[] {
  return db.getAllSync<LocalEvent>(
    `select * from tracker_events where baby_id = ? and started_at >= ? and status != 'deleting' order by started_at desc`,
    babyId, sinceIso,
  );
}

export function latestEvent(babyId: string, kind: EventKind): LocalEvent | null {
  return db.getFirstSync<LocalEvent>(
    `select * from tracker_events where baby_id = ? and kind = ? and status != 'deleting' order by started_at desc limit 1`,
    babyId, kind,
  );
}

export function insertEvent(e: NewEvent) {
  db.runSync(
    `insert into tracker_events (id, family_id, baby_id, author_id, kind, started_at, ended_at, data, note, status)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    e.id, e.family_id, e.baby_id, e.author_id, e.kind, e.started_at, e.ended_at, JSON.stringify(e.data), e.note,
  );
  changed();
}

export function endEvent(id: string, endedAt: string) {
  db.runSync(
    `update tracker_events set ended_at = ?, status = 'pending', attempts = 0, next_attempt_at = 0 where id = ? and status != 'deleting'`,
    endedAt, id,
  );
  changed();
}

export function markEventDeleting(id: string) {
  db.runSync(`update tracker_events set status = 'deleting', attempts = 0, next_attempt_at = 0 where id = ?`, id);
  changed();
}

export function removeEventLocal(id: string) {
  db.runSync(`delete from tracker_events where id = ?`, id);
  changed();
}

export function queuedEvents(): LocalEvent[] {
  return db.getAllSync<LocalEvent>(`select * from tracker_events where status in ('pending', 'deleting') order by started_at`);
}

export function markEventSynced(id: string) {
  db.runSync(`update tracker_events set status = 'synced', server_seen = 1, attempts = 0, next_attempt_at = 0, last_error = null where id = ? and status = 'pending'`, id);
  changed();
}

export function markEventFailed(id: string, error: string, attempts: number, nextAttemptAt: number, permanent = false) {
  db.runSync(
    `update tracker_events set attempts = ?, next_attempt_at = ?, last_error = ?,
       status = case when ? then 'failed' else status end where id = ?`,
    attempts, nextAttemptAt, error.slice(0, 500), permanent ? 1 : 0, id,
  );
  changed();
}

export type RemoteEvent = Pick<LocalEvent, 'id' | 'family_id' | 'baby_id' | 'author_id' | 'kind' | 'started_at' | 'ended_at' | 'note'> & {
  data: unknown;
};

// Same rules as memories: never overwrite unsynced local changes; prune only inside the pulled window.
export function mergeRemoteEvents(babyId: string, rows: RemoteEvent[], sinceIso: string) {
  db.withTransactionSync(() => {
    for (const r of rows) {
      db.runSync(
        `insert into tracker_events (id, family_id, baby_id, author_id, kind, started_at, ended_at, data, note, status, server_seen)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 1)
         on conflict (id) do update set kind = excluded.kind, started_at = excluded.started_at,
           ended_at = excluded.ended_at, data = excluded.data, note = excluded.note
         where tracker_events.status = 'synced'`,
        r.id, r.family_id, r.baby_id, r.author_id, r.kind, r.started_at, r.ended_at, JSON.stringify(r.data ?? {}), r.note,
      );
    }
    const keep = new Set(rows.map((r) => r.id));
    for (const { id } of db.getAllSync<{ id: string }>(
      `select id from tracker_events where baby_id = ? and status = 'synced' and started_at >= ?`, babyId, sinceIso,
    )) {
      if (!keep.has(id)) db.runSync(`delete from tracker_events where id = ?`, id);
    }
  });
  changed();
}

// ---------------------------------------------------------------- confirmed milestones (read-only mirror)

export type LocalMilestone = { id: string; baby_id: string; memory_id: string | null; title: string; occurred_on: string };

export function listMilestones(babyId: string): LocalMilestone[] {
  return db.getAllSync<LocalMilestone>(`select * from milestones where baby_id = ? order by occurred_on`, babyId);
}

export function replaceMilestones(babyId: string, rows: LocalMilestone[]) {
  db.withTransactionSync(() => {
    db.runSync(`delete from milestones where baby_id = ?`, babyId);
    for (const r of rows) {
      db.runSync(`insert into milestones (id, baby_id, memory_id, title, occurred_on) values (?, ?, ?, ?, ?)`, r.id, r.baby_id, r.memory_id, r.title, r.occurred_on);
    }
  });
  changed();
}
