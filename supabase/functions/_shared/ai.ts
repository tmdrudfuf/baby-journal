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

export interface AiProvider {
  name: string;
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

export function estimateCostUsd(u: Usage): number {
  const [inp, out] = PRICES[u.model] ?? [0, 0];
  return (u.inputTokens * inp + u.outputTokens * out) / 1_000_000;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
