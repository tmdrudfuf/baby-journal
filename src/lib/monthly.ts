// Monthly Memories (§20, §64): pick a small, varied set of highlights for one month. Pure, no AI.
import { localDayKey } from '@/lib/dates';

export type Candidate = {
  id: string;
  occurred_at: string;
  hasPhoto: boolean;
  text: string | null;
  milestone: string | null; // confirmed milestone title
};

export const MAX_HIGHLIGHTS = 12;

// Every confirmed milestone first, then at most one moment per day (photos and longer notes win),
// spread evenly across the month, shown in chronological order.
export function selectHighlights(candidates: Candidate[], max = MAX_HIGHLIGHTS): Candidate[] {
  const score = (c: Candidate) => (c.hasPhoto ? 2 : 0) + Math.min((c.text?.length ?? 0) / 80, 1);
  const milestones = candidates.filter((c) => c.milestone);
  const bestPerDay = new Map<string, Candidate>();
  for (const c of candidates) {
    if (c.milestone) continue;
    const day = localDayKey(new Date(c.occurred_at));
    const cur = bestPerDay.get(day);
    if (!cur || score(c) > score(cur)) bestPerDay.set(day, c);
  }
  const days = [...bestPerDay.values()].filter((c) => c.hasPhoto || c.text).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const room = Math.max(0, max - milestones.length);
  // Even spread: take every k-th day rather than the first N.
  const picked = days.length <= room ? days : Array.from({ length: room }, (_, i) => days[Math.floor((i * days.length) / room)]);
  return [...milestones.slice(0, max), ...picked].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

// 'YYYY-MM' keys of months that have at least one memory, newest first.
export function monthsWithMemories(dates: string[]): string[] {
  return [...new Set(dates.map((d) => monthKey(new Date(d))))].sort().reverse();
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthTitle(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
