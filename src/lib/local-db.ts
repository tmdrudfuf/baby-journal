// Device-side source of truth for memories (§28). Capture writes here first; sync mirrors to the server.
import { openDatabaseSync } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

export type SyncStatus = 'pending' | 'synced' | 'deleting';

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

export function getMemory(id: string): LocalMemory | null {
  return db.getFirstSync<LocalMemory>(`select * from memories where id = ?`, id);
}

export function insertMemory(m: Omit<LocalMemory, 'status' | 'attempts' | 'next_attempt_at' | 'last_error' | 'display_asset_id' | 'thumb_asset_id'>) {
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

export function markDeleting(id: string) {
  db.runSync(`update memories set status = 'deleting', attempts = 0, next_attempt_at = 0 where id = ?`, id);
  changed();
}

export function removeLocal(id: string) {
  db.runSync(`delete from memories where id = ?`, id);
  changed();
}

export function queued(): LocalMemory[] {
  return db.getAllSync<LocalMemory>(`select * from memories where status != 'synced' order by occurred_at`);
}

export function pendingCount(): number {
  return db.getFirstSync<{ n: number }>(`select count(*) as n from memories where status != 'synced'`)?.n ?? 0;
}

export function markSynced(id: string, assets: { display?: string; thumbnail?: string }) {
  db.runSync(
    `update memories set status = 'synced', attempts = 0, next_attempt_at = 0, last_error = null,
       display_asset_id = coalesce(?, display_asset_id), thumb_asset_id = coalesce(?, thumb_asset_id)
     where id = ? and status = 'pending'`,
    assets.display ?? null, assets.thumbnail ?? null, id,
  );
  changed();
}

export function markFailed(id: string, error: string, attempts: number, nextAttemptAt: number) {
  db.runSync(
    `update memories set attempts = ?, next_attempt_at = ?, last_error = ? where id = ?`,
    attempts, nextAttemptAt, error.slice(0, 500), id,
  );
  changed();
}

export type RemoteMemory = Pick<LocalMemory, 'id' | 'family_id' | 'baby_id' | 'author_id' | 'occurred_at' | 'type' | 'raw_text' | 'display_asset_id' | 'thumb_asset_id'>;

// Server rows never overwrite local edits that haven't synced yet.
// Returns ids removed locally so the caller can delete their files.
export function mergeRemote(babyId: string, rows: RemoteMemory[], complete: boolean): string[] {
  const pruned: string[] = [];
  db.withTransactionSync(() => {
    for (const r of rows) {
      db.runSync(
        `insert into memories (id, family_id, baby_id, author_id, occurred_at, type, raw_text, display_asset_id, thumb_asset_id, status)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
         on conflict (id) do update set
           occurred_at = excluded.occurred_at, type = excluded.type, raw_text = excluded.raw_text,
           display_asset_id = excluded.display_asset_id, thumb_asset_id = excluded.thumb_asset_id
         where memories.status = 'synced'`,
        r.id, r.family_id, r.baby_id, r.author_id, r.occurred_at, r.type, r.raw_text, r.display_asset_id, r.thumb_asset_id,
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

export function wipe() {
  db.runSync(`delete from memories`);
  changed();
}

// Re-renders whenever the local store changes. Reads are synchronous SQLite queries on small tables.
export function useLocal<T>(read: () => T): T {
  'use no memo'; // the compiler must not cache read(): its input is the database, not props
  useSyncExternalStore(subscribe, () => version);
  return read();
}
