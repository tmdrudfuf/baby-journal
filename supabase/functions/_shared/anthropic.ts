// Anthropic implementation of AiProvider. Swap by adding another file implementing the same interface.
import Anthropic from 'npm:@anthropic-ai/sdk@0';

import { JOURNAL_SCHEMA, JOURNAL_SYSTEM, journalPrompt, type AiProvider, type JournalSuggestion } from './ai.ts';

type CreateFn = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Beta.Messages.BetaMessage>;

// `create` is injectable so tests can exercise response handling without network or a key.
export function anthropicProvider(apiKey: string, model: string, create?: CreateFn): AiProvider {
  const send: CreateFn =
    create ?? ((params) => new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 }).beta.messages.create(params));
  return {
    name: 'anthropic',
    async journal(input) {
      const response = await send({
        model,
        max_tokens: 4096, // thinking tokens count against this
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: JOURNAL_SYSTEM,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: JOURNAL_SCHEMA } },
        messages: [{ role: 'user', content: journalPrompt(input) }],
        stream: false,
      });
      const usage = {
        provider: 'anthropic',
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      // A declined request is not an error: the memory simply gets no suggestion.
      if (response.stop_reason === 'refusal') return { result: { story: null, milestone: null }, usage };
      if (response.stop_reason === 'max_tokens') throw new Error('response truncated');
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') throw new Error('no text in response');
      return { result: JSON.parse(text.text) as JournalSuggestion, usage };
    },
  };
}
