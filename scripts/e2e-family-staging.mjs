// Two-account family flow on staging (masterplan §52): npm run e2e:family
// A = agent test account from .env (TEST_USER_EMAIL/PASSWORD, owner of a family with >=1 memory).
// Creates temporary users B (invitee) and C (unrelated); deletes them at the end. Prints no secrets.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const REF = 'stdlwvahmexetlrrzpld', URL = `https://${REF}.supabase.co`, pub = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const raw = execSync(`npx supabase projects api-keys --project-ref ${REF} -o json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const svc = JSON.parse(raw.slice(raw.indexOf('['))).find((k) => k.name === 'service_role').api_key;
const req = async (path, { method = 'GET', token, key = pub, body, prefer } = {}) => {
  const r = await fetch(URL + path, { method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json', ...(prefer && { Prefer: prefer }) }, body: body && JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const login = async (email, password) => (await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data.access_token;
const mkUser = async () => {
  const email = `e2e-${randomBytes(4).toString('hex')}@test.invalid`, password = randomBytes(12).toString('base64url');
  const u = (await req('/auth/v1/admin/users', { method: 'POST', key: svc, body: { email, password, email_confirm: true } })).data;
  return { id: u.id, token: await login(email, password) };
};
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) process.exitCode = 1; };

const A = await login(env.TEST_USER_EMAIL, env.TEST_USER_PASSWORD);
const B = await mkUser(), C = await mkUser();
try {
  const fam = (await req('/rest/v1/babies?select=family_id', { token: A })).data[0].family_id;
  const [mem] = (await req('/rest/v1/memories?select=id&order=occurred_at.desc&limit=1', { token: A })).data;

  const code = (await req('/rest/v1/rpc/create_invitation', { method: 'POST', token: A, body: { fid: fam, invite_role: 'viewer' } })).data;
  ok(typeof code === 'string' && code.length >= 32, 'owner creates a viewer invite');
  ok((await req('/rest/v1/memories?select=id', { token: B.token })).data.length === 0, 'B sees nothing before joining');
  ok((await req('/rest/v1/rpc/accept_invitation', { method: 'POST', token: B.token, body: { token: code } })).status === 200, 'B joins with the code');
  ok((await req('/rest/v1/rpc/accept_invitation', { method: 'POST', token: C.token, body: { token: code } })).status >= 400, 'code cannot be reused by C');
  await req(`/rest/v1/profiles?id=eq.${B.id}`, { method: 'PATCH', token: B.token, body: { display_name: 'Grandma' } });
  ok((await req('/rest/v1/memories?select=id', { token: B.token })).data.length > 0, 'B (viewer) sees family memories');
  const bab = (await req('/rest/v1/babies?select=id', { token: B.token })).data[0].id;
  ok((await req('/rest/v1/memories', { method: 'POST', token: B.token, body: { family_id: fam, baby_id: bab, author_id: B.id } })).status === 403, 'B (viewer) cannot create memories');
  ok((await req('/rest/v1/reactions', { method: 'POST', token: B.token, body: { memory_id: mem.id, family_id: fam } })).status === 201, 'B hearts a memory');
  ok((await req('/rest/v1/comments', { method: 'POST', token: B.token, body: { memory_id: mem.id, family_id: fam, body: 'Beautiful!' } })).status === 201, 'B comments');
  ok((await req('/rest/v1/comments?select=id', { token: A })).data.length === 1, 'A sees B\'s comment');
  ok((await req('/rest/v1/memories?select=id', { token: C.token })).data.length === 0, 'unrelated C sees no memories');
  ok((await req('/rest/v1/comments?select=id', { token: C.token })).data.length === 0, 'unrelated C sees no comments');
  const { urls } = (await req('/functions/v1/media-sign', { method: 'POST', token: C.token, body: { action: 'download', asset_ids: (await req('/rest/v1/memory_assets?select=id', { token: A })).data.map((a) => a.id) } })).data;
  ok(Object.keys(urls ?? {}).length === 0, 'unrelated C gets no media URLs');

  if (process.argv[2] === 'keep') { console.log('kept B in family for UI check'); process.exit(); }
  await req(`/rest/v1/family_members?user_id=eq.${B.id}`, { method: 'PATCH', token: A, body: { revoked_at: new Date().toISOString() } });
  ok((await req('/rest/v1/memories?select=id', { token: B.token })).data.length === 0, 'revoked B loses access');
} finally {
  if (process.argv[2] !== 'keep') {
    for (const u of [B, C]) await req(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE', key: svc });
    console.log('temporary users removed');
  }
}
process.exit();
