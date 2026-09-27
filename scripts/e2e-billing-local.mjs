// M8 acceptance on LOCAL Supabase with the mock store (no Play Console needed):
//   npx supabase functions serve --env-file supabase/functions/.env.ai-test   (BILLING_PROVIDER=mock)
//   npm run e2e:billing-local
// With BILLING_PROVIDER unset it only checks that mock tokens are refused, then exits.
import { execSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const API = status.API_URL, anon = status.ANON_KEY, svc = status.SERVICE_ROLE_KEY;

const call = async (path, { method = 'GET', token = anon, key = anon, body } = {}) => {
  const r = await fetch(API + path, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body && JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
};
const admin = (p, o = {}) => call(p, { ...o, key: svc, token: svc });
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };
const tag = (userId) => createHash('sha256').update(`babyjournal:${userId}`).digest('hex').slice(0, 64);
const nonce = () => randomBytes(4).toString('hex');

async function user() {
  const email = `bill-${nonce()}@test.invalid`, password = randomBytes(12).toString('base64url');
  const u = (await admin('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } })).data;
  const token = (await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data.access_token;
  return { id: u.id, as: (p, o = {}) => call(p, { ...o, token }) };
}
const owner = await user(), carer = await user(), other = await user();
const fid = (await owner.as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Bill' } })).data;
const otherFid = (await other.as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Other' } })).data;
const code = (await owner.as('/rest/v1/rpc/create_invitation', { method: 'POST', body: { fid, invite_role: 'caregiver' } })).data;
await carer.as('/rest/v1/rpc/accept_invitation', { method: 'POST', body: { token: code } });
const [baby] = (await owner.as('/rest/v1/babies', { method: 'POST', body: { family_id: fid, name: 'B' } })).data;
const memId = randomUUID();
await owner.as('/rest/v1/memories', { method: 'POST', body: { id: memId, family_id: fid, baby_id: baby.id, author_id: owner.id, raw_text: 'kept forever' } });

const verify = (u, family_id, product_id, purchase_token) => u.as('/functions/v1/billing', { method: 'POST', body: { action: 'verify', family_id, product_id, purchase_token } });
const plan = async (f = fid) => (await owner.as('/rest/v1/rpc/family_usage', { method: 'POST', body: { fid: f } })).data[0]?.plan_id;
const purchases = async () => (await admin(`/rest/v1/purchases?family_id=eq.${fid}&select=*`)).data;

const t1 = `mock:active:${tag(owner.id)}:${nonce()}`;
const first = await verify(owner, fid, 'plus_monthly', t1);
if (first.data.status === 'unavailable') {
  ok(first.data.reason === 'not configured' && (await plan()) === 'free', 'no store configured: mock token refused, plan unchanged');
} else {
  ok(first.data.status === 'done' && first.data.plan_id === 'plus' && (await plan()) === 'plus', 'owner purchase grants Plus');
  let rows = await purchases();
  ok(rows.length === 1 && rows[0].acknowledged && rows[0].user_id === owner.id, 'purchase stored, acknowledged, bound to the buyer');
  ok((await verify(owner, fid, 'plus_monthly', t1)).data.status === 'done' && (await purchases()).length === 1, 'restore is idempotent');
  ok((await verify(carer, fid, 'plus_monthly', `mock:active:${tag(carer.id)}:${nonce()}`)).status === 403, 'only the owner can attach a subscription');
  ok((await verify(owner, fid, 'gold_forever', `mock:active:${tag(owner.id)}:${nonce()}`)).status === 400, 'unknown product rejected');
  ok((await verify(other, otherFid, 'plus_monthly', t1)).status === 409, 'one purchase cannot upgrade a second family');
  ok((await verify(owner, fid, 'plus_monthly', `mock:active:${tag(other.id)}:${nonce()}`)).status === 403, "someone else's purchase cannot be claimed");
  ok((await owner.as('/rest/v1/purchases?select=purchase_token')).data.length === 0, 'purchase tokens are invisible to the app');

  // Canceled but paid-through: keeps its plan; the larger plan wins.
  ok((await verify(owner, fid, 'family_monthly', `mock:canceled:${tag(owner.id)}:${nonce()}`)).data.plan_id === 'family', 'canceled subscription keeps its plan until the period ends');

  // Renewal: the cron refresh re-checks purchases near their end date.
  await admin(`/rest/v1/purchases?purchase_token=eq.${encodeURIComponent(t1)}`, { method: 'PATCH', body: { expires_at: new Date(Date.now() + 86_400_000).toISOString() } });
  ok((await owner.as('/functions/v1/billing', { method: 'POST', body: { action: 'refresh' } })).status === 403, 'refresh is service-only');
  const refreshed = (await admin('/functions/v1/billing', { method: 'POST', body: { action: 'refresh' } })).data.refreshed;
  rows = await purchases();
  ok(refreshed >= 1 && new Date(rows.find((r) => r.purchase_token === t1).expires_at) > new Date(Date.now() + 20 * 86_400_000), 'renewal picked up by refresh');

  // A pending payment that clears later is picked up by refresh and acknowledged.
  const tp = `mock:pending:${tag(owner.id)}:${nonce()}`;
  ok((await verify(owner, fid, 'plus_yearly', tp)).data.status === 'pending', 'pending payment recorded without granting anything');
  await admin(`/rest/v1/purchases?purchase_token=eq.${encodeURIComponent(tp)}`, { method: 'PATCH', body: { purchase_token: tp.replace(':pending:', ':active:') } });
  await admin('/functions/v1/billing', { method: 'POST', body: { action: 'refresh' } });
  rows = await purchases();
  const cleared = rows.find((r) => r.purchase_token === tp.replace(':pending:', ':active:'));
  ok(cleared?.state === 'active' && cleared.acknowledged, 'cleared pending payment acknowledged by refresh');

  // Downgrade: everything already saved stays; only new growth is limited.
  await admin(`/rest/v1/purchases?family_id=eq.${fid}`, { method: 'PATCH', body: { state: 'expired', expires_at: new Date(Date.now() - 1000).toISOString() } });
  await admin('/rest/v1/rpc/sync_store_entitlement', { method: 'POST', body: { fid } });
  ok((await plan()) === 'free', 'lapsed subscription falls back to Free');
  ok((await carer.as(`/rest/v1/memories?id=eq.${memId}&select=raw_text`)).data[0]?.raw_text === 'kept forever', 'memories stay readable after downgrade');
  // Asset rows are written by media-sign confirm (service role); the quota trigger binds it too.
  const big = await admin('/rest/v1/memory_assets', {
    method: 'POST',
    body: { memory_id: memId, family_id: fid, variant: 'display', asset_type: 'photo', mime_type: 'image/jpeg', object_key: `families/${fid}/memories/${memId}/display.jpg`, bytes: 3 * 1024 ** 3 },
  });
  ok(big.status >= 400 && JSON.stringify(big.data).includes('upgrade'), 'uploads beyond the Free quota ask to upgrade');
}

for (const f of [fid, otherFid]) await admin(`/rest/v1/families?id=eq.${f}`, { method: 'DELETE' });
for (const x of [owner, carer, other]) await admin(`/auth/v1/admin/users/${x.id}`, { method: 'DELETE' });
process.exit();
