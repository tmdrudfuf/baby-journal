// OpenAI implementation of AiProvider (Responses API, structured outputs). Same contract as anthropic.ts.
import OpenAI from 'npm:openai@7';

import {
  ASK_SCHEMA,
  ASK_SYSTEM,
  askPrompt,
  DAILY_SCHEMA,
  DAILY_SYSTEM,
  dailyPrompt,
  JOURNAL_SCHEMA,
  JOURNAL_SYSTEM,
  journalPrompt,
  type AiProvider,
  type AskAnswer,
  type JournalSuggestion,
  type Usage,
} from './ai.ts';

type CreateFn = (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => Promise<OpenAI.Responses.Response>;

// `create` is injectable so tests can exercise response handling without network or a key.
export function openaiProvider(apiKey: string, model: string, create?: CreateFn): AiProvider {
  const send: CreateFn = create ?? ((params) => new OpenAI({ apiKey, maxRetries: 1, timeout: 30_000 }).responses.create(params));

  // One structured request. A refusal yields `declined` instead of an error: the memory simply gets no suggestion.
  async function ask<T>(instructions: string, name: string, schema: object, prompt: string, declined: T) {
    const response = await send({
      model,
      instructions,
      input: prompt,
      max_output_tokens: 2048,
      store: false, // family notes are not kept for later retrieval on OpenAI's side
      text: { format: { type: 'json_schema', name, schema: schema as Record<string, unknown>, strict: true } },
    });
    const usage: Usage = {
      provider: 'openai',
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
    const content = response.output.flatMap((item) => (item.type === 'message' ? item.content : []));
    if (content.some((c) => c.type === 'refusal')) return { result: declined, usage };
    if (response.status === 'incomplete') throw new Error(`response incomplete (${response.incomplete_details?.reason ?? 'unknown'})`);
    const text = content.find((c) => c.type === 'output_text');
    if (!text || text.type !== 'output_text') throw new Error('no text in response');
    return { result: JSON.parse(text.text) as T, usage };
  }

  return {
    name: 'openai',
    journal: (input) => ask<JournalSuggestion>(JOURNAL_SYSTEM, 'journal_suggestion', JOURNAL_SCHEMA, journalPrompt(input), { story: null, milestone: null }),
    daily: (input) => ask<{ story: string | null }>(DAILY_SYSTEM, 'daily_story', DAILY_SCHEMA, dailyPrompt(input), { story: null }),
    answer: (input) => ask<AskAnswer>(ASK_SYSTEM, 'journal_answer', ASK_SCHEMA, askPrompt(input), { answer: null, cited: [] }),
  };
}
