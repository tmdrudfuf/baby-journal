// Account deletion end to end on staging (§37, Play policy): npm run e2e:delete-account
// 1. Alone in a family: account, family, memories and R2 photos are all deleted.
// 2. Sole owner in a shared family: ownership passes to the caregiver; the family, everyone's memories
//    and photos survive; the owner's own memories stay with the author cleared.
// Temporary users are created and removed; prints no secrets.
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
const admin = (p, o = {}) => call(p, { ...o, key: svc, token: svc });
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };
const created = [];

async function user() {
  const email = `del-${randomBytes(4).toString('hex')}@test.invalid`, password = randomBytes(12).toString('base64url');
  const u = (await admin('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } })).data;
  created.push(u.id);
  const token = (await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data.access_token;
  return { id: u.id, email, password, as: (p, o = {}) => call(p, { ...o, token }) };
}

async function photoMemory(u, fid, babyId) {
  const mid = randomUUID();
  await u.as('/rest/v1/memories', { method: 'POST', body: { id: mid, family_id: fid, baby_id: babyId, author_id: u.id, raw_text: 'x' } });
  const up = (await u.as('/functions/v1/media-sign', { method: 'POST', body: { action: 'upload', memory_id: mid, variant: 'display', ext: 'jpg' } })).data;
  await fetch(up.url, { method: 'PUT', body: randomBytes(100), headers: { 'Content-Type': 'image/jpeg' } });
  const [asset] = (await u.as('/rest/v1/memory_assets', { method: 'POST', body: { memory_id: mid, family_id: fid, object_key: up.object_key, asset_type: 'photo', mime_type: 'image/jpeg', variant: 'display', bytes: 100 } })).data;
  return { mid, assetId: asset.id };
}
const signedStatus = async (u, assetId) => {
  const url = (await u.as('/functions/v1/media-sign', { method: 'POST', body: { action: 'download', asset_ids: [assetId] } })).data.urls?.[assetId];
  return url ? (await fetch(url)).status : 'no-url';
};

try {
  // 1. Alone in a family.
  const a = await user();
  const fid = (await a.as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Solo' } })).data;
  const [baby] = (await a.as('/rest/v1/babies', { method: 'POST', body: { family_id: fid, name: 'B' } })).data;
  const p = await photoMemory(a, fid, baby.id);
  const url = (await a.as('/functions/v1/media-sign', { method: 'POST', body: { action: 'download', asset_ids: [p.assetId] } })).data.urls[p.assetId];
  ok((await fetch(url)).status === 200, 'solo: photo exists before deletion');
  const del = await a.as('/functions/v1/media-sign', { method: 'POST', body: { action: 'delete_account' } });
  ok(del.status === 200 && del.data.deleted, 'solo: delete_account succeeds');
  ok((await admin(`/auth/v1/admin/users/${a.id}`)).status === 404, 'solo: auth user is gone');
  ok((await admin(`/rest/v1/families?id=eq.${fid}&select=id`)).data.length === 0, 'solo: family deleted');
  ok((await admin(`/rest/v1/memories?id=eq.${p.mid}&select=id`)).data.length === 0, 'solo: memories deleted');
  ok((await fetch(url)).status === 404, 'solo: R2 photo deleted');
  ok((await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: a.email, password: a.password } })).status >= 400, 'solo: cannot sign in any more');

  // 2. Shared family: owner + caregiver + viewer.
  const owner = await user(), carer = await user(), viewer = await user();
  const sf = (await owner.as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Shared' } })).data;
  const [sb] = (await owner.as('/rest/v1/babies', { method: 'POST', body: { family_id: sf, name: 'B' } })).data;
  for (const [u, role] of [[carer, 'caregiver'], [viewer, 'viewer']]) {
    const code = (await owner.as('/rest/v1/rpc/create_invitation', { method: 'POST', body: { fid: sf, invite_role: role } })).data;
    await u.as('/rest/v1/rpc/accept_invitation', { method: 'POST', body: { token: code } });
  }
  const ownerPhoto = await photoMemory(owner, sf, sb.id);
  const carerPhoto = await photoMemory(carer, sf, sb.id);
  ok((await owner.as('/functions/v1/media-sign', { method: 'POST', body: { action: 'delete_account' } })).data.deleted, 'shared: sole owner deletes account');
  ok((await admin(`/rest/v1/families?id=eq.${sf}&select=id`)).data.length === 1, 'shared: family survives');
  const members = (await admin(`/rest/v1/family_members?family_id=eq.${sf}&select=user_id,role`)).data;
  ok(members.find((m) => m.user_id === carer.id)?.role === 'owner', 'shared: caregiver became owner');
  ok(members.find((m) => m.user_id === viewer.id)?.role === 'viewer', 'shared: viewer unchanged');
  ok(!members.some((m) => m.user_id === owner.id), 'shared: deleted user left the family');
  const mems = (await admin(`/rest/v1/memories?family_id=eq.${sf}&select=id,author_id`)).data;
  ok(mems.length === 2, 'shared: both memories kept');
  ok(mems.find((m) => m.id === ownerPhoto.mid)?.author_id === null, "shared: deleted owner's memory kept with author cleared");
  ok((await signedStatus(carer, carerPhoto.assetId)) === 200, "shared: caregiver's photo still downloadable");
  ok((await signedStatus(carer, ownerPhoto.assetId)) === 200, "shared: deleted owner's photo still downloadable by the family");
  ok((await signedStatus(viewer, carerPhoto.assetId)) === 200, 'shared: viewer still sees photos');
} finally {
  // Families first (a family must always keep an owner), then users, then purge their photos.
  const left = (await admin(`/rest/v1/families?name=eq.Shared&select=id`)).data ?? [];
  for (const f of left) await admin(`/rest/v1/families?id=eq.${f.id}`, { method: 'DELETE' });
  for (const id of created) await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
  await admin('/functions/v1/media-sign', { method: 'POST', body: { action: 'purge' } });
}
process.exit();
