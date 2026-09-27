// Anthropic implementation of AiProvider. Swap by adding another file implementing the same interface.
import Anthropic from 'npm:@anthropic-ai/sdk@0';

import { JOURNAL_SCHEMA, JOURNAL_SYSTEM, journalPrompt, type AiProvider, type JournalSuggestion } from './ai.ts';

export function anthropicProvider(apiKey: string, model: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  return {
    name: 'anthropic',
    async journal(input) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 4096, // thinking tokens count against this
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: JOURNAL_SYSTEM,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: JOURNAL_SCHEMA } },
        messages: [{ role: 'user', content: journalPrompt(input) }],
      });
      const usage = {
        provider: 'anthropic',
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      if (response.stop_reason === 'refusal') return { result: { story: null, milestone: null }, usage };
      if (response.stop_reason === 'max_tokens') throw new Error('response truncated');
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') throw new Error('no text in response');
      return { result: JSON.parse(text.text) as JournalSuggestion, usage };
    },
  };
}
