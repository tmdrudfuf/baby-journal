// M2 acceptance on LOCAL Supabase with the mock AI provider (no paid key needed):
//   npm run db:start
//   npx supabase functions serve ai-journal --env-file supabase/functions/.env.ai-test
//     (.env.ai-test: AI_PROVIDER=mock, AI_DAILY_LIMIT_PER_FAMILY=8)
//   npm run e2e:ai-local
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const API = status.API_URL, anon = status.ANON_KEY, svc = status.SERVICE_ROLE_KEY;

const call = async (path, { method = 'GET', token = anon, key = anon, body } = {}) => {
  const r = await fetch(API + path, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body && JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
};
const admin = (p, o = {}) => call(p, { ...o, key: svc, token: svc });
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

async function user() {
  const email = `ai-${randomBytes(4).toString('hex')}@test.invalid`, password = randomBytes(12).toString('base64url');
  const u = (await admin('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } })).data;
  const token = (await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data.access_token;
  return { id: u.id, as: (p, o = {}) => call(p, { ...o, token }) };
}

const owner = await user(), viewer = await user();
const fid = (await owner.as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'AI' } })).data;
const [baby] = (await owner.as('/rest/v1/babies', { method: 'POST', body: { family_id: fid, name: 'B', birth_date: '2026-03-26' } })).data;
const code = (await owner.as('/rest/v1/rpc/create_invitation', { method: 'POST', body: { fid, invite_role: 'viewer' } })).data;
await viewer.as('/rest/v1/rpc/accept_invitation', { method: 'POST', body: { token: code } });

const memory = async (text, occurred_at = '2026-09-27T07:00:00Z') => {
  const id = randomUUID();
  await owner.as('/rest/v1/memories', { method: 'POST', body: { id, family_id: fid, baby_id: baby.id, author_id: owner.id, raw_text: text, occurred_at } });
  return id;
};
const ai = (u, memory_id, extra = {}) => u.as('/functions/v1/ai-journal', { method: 'POST', body: { memory_id, tz: 'Pacific/Honolulu', ...extra } });
const row = async (id) => (await admin(`/rest/v1/memories?id=eq.${id}&select=*`)).data[0];
const usage = async () => (await admin(`/rest/v1/ai_usage?family_id=eq.${fid}&select=*&order=id`)).data;

// 1. Suggestion + milestone, original preserved, telemetry recorded.
const original = 'First time rolling over all by himself today!';
const m1 = await memory(original);
const first = await ai(owner, m1); if (first.data.status !== 'done') console.log(first);
ok(first.data.status === 'done', 'suggestion generated');
let r = await row(m1);
ok(r.raw_text === original, 'original words untouched');
ok(r.story_text === `A moment to remember: ${original}`, 'story suggestion stored separately');
ok(r.milestone_candidate === true && r.milestone_title, 'possible milestone detected');
let u = await usage();
ok(u.length === 1 && u[0].ok && u[0].provider === 'mock' && u[0].feature === 'journal' && u[0].input_tokens > 0, 'usage/cost telemetry row written');
ok(!Object.keys(u[0]).some((k) => /text|story|note|content/.test(k)), 'telemetry holds no memory content');

// 2. Cache: unchanged text is not sent again.
ok((await ai(owner, m1)).data.status === 'unchanged', 'unchanged text served from cache');
ok((await usage()).length === 1, 'no provider call for cached text');

// 3. Parent edits the suggestion; AI never overwrites it unless asked.
await owner.as(`/rest/v1/memories?id=eq.${m1}`, { method: 'PATCH', body: { story_text: 'My own words', story_edited: true } });
await owner.as(`/rest/v1/memories?id=eq.${m1}`, { method: 'PATCH', body: { raw_text: `${original} So proud.` } });
ok((await ai(owner, m1)).data.status === 'done', 'changed text reprocessed');
ok((await row(m1)).story_text === 'My own words', 'edited suggestion kept');
ok((await ai(owner, m1, { regenerate: true })).data.status === 'done', 'regenerate runs even for cached text');
r = await row(m1);
ok(r.story_text.startsWith('A moment to remember') && r.story_edited === false, 'regenerate replaces the story');

// 4. Provider failure: memory stays, status says so.
const m2 = await memory('Something went wrong here [mock-fail]');
const f = await ai(owner, m2);
ok(f.status === 200 && f.data.status === 'unavailable' && f.data.reason === 'provider error', 'provider failure degrades gracefully');
r = await row(m2);
ok(r && r.raw_text.includes('[mock-fail]') && r.ai_status === 'failed' && r.story_text === null, 'memory saved intact after AI failure');
ok((await usage()).some((x) => x.ok === false), 'failure recorded in telemetry');

// 5. Short notes are skipped; viewers cannot spend AI; family switch works.
const m3 = await memory('ok');
ok((await ai(owner, m3)).data.status === 'skipped', 'too-short note skipped');
ok((await ai(viewer, m1, { regenerate: true })).status === 403, 'viewer cannot trigger AI');
await owner.as(`/rest/v1/families?id=eq.${fid}`, { method: 'PATCH', body: { ai_enabled: false } });
ok((await ai(owner, await memory('A long enough note for AI to try'))).data.status === 'disabled', 'AI off for the family: nothing sent');
await owner.as(`/rest/v1/families?id=eq.${fid}`, { method: 'PATCH', body: { ai_enabled: true } });

// 6. Timezone: an evening memory keeps its local date (age is computed from it).
const m5 = await memory('First bath with big sister tonight', '2026-09-27T07:00:00Z'); // 21:00 on Sep 26 in Honolulu
await ai(owner, m5);
ok((await row(m5)).ai_status === 'done', 'local-date request processed');

// 7. Daily cap (limit 8 in .env.ai-test).
let last;
for (let i = 0; i < 8; i++) last = await ai(owner, await memory(`Daily cap probe number ${i} with enough words`));
ok(last.data.status === 'unavailable' && last.data.reason === 'daily limit', 'per-family daily cap enforced');

// Cleanup (local DB only).
await admin(`/rest/v1/families?id=eq.${fid}`, { method: 'DELETE' });
for (const x of [owner, viewer]) await admin(`/auth/v1/admin/users/${x.id}`, { method: 'DELETE' });
process.exit();
