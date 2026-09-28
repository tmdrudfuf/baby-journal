// AI provider abstraction (§25, §38). Domain code depends on this interface, never on a vendor SDK.
// Pure: no Deno/npm imports, so Jest can test it.

export type JournalInput = {
  text: string;
  occurredOn: string; // YYYY-MM-DD
  babyAgeDays: number | null;
};

export type JournalSuggestion = {
  story: string | null; // short, warm rewrite of the parent's words; null when nothing to add
  milestone: string | null; // e.g. "First rollover"; null when not a milestone
};

export type Usage = { provider: string; model: string; inputTokens: number; outputTokens: number };

export type DailyInput = {
  day: string; // YYYY-MM-DD
  babyAgeDays: number | null;
  notes: string[]; // that day's notes, oldest first
};

export type AskInput = {
  question: string;
  notes: { date: string; text: string }[]; // retrieved memories, numbered 1..n in the prompt
};

export type AskAnswer = {
  answer: string | null; // null when the notes do not answer the question
  cited: number[]; // 1-based note numbers the answer relies on
};

export interface AiProvider {
  name: string;
  answer(input: AskInput): Promise<{ result: AskAnswer; usage: Usage }>;
  journal(input: JournalInput): Promise<{ result: JournalSuggestion; usage: Usage }>;
  daily(input: DailyInput): Promise<{ result: { story: string | null }; usage: Usage }>;
}

// Daily Story (§14) needs a few moments to be worth writing.
export const DAILY_MIN_NOTES = 3;

export const JOURNAL_SYSTEM = [
  'You help parents keep a private baby journal.',
  'Given what a parent wrote about a moment, return:',
  '- story: one or two warm sentences retelling the moment for the journal, in the same language the parent wrote in.',
  '  Use only facts the parent stated. Do not add feelings, people, places, or details they did not mention.',
  '  If the note is too short or factual to improve (e.g. a feeding log), return null.',
  '- milestone: a short title (max 6 words, same language) if the note describes a developmental first',
  '  (first smile, rollover, sitting, crawling, word, steps, tooth, solid food, etc.). Otherwise null.',
  'Never give medical advice or assessments.',
].join('\n');

export const JOURNAL_SCHEMA = {
  type: 'object',
  properties: {
    story: { type: ['string', 'null'] },
    milestone: { type: ['string', 'null'] },
  },
  required: ['story', 'milestone'],
  additionalProperties: false,
} as const;

export const DAILY_SYSTEM = [
  'You help parents keep a private baby journal.',
  "Given the notes a family wrote during one day, write a short story of that day (2-4 sentences) for the journal,",
  'in the language the notes are written in. Use only facts from the notes; do not invent feelings, people or events.',
  'Return story: null if the notes are only logs with nothing to tell. Never give medical advice or assessments.',
].join('\n');

export const DAILY_SCHEMA = {
  type: 'object',
  properties: { story: { type: ['string', 'null'] } },
  required: ['story'],
  additionalProperties: false,
} as const;

export function dailyPrompt(input: DailyInput): string {
  const age = input.babyAgeDays !== null ? `Baby's age: ${input.babyAgeDays} days.\n` : '';
  return `Date: ${input.day}\n${age}Notes:\n${input.notes.map((n) => `- ${n}`).join('\n')}`;
}

export const ASK_SYSTEM = [
  "You answer a parent's question about their own baby journal.",
  'Use only the numbered notes provided. If they do not answer the question, return answer: null.',
  'Answer in one to three sentences, in the language of the question, and mention dates when helpful.',
  'cited: the numbers of the notes your answer relies on. Never give medical advice or assessments.',
].join('\n');

export const ASK_SCHEMA = {
  type: 'object',
  properties: { answer: { type: ['string', 'null'] }, cited: { type: 'array', items: { type: 'integer' } } },
  required: ['answer', 'cited'],
  additionalProperties: false,
} as const;

export const ASK_NOTE_MAX = 500; // characters per retrieved note sent to the provider

export function askPrompt(input: AskInput): string {
  const notes = input.notes.map((n, i) => `[${i + 1}] ${n.date}: ${n.text.slice(0, ASK_NOTE_MAX)}`).join('\n');
  return `Notes:\n${notes}\n\nQuestion: ${input.question}`;
}

// Grounding (§ M6): keep only citations that point at notes we actually retrieved, once each.
export function groundCitations(cited: unknown, count: number): number[] {
  if (!Array.isArray(cited)) return [];
  return [...new Set(cited.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= count))];
}

export function journalPrompt(input: JournalInput): string {
  const age = input.babyAgeDays !== null ? `Baby's age: ${input.babyAgeDays} days.\n` : '';
  return `Date: ${input.occurredOn}\n${age}Parent's note:\n${input.text}`;
}

// Defensive cleanup of model output before it reaches the database.
export function cleanSuggestion(raw: JournalSuggestion): JournalSuggestion {
  const tidy = (s: string | null, max: number) => {
    const t = s?.trim();
    return t ? t.slice(0, max) : null;
  };
  return { story: tidy(raw.story, 1000), milestone: tidy(raw.milestone, 120) };
}

// USD per million tokens. ponytail: static table; move to config when prices change often.
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
};

// Models not in the table can be priced without a deploy: AI_PRICE_PER_MTOK="in,out" (USD per million tokens).
export function estimateCostUsd(u: Usage, override?: string): number {
  const custom = override?.split(',').map(Number);
  const [inp, out] = PRICES[u.model] ?? (custom?.length === 2 && custom.every(Number.isFinite) ? custom : [0, 0]);
  return (u.inputTokens * inp + u.outputTokens * out) / 1_000_000;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
