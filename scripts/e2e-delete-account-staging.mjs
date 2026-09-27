// Account deletion end to end on staging (§37, Play policy): npm run e2e:delete-account
// Creates a temporary user with a family, memory and R2 photo, deletes the account, verifies everything is gone.
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
const REF = 'stdlwvahmexetlrrzpld', URL = `https://${REF}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${REF} -o json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const keys = JSON.parse(raw.slice(raw.indexOf('[')));
const anon = keys.find((k) => k.name === 'anon').api_key, svc = keys.find((k) => k.name === 'service_role').api_key;
const call = async (path, { method = 'GET', token = anon, key = anon, body } = {}) => {
  const r = await fetch(URL + path, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body && JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
};
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };
const email = `del-${Date.now()}@test.invalid`, password = randomBytes(12).toString('base64url');
const u = (await call('/auth/v1/admin/users', { method: 'POST', key: svc, token: svc, body: { email, password, email_confirm: true } })).data;
const jwt = (await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data.access_token;
const as = (p, o = {}) => call(p, { ...o, token: jwt });
const fid = (await as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Del' } })).data;
const [baby] = (await as('/rest/v1/babies', { method: 'POST', body: { family_id: fid, name: 'B' } })).data;
const mid = randomUUID();
await as('/rest/v1/memories', { method: 'POST', body: { id: mid, family_id: fid, baby_id: baby.id, author_id: u.id, raw_text: 'x' } });
const up = (await as('/functions/v1/media-sign', { method: 'POST', body: { action: 'upload', memory_id: mid, variant: 'display', ext: 'jpg' } })).data;
await fetch(up.url, { method: 'PUT', body: randomBytes(100), headers: { 'Content-Type': 'image/jpeg' } });
const [asset] = (await as('/rest/v1/memory_assets', { method: 'POST', body: { memory_id: mid, family_id: fid, object_key: up.object_key, asset_type: 'photo', mime_type: 'image/jpeg', variant: 'display' } })).data;
const signed = (await as('/functions/v1/media-sign', { method: 'POST', body: { action: 'download', asset_ids: [asset.id] } })).data.urls[asset.id];
ok((await fetch(signed)).status === 200, 'photo exists before deletion');

const del = await as('/functions/v1/media-sign', { method: 'POST', body: { action: 'delete_account' } });
ok(del.status === 200 && del.data.deleted, 'delete_account succeeds');
ok((await call(`/auth/v1/admin/users/${u.id}`, { key: svc, token: svc })).status === 404, 'auth user is gone');
ok((await call(`/rest/v1/families?id=eq.${fid}&select=id`, { key: svc, token: svc })).data.length === 0, 'sole-owned family deleted');
ok((await call(`/rest/v1/memories?id=eq.${mid}&select=id`, { key: svc, token: svc })).data.length === 0, 'memories deleted');
ok((await fetch(signed)).status === 404, 'R2 photo deleted (signed URL now 404)');
ok((await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).status >= 400, 'cannot sign in any more');
process.exit();
