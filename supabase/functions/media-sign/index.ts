// Issues short-lived R2 URLs. Authorization is decided by Postgres RLS using the caller's JWT;
// R2 credentials never leave this function (§27, §36).
//
// POST { action: 'upload', memory_id, variant, ext } -> { url, object_key, content_type, expires_in }
// POST { action: 'download', asset_ids: uuid[] }     -> { urls: { [asset_id]: url }, expires_in }
// POST { action: 'purge' }                           -> { deleted }  (drains media_deletions)
// POST { action: 'delete_account' }                  -> { deleted: true }  (§37; Play account-deletion requirement)
// POST { action: 'export', tz?, part? }              -> { url, expires_in, part, parts }  (§37 data export, zip in R2 for 24 h)
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { strToU8, zipSync } from 'npm:fflate@0.8.2';

import { exportHtml, localDay, type ExportBaby } from '../_shared/export-doc.ts';

import { EXTENSIONS, MAX_BATCH, URL_TTL_SECONDS, isUuid, uploadKey } from './keys.ts';

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing env ${name}`);
  return value;
};

const r2 = new AwsClient({
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  service: 's3',
  region: 'auto',
});
const bucketUrl = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`;

async function presign(method: 'GET' | 'PUT', key: string, ttl = URL_TTL_SECONDS) {
  const url = new URL(`${bucketUrl}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(ttl));
  const signed = await r2.sign(new Request(url, { method }), { aws: { signQuery: true } });
  return signed.url;
}

// Deletes queued R2 objects. R2 returns 204 for missing objects, so retries are safe.
async function purgeQueue() {
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  let total = 0;
  for (;;) {
    const { data: queued } = await admin.from('media_deletions').select('object_key').limit(MAX_BATCH);
    if (!queued?.length) return total;
    const done: string[] = [];
    for (let i = 0; i < queued.length; i += 10) {
      await Promise.all(
        queued.slice(i, i + 10).map(async ({ object_key }) => {
          const res = await r2.fetch(`${bucketUrl}/${object_key}`, { method: 'DELETE' });
          if (res.ok) done.push(object_key);
        }),
      );
    }
    if (!done.length) return total; // R2 unavailable: leave the rest for the next purge
    await admin.from('media_deletions').delete().in('object_key', done);
    total += done.length;
  }
}

// action -> [max requests, window seconds]
const LIMITS: Record<string, [number, number]> = {
  upload: [600, 3600],
  confirm: [600, 3600],
  download: [1200, 3600],
  purge: [120, 3600],
  export: [50, 86_400], // per part
  delete_account: [5, 3600],
};

const EXPORT_TTL_SECONDS = 86_400;
const MAX_VARIANT_BYTES = 5 * 1024 * 1024; // display variants are ~0.3 MB; headroom for quota checks
// Edge functions get 256 MB and 2 s CPU: photos are split into parts; unzip all parts into one folder.
const EXPORT_PHOTOS_PER_PART = 50; // measured: 50 × 350 KB ≈ 13 s; 200 exceeded compute limits

// The gateway already verified the JWT signature; this only reads its role claim.
function jwtRole(req: Request): string | null {
  try {
    const token = req.headers.get('Authorization')?.split(' ')[1] ?? '';
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role ?? null;
  } catch {
    return null;
  }
}

// Browsers (the public account-deletion page) need CORS. Auth is a bearer token, never cookies,
// so allowing any origin does not expose anything.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Keeps work running after the response (Supabase Edge Runtime); falls back to awaiting nothing.
function background(p: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt) rt.waitUntil(p);
  else p.catch(() => undefined);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // User-scoped client: every query below runs under the caller's RLS.
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // Per-user limits (§36, §42). 429 is retryable, so the app's upload queue simply backs off.
  // The scheduled sweep (pg_cron, service role) may only purge.
  if (body.action === 'purge' && jwtRole(req) === 'service_role') return json({ deleted: await purgeQueue() });

  const limit = LIMITS[String(body.action)];
  if (limit && jwtRole(req) !== 'authenticated') return json({ error: 'unauthorized' }, 401);
  if (limit) {
    const { data: allowed } = await db.rpc('hit_rate_limit', { bucket_name: String(body.action), max_hits: limit[0], window_seconds: limit[1] });
    if (!allowed) return json({ error: 'too many requests' }, 429);
  }

  if (body.action === 'download') {
    const ids = body.asset_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BATCH || !ids.every(isUuid)) {
      return json({ error: 'invalid asset_ids' }, 400);
    }
    const { data } = await db.from('memory_assets').select('id, object_key').in('id', ids);
    const urls: Record<string, string> = {};
    for (const row of data ?? []) urls[row.id] = await presign('GET', row.object_key);
    return json({ urls, expires_in: URL_TTL_SECONDS });
  }

  if (body.action === 'upload') {
    if (!isUuid(body.memory_id)) return json({ error: 'invalid memory_id' }, 400);
    const { data: allowed } = await db.rpc('can_edit_memory', { mid: body.memory_id });
    if (!allowed) return json({ error: 'forbidden' }, 403);
    // family_id comes from the database, never the client, so keys can't land in another family's namespace.
    const { data: memory } = await db.from('memories').select('family_id').eq('id', body.memory_id).single();
    // Refuse before signing so an over-quota photo never lands in R2 without a row (the DB trigger is the backstop).
    const { data: usage } = await db.rpc('family_usage', { fid: memory!.family_id });
    const u = usage?.[0];
    if (u && u.used_bytes + MAX_VARIANT_BYTES > u.storage_bytes) return json({ error: 'storage quota exceeded' }, 403);
    let key: string;
    try {
      key = uploadKey({ ...(body as { variant: string; ext: string }), family_id: memory!.family_id, memory_id: body.memory_id });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
    // A presigned PUT cannot cap the size; `confirm` measures the stored object before it counts.
    return json({
      url: await presign('PUT', key),
      object_key: key,
      content_type: EXTENSIONS[body.ext as string],
      expires_in: URL_TTL_SECONDS,
    });
  }

  // After the PUT: the server measures the object in R2 and writes the asset row itself, so the byte
  // count used for quotas is never client-reported. Oversize objects are deleted.
  if (body.action === 'confirm') {
    if (!isUuid(body.memory_id)) return json({ error: 'invalid memory_id' }, 400);
    const { data: allowed } = await db.rpc('can_edit_memory', { mid: body.memory_id });
    if (!allowed) return json({ error: 'forbidden' }, 403);
    const { data: memory } = await db.from('memories').select('family_id').eq('id', body.memory_id).single();
    let key: string;
    try {
      key = uploadKey({ ...(body as { variant: string; ext: string }), family_id: memory!.family_id, memory_id: body.memory_id });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
    const head = await r2.fetch(`${bucketUrl}/${key}`, { method: 'HEAD' });
    if (head.status === 404) return json({ error: 'object not uploaded' }, 404);
    if (!head.ok) return json({ error: 'storage unavailable' }, 503);
    const bytes = Number(head.headers.get('content-length') ?? 'NaN');
    if (!Number.isFinite(bytes) || bytes > MAX_VARIANT_BYTES) {
      await r2.fetch(`${bucketUrl}/${key}`, { method: 'DELETE' });
      return json({ error: 'file too large' }, 413);
    }
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const { error } = await admin.from('memory_assets').upsert(
      {
        memory_id: body.memory_id, family_id: memory!.family_id, object_key: key, asset_type: 'photo',
        mime_type: EXTENSIONS[body.ext as string], variant: body.variant, bytes,
      },
      { onConflict: 'memory_id,variant', ignoreDuplicates: true },
    );
    // The quota trigger is the backstop: over quota -> remove the object so R2 never holds unaccounted data.
    if (error) {
      await r2.fetch(`${bucketUrl}/${key}`, { method: 'DELETE' });
      return json({ error: error.code === '23514' ? 'storage quota exceeded' : 'could not save' }, error.code === '23514' ? 403 : 500);
    }
    return json({ bytes });
  }

  if (body.action === 'purge') {
    // Callable by any signed-in user: it only removes objects whose rows are already gone.
    const { data: user } = await db.auth.getUser();
    if (!user.user) return json({ error: 'unauthorized' }, 401);
    return json({ deleted: await purgeQueue() });
  }

  if (body.action === 'export') {
    const { data: auth } = await db.auth.getUser();
    const me = auth.user?.id;
    if (!me) return json({ error: 'unauthorized' }, 401);
    // Everything is read with the caller's own permissions (RLS): an export can never include more
    // than the app would show them.
    const { data: babies } = await db.from('babies').select('id, name, birth_date, families(name)');
    let tz = typeof body.tz === 'string' ? body.tz : 'UTC';
    try {
      localDay(new Date().toISOString(), tz);
    } catch {
      tz = 'UTC'; // unknown timezone name
    }
    const files: Record<string, Uint8Array> = {};
    const out: ExportBaby[] = [];
    const part = Math.max(1, Math.floor(Number(body.part) || 1));
    let photoIndex = 0; // across all babies; decides which part carries each photo
    const fetches: Promise<void>[] = [];
    for (const b of babies ?? []) {
      const [mem, ms, logs] = await Promise.all([
        db.from('memories')
          .select('id, occurred_at, raw_text, story_text, author:profiles!memories_author_profile_fk(display_name), memory_assets(variant, object_key), comments(body, created_at, author:profiles!comments_author_profile_fk(display_name))')
          .eq('baby_id', b.id)
          .order('occurred_at'),
        db.from('milestones').select('title, occurred_on').eq('baby_id', b.id).order('occurred_on'),
        db.from('tracker_events').select('kind, started_at, ended_at, data').eq('baby_id', b.id).order('started_at'),
      ]);
      const memories = [];
      for (const m of mem.data ?? []) {
        const key = m.memory_assets.find((a: { variant: string }) => a.variant === 'display')?.object_key;
        let photo: string | null = null;
        if (key) {
          const path = `photos/${localDay(m.occurred_at, tz)}-${m.id.slice(0, 8)}.jpg`;
          photo = path; // every part's journal lists every photo; only this part's bytes are included
          if (Math.floor(photoIndex / EXPORT_PHOTOS_PER_PART) === part - 1) {
            fetches.push(
              r2.fetch(`${bucketUrl}/${key}`).then(async (res) => {
                if (res.ok) files[path] = new Uint8Array(await res.arrayBuffer());
              }),
            );
            if (fetches.length % 8 === 0) await Promise.all(fetches.slice(-8)); // modest parallelism
          }
          photoIndex++;
        }
        memories.push({
          id: m.id,
          occurred_at: m.occurred_at,
          raw_text: m.raw_text,
          story_text: m.story_text,
          author: (m.author as unknown as { display_name: string | null } | null)?.display_name ?? null,
          photo,
          comments: ((m.comments ?? []) as unknown as { body: string; created_at: string; author: { display_name: string | null } | null }[]).map((c) => ({
            author: c.author?.display_name ?? null,
            body: c.body,
            created_at: c.created_at,
          })),
        });
      }
      out.push({
        name: b.name,
        birth_date: b.birth_date,
        family: (b.families as unknown as { name: string } | null)?.name ?? '',
        memories,
        milestones: ms.data ?? [],
        logs: logs.data ?? [],
      });
    }
    await Promise.all(fetches);
    const parts = Math.max(1, Math.ceil(photoIndex / EXPORT_PHOTOS_PER_PART));
    if (part > parts) return json({ error: 'no such part' }, 400);
    const exportedAt = new Date().toISOString();
    files['journal.json'] = strToU8(JSON.stringify({ exported_at: exportedAt, babies: out }, null, 2));
    files['index.html'] = strToU8(exportHtml(out, localDay(exportedAt, tz), tz));
    const zip = zipSync(files, { level: 0 }); // photos are already compressed
    const key = `exports/${me}/baby-journal-${exportedAt.slice(0, 10)}-part${part}of${parts}-${crypto.randomUUID().slice(0, 8)}.zip`;
    const put = await r2.fetch(`${bucketUrl}/${key}`, { method: 'PUT', body: new Uint8Array(zip), headers: { 'Content-Type': 'application/zip' } });
    if (!put.ok) return json({ error: 'could not store export' }, 502);
    // R2 lifecycle rule deletes exports/ after one day.
    return json({ url: await presign('GET', key, EXPORT_TTL_SECONDS), expires_in: EXPORT_TTL_SECONDS, part, parts });
  }

  if (body.action === 'delete_account') {
    const { data: auth } = await db.auth.getUser();
    const me = auth.user?.id;
    if (!me) return json({ error: 'unauthorized' }, 401);
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    // Nobody else's memories are ever deleted with this account (§32, §54):
    // - family with another owner: the user just leaves;
    // - sole owner but other members: ownership passes to the highest-ranked member (earliest joined first);
    // - nobody else in the family: the family is deleted with everything in it.
    // Memories the user wrote in remaining families stay there with the author cleared.
    const { data: owned } = await admin
      .from('family_members')
      .select('family_id')
      .eq('user_id', me)
      .eq('role', 'owner')
      .is('revoked_at', null);
    for (const { family_id } of owned ?? []) {
      const { data: others } = await admin
        .from('family_members')
        .select('user_id, role')
        .eq('family_id', family_id)
        .is('revoked_at', null)
        .neq('user_id', me)
        .order('role', { ascending: false }) // enum order: owner > caregiver > contributor > viewer
        .order('created_at', { ascending: true });
      if (!others?.length) {
        const { error } = await admin.from('families').delete().eq('id', family_id);
        if (error) return json({ error: 'could not delete family' }, 500);
      } else if (others[0].role !== 'owner') {
        const { error } = await admin
          .from('family_members')
          .update({ role: 'owner' })
          .eq('family_id', family_id)
          .eq('user_id', others[0].user_id);
        if (error) return json({ error: 'could not hand over the family' }, 500);
      }
    }
    const { error } = await admin.auth.admin.deleteUser(me); // cascades profile + memberships
    if (error) return json({ error: 'could not delete account' }, 500);
    // Answer now; photos are removed in the background (the 15-minute sweep catches any leftovers).
    background(purgeQueue());
    return json({ deleted: true });
  }

  return json({ error: 'unknown action' }, 400);
});
