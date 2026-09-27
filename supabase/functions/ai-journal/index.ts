// Suggests a journal story + possible milestone for one memory (§13, §59).
// Runs after the memory is synced; failure never affects capture (§54).
//
// POST { memory_id } -> { status: 'done' | 'skipped' | 'unchanged' | 'unavailable' }
import { createClient } from 'npm:@supabase/supabase-js@2';

import { cleanSuggestion, estimateCostUsd, sha256Hex, type AiProvider } from '../_shared/ai.ts';
import { anthropicProvider } from '../_shared/anthropic.ts';

const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT_PER_FAMILY') ?? '50'); // cost guardrail (§42)
const MODEL = Deno.env.get('AI_JOURNAL_MODEL') ?? 'claude-opus-5';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function provider(): AiProvider | null {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  return key ? anthropicProvider(key, MODEL) : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { memory_id } = await req.json().catch(() => ({}));
  if (typeof memory_id !== 'string') return json({ error: 'invalid memory_id' }, 400);

  const { data: allowedRate } = await db.rpc('hit_rate_limit', { bucket_name: 'ai-journal', max_hits: 120, window_seconds: 3600 });
  if (!allowedRate) return json({ status: 'unavailable', reason: 'rate limit' });

  // Only people who may edit the memory may spend AI on it.
  const { data: allowed } = await db.rpc('can_edit_memory', { mid: memory_id });
  if (!allowed) return json({ error: 'forbidden' }, 403);

  // Minimum context (§38): this memory's text, date and the baby's age. No other history.
  const { data: m } = await db
    .from('memories')
    .select('id, family_id, raw_text, occurred_at, ai_input_hash, babies(birth_date)')
    .eq('id', memory_id)
    .single();
  if (!m) return json({ error: 'not found' }, 404);

  const text = m.raw_text?.trim() ?? '';
  if (text.length < 3) {
    await admin.from('memories').update({ ai_status: 'skipped' }).eq('id', m.id);
    return json({ status: 'skipped' });
  }
  const hash = await sha256Hex(text);
  if (hash === m.ai_input_hash) return json({ status: 'unchanged' });

  const ai = provider();
  if (!ai) return json({ status: 'unavailable' });

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', m.family_id)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ status: 'unavailable', reason: 'daily limit' });

  const occurredOn = m.occurred_at.slice(0, 10);
  const birth = (m.babies as unknown as { birth_date: string | null } | null)?.birth_date; // many-to-one embed
  const babyAgeDays = birth ? Math.round((Date.parse(occurredOn) - Date.parse(birth)) / 86_400_000) : null;
  const userId = (await db.auth.getUser()).data.user?.id ?? null;

  const started = Date.now();
  try {
    const { result, usage } = await ai.journal({ text, occurredOn, babyAgeDays });
    const s = cleanSuggestion(result);
    await admin.from('ai_usage').insert({
      family_id: m.family_id, user_id: userId, feature: 'journal', provider: usage.provider, model: usage.model,
      input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, latency_ms: Date.now() - started,
      est_cost_usd: estimateCostUsd(usage), ok: true,
    });
    await admin
      .from('memories')
      .update({ story_text: s.story, milestone_candidate: !!s.milestone, milestone_title: s.milestone, ai_status: 'done', ai_input_hash: hash })
      .eq('id', m.id);
    return json({ status: 'done' });
  } catch (e) {
    await admin.from('ai_usage').insert({
      family_id: m.family_id, user_id: userId, feature: 'journal', provider: ai.name, model: MODEL,
      latency_ms: Date.now() - started, ok: false,
    });
    await admin.from('memories').update({ ai_status: 'failed' }).eq('id', m.id);
    console.error('ai-journal failed', (e as Error).message); // no memory content in logs (§44)
    return json({ status: 'unavailable' });
  }
});
