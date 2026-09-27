// "My First Year" (§21, §66): pure assembly of a year's story from local data. No AI.
import { parseLocalDate } from '@/lib/dates';
import { monthKey, selectHighlights, type Candidate } from '@/lib/monthly';

export type YearStory = {
  year: number; // 1 = first year (birth to first birthday)
  from: Date;
  to: Date; // exclusive
  complete: boolean; // the year has fully passed
  milestones: { title: string; occurred_on: string }[];
  months: { key: string; index: number; highlight: Candidate | null }[]; // index 1..12 = month of life
  counts: { memories: number; photos: number; feeds: number; diapers: number };
};

// Year N of life runs from the (N-1)th birthday to the Nth, in local time.
export function yearRange(birthDate: string, year: number): { from: Date; to: Date } {
  const b = parseLocalDate(birthDate);
  return {
    from: new Date(b.getFullYear() + year - 1, b.getMonth(), b.getDate()),
    to: new Date(b.getFullYear() + year, b.getMonth(), b.getDate()),
  };
}

export function buildYearStory(
  birthDate: string,
  year: number,
  now: Date,
  memories: Candidate[],
  milestones: { title: string; occurred_on: string }[],
  events: { kind: string; started_at: string }[],
): YearStory {
  const { from, to } = yearRange(birthDate, year);
  const inYear = (d: Date) => d >= from && d < to;
  const mems = memories.filter((m) => inYear(new Date(m.occurred_at)));
  const b = parseLocalDate(birthDate);
  // Month of life k (1..12) starts on the monthly birthday.
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(b.getFullYear() + year - 1, b.getMonth() + i, b.getDate());
    const end = new Date(b.getFullYear() + year - 1, b.getMonth() + i + 1, b.getDate());
    const inMonth = mems.filter((m) => {
      const d = new Date(m.occurred_at);
      return d >= start && d < end;
    });
    return { key: monthKey(start), index: i + 1, highlight: selectHighlights(inMonth, 1)[0] ?? null };
  }).filter((m) => new Date(b.getFullYear() + year - 1, b.getMonth() + m.index - 1, b.getDate()) <= now);
  const ev = events.filter((e) => inYear(new Date(e.started_at)));
  return {
    year,
    from,
    to,
    complete: now >= to,
    milestones: milestones.filter((m) => inYear(parseLocalDate(m.occurred_on))),
    months,
    counts: {
      memories: mems.length,
      photos: mems.filter((m) => m.hasPhoto).length,
      feeds: ev.filter((e) => e.kind === 'feed').length,
      diapers: ev.filter((e) => e.kind === 'diaper').length,
    },
  };
}
