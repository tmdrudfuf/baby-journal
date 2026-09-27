// Deterministic AiProvider for local/CI verification (AI_PROVIDER=mock). Never selected implicitly.
import type { AiProvider, JournalInput } from './ai.ts';

export const MOCK_FAIL_MARKER = '[mock-fail]';

// Received inputs, so tests can assert exactly what would be sent to a real provider (§38).
export const mockCalls: JournalInput[] = [];

export function mockProvider(): AiProvider {
  return {
    name: 'mock',
    async journal(input) {
      mockCalls.push(input);
      if (input.text.includes(MOCK_FAIL_MARKER)) throw new Error('mock provider failure');
      const first = /\b(first)\b|처음|첫/i.test(input.text);
      return {
        result: {
          story: input.text.length >= 20 ? `A moment to remember: ${input.text}` : null,
          milestone: first ? input.text.slice(0, 40) : null,
        },
        usage: { provider: 'mock', model: 'mock-1', inputTokens: input.text.length, outputTokens: 20 },
      };
    },
    async answer(input) {
      if (input.question.includes(MOCK_FAIL_MARKER)) throw new Error('mock provider failure');
      // Cites the best match and one number that was never retrieved, so grounding is exercised.
      return {
        result: input.notes.length ? { answer: `From your journal: ${input.notes[0].text}`, cited: [1, input.notes.length + 5] } : { answer: null, cited: [] },
        usage: { provider: 'mock', model: 'mock-1', inputTokens: input.question.length, outputTokens: 20 },
      };
    },
    async daily(input) {
      if (input.notes.some((n) => n.includes(MOCK_FAIL_MARKER))) throw new Error('mock provider failure');
      return {
        result: { story: `A day to remember: ${input.notes.join(' Then, ')}` },
        usage: { provider: 'mock', model: 'mock-1', inputTokens: input.notes.join('').length, outputTokens: 30 },
      };
    },
  };
}
