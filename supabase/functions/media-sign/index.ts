// Issues short-lived R2 URLs. Authorization is decided by Postgres RLS using the caller's JWT;
// R2 credentials never leave this function (§27, §36).
//
// POST { action: 'upload', memory_id, variant, ext }            -> { url, object_key, expires_in }
// POST { action: 'download', asset_id }                         -> { url, expires_in }
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { EXTENSIONS, URL_TTL_SECONDS, isUuid, uploadKey } from './keys.ts';

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

async function presign(method: 'GET' | 'PUT', key: string) {
  const url = new URL(`${bucketUrl}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(URL_TTL_SECONDS));
  const signed = await r2.sign(new Request(url, { method }), { aws: { signQuery: true } });
  return signed.url;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
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

  if (body.action === 'download') {
    if (!isUuid(body.asset_id)) return json({ error: 'invalid asset_id' }, 400);
    const { data } = await db.from('memory_assets').select('object_key').eq('id', body.asset_id).maybeSingle();
    if (!data) return json({ error: 'not found' }, 404);
    return json({ url: await presign('GET', data.object_key), expires_in: URL_TTL_SECONDS });
  }

  if (body.action === 'upload') {
    if (!isUuid(body.memory_id)) return json({ error: 'invalid memory_id' }, 400);
    const { data: allowed } = await db.rpc('can_edit_memory', { mid: body.memory_id });
    if (!allowed) return json({ error: 'forbidden' }, 403);
    // family_id comes from the database, never the client, so keys can't land in another family's namespace.
    const { data: memory } = await db.from('memories').select('family_id').eq('id', body.memory_id).single();
    let key: string;
    try {
      key = uploadKey({ ...(body as { variant: string; ext: string }), family_id: memory!.family_id, memory_id: body.memory_id });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
    // ponytail: presigned PUT cannot cap object size; enforce quotas server-side at asset-row insert (M8).
    return json({
      url: await presign('PUT', key),
      object_key: key,
      content_type: EXTENSIONS[body.ext as string],
      expires_in: URL_TTL_SECONDS,
    });
  }

  return json({ error: 'unknown action' }, 400);
});
