// AI suggestions for the journal (§13, §14, §59). Failure never affects capture (§54).
//
// POST { memory_id, regenerate?, tz? }        -> story + possible milestone for one memory
// POST { kind: 'daily', baby_id, day, regenerate?, tz? } -> Daily Story for one local day
// Both answer { status: 'done' | 'skipped' | 'unchanged' | 'disabled' | 'unavailable', reason? }
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { cleanSuggestion, DAILY_MIN_NOTES, estimateCostUsd, sha256Hex, type AiProvider, type Usage } from '../_shared/ai.ts';
import { anthropicProvider } from '../_shared/anthropic.ts';
import { localDay } from '../_shared/export-doc.ts';
import { mockProvider } from '../_shared/mock-ai.ts';

const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT_PER_FAMILY') ?? '50'); // cost guardrail (§42)
const MODEL = Deno.env.get('AI_JOURNAL_MODEL') ?? 'claude-opus-5';
const DAY_MS = 86_400_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Explicit selection: the mock is only used when AI_PROVIDER=mock (local/CI), never as a silent fallback.
function provider(): AiProvider | null {
  const choice = Deno.env.get('AI_PROVIDER') ?? 'anthropic';
  if (choice === 'mock') return mockProvider();
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  return choice === 'anthropic' && key ? anthropicProvider(key, MODEL) : null;
}

const ageDays = (day: string, birth: string | null | undefined) =>
  birth ? Math.round((Date.parse(day) - Date.parse(birth)) / DAY_MS) : null;

type Ctx = { db: SupabaseClient; admin: SupabaseClient; userId: string | null; tz: string; regenerate: boolean };

// Common gate before any provider call: family switch, configuration, per-family daily cap.
async function prepare(ctx: Ctx, familyId: string): Promise<AiProvider | Response> {
  const { data: fam } = await ctx.db.from('families').select('ai_enabled').eq('id', familyId).single();
  if (fam?.ai_enabled === false) return json({ status: 'disabled' });
  const ai = provider();
  if (!ai) return json({ status: 'unavailable', reason: 'not configured' });
  const { count } = await ctx.admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('created_at', new Date(Date.now() - DAY_MS).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return json({ status: 'unavailable', reason: 'daily limit' });
  return ai;
}

// Telemetry (§39): tokens, cost and latency only, never content.
function recordUsage(ctx: Ctx, familyId: string, feature: string, started: number, usage: Usage | { provider: string; model: string }) {
  const ok = 'inputTokens' in usage;
  return ctx.admin.from('ai_usage').insert({
    family_id: familyId, user_id: ctx.userId, feature, provider: usage.provider, model: usage.model,
    input_tokens: ok ? usage.inputTokens : 0, output_tokens: ok ? usage.outputTokens : 0,
    latency_ms: Date.now() - started, est_cost_usd: ok ? estimateCostUsd(usage) : 0, ok,
  });
}

async function journal(ctx: Ctx, memoryId: unknown) {
  if (typeof memoryId !== 'string') return json({ error: 'invalid memory_id' }, 400);
  // Only people who may edit the memory may spend AI on it.
  const { data: allowed } = await ctx.db.rpc('can_edit_memory', { mid: memoryId });
  if (!allowed) return json({ error: 'forbidden' }, 403);

  // Minimum context (§38): this memory's text, date and the baby's age. No other history.
  const { data: m } = await ctx.db
    .from('memories')
    .select('id, family_id, raw_text, occurred_at, ai_input_hash, story_edited, babies(birth_date)')
    .eq('id', memoryId)
    .single();
  if (!m) return json({ error: 'not found' }, 404);

  const text = m.raw_text?.trim() ?? '';
  if (text.length < 3) {
    await ctx.admin.from('memories').update({ ai_status: 'skipped' }).eq('id', m.id);
    return json({ status: 'skipped' });
  }
  const hash = await sha256Hex(text);
  // Cache (§39): unchanged text is never sent again unless the parent asks to regenerate.
  if (hash === m.ai_input_hash && !ctx.regenerate) return json({ status: 'unchanged' });

  const ai = await prepare(ctx, m.family_id);
  if (ai instanceof Response) return ai;

  const occurredOn = localDay(m.occurred_at, ctx.tz);
  const birth = (m.babies as unknown as { birth_date: string | null } | null)?.birth_date; // many-to-one embed
  const started = Date.now();
  try {
    const { result, usage } = await ai.journal({ text, occurredOn, babyAgeDays: ageDays(occurredOn, birth) });
    const s = cleanSuggestion(result);
    await recordUsage(ctx, m.family_id, 'journal', started, usage);
    // raw_text is never touched. A story the parent edited is kept unless they asked to regenerate.
    const keepStory = m.story_edited && !ctx.regenerate;
    await ctx.admin
      .from('memories')
      .update({
        ...(keepStory ? {} : { story_text: s.story, story_edited: false }),
        milestone_candidate: !!s.milestone,
        milestone_title: s.milestone,
        ai_status: 'done',
        ai_input_hash: hash,
      })
      .eq('id', m.id);
    return json({ status: 'done' });
  } catch (e) {
    await recordUsage(ctx, m.family_id, 'journal', started, { provider: ai.name, model: MODEL });
    await ctx.admin.from('memories').update({ ai_status: 'failed' }).eq('id', m.id);
    console.error('ai-journal failed', (e as Error).message); // no memory content in logs (§44)
    return json({ status: 'unavailable', reason: 'provider error' });
  }
}

async function daily(ctx: Ctx, babyId: unknown, day: unknown) {
  if (typeof babyId !== 'string' || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return json({ error: 'invalid baby_id or day' }, 400);
  }
  const { data: baby } = await ctx.db.from('babies').select('family_id, birth_date').eq('id', babyId).single();
  if (!baby) return json({ error: 'not found' }, 404);
  const { data: allowed } = await ctx.db.rpc('has_family_role', { fid: baby.family_id, min_role: 'contributor' });
  if (!allowed) return json({ error: 'forbidden' }, 403);

  // A kept or edited story is the family's; only an explicit regenerate replaces it.
  const { data: existing } = await ctx.db.from('daily_stories').select('story_text').eq('baby_id', babyId).eq('day', day).maybeSingle();
  if (existing?.story_text && !ctx.regenerate) return json({ status: 'unchanged' });

  // Minimum context (§38): that local day's notes only. Widen by a day each side, then filter in the family's timezone.
  const from = new Date(Date.parse(day) - DAY_MS).toISOString();
  const to = new Date(Date.parse(day) + 2 * DAY_MS).toISOString();
  const { data: rows } = await ctx.db
    .from('memories')
    .select('raw_text, occurred_at')
    .eq('baby_id', babyId)
    .gte('occurred_at', from)
    .lt('occurred_at', to)
    .order('occurred_at');
  const notes = (rows ?? [])
    .filter((r) => localDay(r.occurred_at, ctx.tz) === day && (r.raw_text?.trim().length ?? 0) >= 3)
    .map((r) => r.raw_text!.trim());
  if (notes.length < DAILY_MIN_NOTES) return json({ status: 'skipped' });

  const ai = await prepare(ctx, baby.family_id);
  if (ai instanceof Response) return ai;

  const started = Date.now();
  try {
    const { result, usage } = await ai.daily({ day, babyAgeDays: ageDays(day, baby.birth_date), notes });
    await recordUsage(ctx, baby.family_id, 'daily', started, usage);
    const story = cleanSuggestion({ story: result.story, milestone: null }).story;
    if (!story) return json({ status: 'skipped' });
    await ctx.admin.from('daily_stories').upsert({
      baby_id: babyId, family_id: baby.family_id, day, story_text: story, saved: false, edited: false, updated_at: new Date().toISOString(),
    });
    return json({ status: 'done' });
  } catch (e) {
    await recordUsage(ctx, baby.family_id, 'daily', started, { provider: ai.name, model: MODEL });
    console.error('daily story failed', (e as Error).message);
    return json({ status: 'unavailable', reason: 'provider error' });
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const body = await req.json().catch(() => ({}));
  let tz = typeof body.tz === 'string' ? body.tz : 'UTC';
  try {
    localDay(new Date().toISOString(), tz);
  } catch {
    tz = 'UTC';
  }

  const { data: allowedRate } = await db.rpc('hit_rate_limit', { bucket_name: 'ai-journal', max_hits: 120, window_seconds: 3600 });
  if (!allowedRate) return json({ status: 'unavailable', reason: 'rate limit' });

  const userId = (await db.auth.getUser()).data.user?.id ?? null;
  const ctx: Ctx = { db, admin, userId, tz, regenerate: body.regenerate === true };
  return body.kind === 'daily' ? daily(ctx, body.baby_id, body.day) : journal(ctx, body.memory_id);
});
