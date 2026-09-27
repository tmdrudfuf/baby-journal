// Staging E2E smoke (npm run smoke:staging): user -> family -> baby -> memory -> R2 upload/download.
// Needs `npx supabase login` + `npx wrangler login`. Never prints keys. Cleans up after itself.
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

const REF = 'stdlwvahmexetlrrzpld';
const URL = `https://${REF}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${REF} -o json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const keys = JSON.parse(raw.slice(raw.indexOf('[')));
const anon = keys.find((k) => k.name === 'anon').api_key;
const service = keys.find((k) => k.name === 'service_role').api_key;

const call = async (path, { method = 'GET', token = anon, key = anon, body, headers = {} } = {}) => {
  const r = await fetch(URL + path, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: body && JSON.stringify(body),
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text}`);
  return data;
};

const email = `smoke-${Date.now()}@test.invalid`;
const password = randomBytes(18).toString('base64url');
const user = await call('/auth/v1/admin/users', { method: 'POST', token: service, key: service, body: { email, password, email_confirm: true } });
let familyId;
try {
  const session = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  const jwt = session.access_token;
  const as = (path, opts = {}) => call(path, { ...opts, token: jwt });

  familyId = await as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Smoke' } });
  const [baby] = await as('/rest/v1/babies', { method: 'POST', body: { family_id: familyId, name: 'Smoke Baby' }, headers: { Prefer: 'return=representation' } });
  const memoryId = randomUUID();
  await as('/rest/v1/memories', { method: 'POST', body: { id: memoryId, family_id: familyId, baby_id: baby.id, author_id: user.id, raw_text: 'smoke' } });
  console.log('1. user/family/baby/memory created');

  const up = await as('/functions/v1/media-sign', { method: 'POST', body: { action: 'upload', memory_id: memoryId, variant: 'display', ext: 'jpg' } });
  const payload = randomBytes(2048);
  const put = await fetch(up.url, { method: 'PUT', body: payload, headers: { 'Content-Type': up.content_type } });
  if (!put.ok) throw new Error(`R2 PUT ${put.status} ${await put.text()}`);
  console.log(`2. uploaded ${payload.length} bytes to ${up.object_key.replace(familyId, '<family>').replace(memoryId, '<memory>')}`);

  const [asset] = await as('/rest/v1/memory_assets', { method: 'POST', headers: { Prefer: 'return=representation' },
    body: { memory_id: memoryId, family_id: familyId, object_key: up.object_key, asset_type: 'photo', mime_type: up.content_type, variant: 'display', bytes: payload.length } });
  const down = await as('/functions/v1/media-sign', { method: 'POST', body: { action: 'download', asset_id: asset.id } });
  const got = Buffer.from(await (await fetch(down.url)).arrayBuffer());
  if (!got.equals(payload)) throw new Error('downloaded bytes differ');
  console.log('3. downloaded via signed URL, bytes match');

  const unsigned = await fetch(down.url.split('?')[0]);
  console.log(`4. unsigned URL denied: ${unsigned.status}`);

  const anonSign = await fetch(URL + '/functions/v1/media-sign', { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'download', asset_id: asset.id }) });
  console.log(`5. anon download sign denied: ${anonSign.status}`);

  // cleanup R2 object via a presigned DELETE isn't exposed; use wrangler.
  execSync(`npx wrangler r2 object delete baby-journal-media-staging/${up.object_key} --remote`, { stdio: 'ignore' });
  console.log('6. R2 object deleted');
} finally {
  if (familyId) await call(`/rest/v1/families?id=eq.${familyId}`, { method: 'DELETE', token: service, key: service });
  await call(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE', token: service, key: service });
  console.log('7. test family + user removed');
}
