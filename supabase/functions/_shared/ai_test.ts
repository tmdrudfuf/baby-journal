// deno test --config supabase/functions/_shared/deno.json supabase/functions/_shared/
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { anthropicProvider } from './anthropic.ts';
import { mockCalls, mockProvider, MOCK_FAIL_MARKER } from './mock-ai.ts';

const input = { text: '오늘 처음으로 혼자 뒤집었어.', occurredOn: '2026-09-26', babyAgeDays: 184 };

// Minimal fake of the SDK response; only the fields the provider reads.
function fake(response: Record<string, unknown>) {
  const sent: unknown[] = [];
  // deno-lint-ignore no-explicit-any
  const create = ((params: unknown) => {
    sent.push(params);
    return Promise.resolve({ model: 'claude-opus-5', usage: { input_tokens: 120, output_tokens: 30 }, ...response });
  }) as any;
  return { create, sent };
}

Deno.test('parses a structured suggestion and reports usage', async () => {
  const { create, sent } = fake({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ story: '뒤집기 성공!', milestone: '첫 뒤집기' }) }],
  });
  const { result, usage } = await anthropicProvider('k', 'claude-opus-5', create).journal(input);
  assertEquals(result, { story: '뒤집기 성공!', milestone: '첫 뒤집기' });
  assertEquals(usage, { provider: 'anthropic', model: 'claude-opus-5', inputTokens: 120, outputTokens: 30 });
  // Privacy (§38): the request carries only the prompt built from this one note, date and age.
  const params = sent[0] as { messages: { content: string }[] };
  assertEquals(params.messages.length, 1);
  assertEquals(params.messages[0].content, 'Date: 2026-09-26\nBaby\'s age: 184 days.\nParent\'s note:\n오늘 처음으로 혼자 뒤집었어.');
});

Deno.test('a refusal yields no suggestion instead of an error', async () => {
  const { create } = fake({ stop_reason: 'refusal', content: [] });
  const { result } = await anthropicProvider('k', 'm', create).journal(input);
  assertEquals(result, { story: null, milestone: null });
});

Deno.test('truncated or malformed output is a failure (caller falls back)', async () => {
  await assertRejects(() => anthropicProvider('k', 'm', fake({ stop_reason: 'max_tokens', content: [] }).create).journal(input));
  await assertRejects(() =>
    anthropicProvider('k', 'm', fake({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }).create).journal(input),
  );
});

Deno.test('mock provider is deterministic and can fail on demand', async () => {
  const ai = mockProvider();
  const { result } = await ai.journal({ ...input, text: 'First smile at grandma today, so happy' });
  assertEquals(result.milestone, 'First smile at grandma today, so happy');
  assertEquals(mockCalls.at(-1)?.text, 'First smile at grandma today, so happy');
  await assertRejects(() => ai.journal({ ...input, text: `x ${MOCK_FAIL_MARKER}` }));
});

Deno.test('daily story sends only that day\'s notes and parses the story', async () => {
  const { create, sent } = fake({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"story":"A full day."}' }] });
  const { result } = await anthropicProvider('k', 'm', create).daily({ day: '2026-09-26', babyAgeDays: 184, notes: ['bath', 'first laugh'] });
  assertEquals(result.story, 'A full day.');
  assertEquals((sent[0] as { messages: { content: string }[] }).messages[0].content, "Date: 2026-09-26\nBaby's age: 184 days.\nNotes:\n- bath\n- first laugh");
});
