import { cleanSuggestion, estimateCostUsd, journalPrompt } from '../../supabase/functions/_shared/ai';

test('prompt carries only the note, date and age', () => {
  const p = journalPrompt({ text: '오늘 처음으로 혼자 뒤집었어.', occurredOn: '2026-09-26', babyAgeDays: 184 });
  expect(p).toContain('2026-09-26');
  expect(p).toContain('184 days');
  expect(p).toContain('뒤집었어');
});

test('suggestions are trimmed, emptied to null and capped', () => {
  expect(cleanSuggestion({ story: '  ', milestone: ' First rollover ' })).toEqual({ story: null, milestone: 'First rollover' });
  expect(cleanSuggestion({ story: 'x'.repeat(5000), milestone: null }).story).toHaveLength(1000);
});

test('cost estimate uses per-model prices; unknown models cost 0 rather than crash', () => {
  expect(estimateCostUsd({ provider: 'anthropic', model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 0 })).toBe(5);
  expect(estimateCostUsd({ provider: 'x', model: 'unknown', inputTokens: 10, outputTokens: 10 })).toBe(0);
});
