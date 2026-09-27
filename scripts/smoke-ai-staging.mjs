// Staging AI smoke (npm run smoke:ai): suggestion, embedding, Ask, Daily Story on the deployed ai-journal.
// Uses whatever provider staging is configured with (AI_PROVIDER=mock today). Needs `npx supabase login`.
// Never prints keys. Cleans up after itself.
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

const REF = 'stdlwvahmexetlrrzpld';
const URL = `https://${REF}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${REF} -o json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const keys = JSON.parse(raw.slice(raw.indexOf('[')));
const anon = keys.find((k) => k.name === 'anon').api_key;
const service = keys.find((k) => k.name === 'service_role').api_key;

const call = async (path, { method = 'GET', token = anon, key = anon, body } = {}) => {
  const r = await fetch(URL + path, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body && JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text}`);
  try { return JSON.parse(text); } catch { return text; }
};
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

const email = `smoke-ai-${Date.now()}@test.invalid`;
const password = randomBytes(18).toString('base64url');
const user = await call('/auth/v1/admin/users', { method: 'POST', token: service, key: service, body: { email, password, email_confirm: true } });
let familyId;
try {
  const jwt = (await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).access_token;
  const as = (path, opts = {}) => call(path, { ...opts, token: jwt });
  const fn = (body) => as('/functions/v1/ai-journal', { method: 'POST', body: { tz: 'Asia/Seoul', ...body } });

  familyId = await as('/rest/v1/rpc/create_family', { method: 'POST', body: { family_name: 'Smoke AI' } });
  // Daily Story and Ask answers are Plus features; a manual grant stands in for a purchase.
  await call('/rest/v1/entitlements', { method: 'POST', token: service, key: service, body: { family_id: familyId, plan_id: 'plus', source: 'manual' } });
  const [baby] = await as('/rest/v1/babies', { method: 'POST', body: { family_id: familyId, name: 'B', birth_date: '2026-03-26' } });
  const ids = [];
  for (const text of ['Morning walk in the park', 'Tried banana for the first time', 'Grandma came to visit']) {
    const id = randomUUID();
    ids.push(id);
    await as('/rest/v1/memories', { method: 'POST', body: { id, family_id: familyId, baby_id: baby.id, author_id: user.id, raw_text: text } });
  }

  const j = await fn({ memory_id: ids[1] });
  ok(['done', 'unavailable'].includes(j.status), `journal suggestion answered (${j.status}${j.reason ? `: ${j.reason}` : ''})`);
  let remaining = 1;
  for (let i = 0; i < 5 && remaining > 0; i++) remaining = (await fn({ kind: 'embed_backlog', baby_id: baby.id })).remaining;
  ok(remaining === 0, 'memories embedded on staging');
  const a = await fn({ kind: 'ask', baby_id: baby.id, question: 'What food did she try?' });
  ok(a.sources?.[0]?.id === ids[1], `ask finds the banana note first (${a.status})`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const d = await fn({ kind: 'daily', baby_id: baby.id, day: today });
  ok(['done', 'unavailable'].includes(d.status), `daily story answered (${d.status})`);
} finally {
  if (familyId) await call(`/rest/v1/families?id=eq.${familyId}`, { method: 'DELETE', token: service, key: service });
  await call(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE', token: service, key: service });
  console.log('cleanup done');
}
