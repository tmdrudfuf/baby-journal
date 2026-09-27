// Anthropic implementation of AiProvider. Swap by adding another file implementing the same interface.
import Anthropic from 'npm:@anthropic-ai/sdk@0';

import {
  DAILY_SCHEMA,
  DAILY_SYSTEM,
  dailyPrompt,
  JOURNAL_SCHEMA,
  JOURNAL_SYSTEM,
  journalPrompt,
  type AiProvider,
  type JournalSuggestion,
  type Usage,
} from './ai.ts';

type CreateFn = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Beta.Messages.BetaMessage>;

// `create` is injectable so tests can exercise response handling without network or a key.
export function anthropicProvider(apiKey: string, model: string, create?: CreateFn): AiProvider {
  const send: CreateFn =
    create ?? ((params) => new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 }).beta.messages.create(params));

  // One structured request. A refusal yields `declined` instead of an error: the memory simply gets no suggestion.
  async function ask<T>(system: string, schema: Record<string, unknown>, prompt: string, declined: T) {
    const response = await send({
      model,
      max_tokens: 4096, // thinking tokens count against this
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });
    const usage: Usage = {
      provider: 'anthropic',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    if (response.stop_reason === 'refusal') return { result: declined, usage };
    if (response.stop_reason === 'max_tokens') throw new Error('response truncated');
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('no text in response');
    return { result: JSON.parse(text.text) as T, usage };
  }

  return {
    name: 'anthropic',
    journal: (input) =>
      ask<JournalSuggestion>(JOURNAL_SYSTEM, JOURNAL_SCHEMA, journalPrompt(input), { story: null, milestone: null }),
    daily: (input) => ask<{ story: string | null }>(DAILY_SYSTEM, DAILY_SCHEMA, dailyPrompt(input), { story: null }),
  };
}
