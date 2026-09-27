import { monthKey, monthsWithMemories, selectHighlights, type Candidate } from '@/lib/monthly';

const c = (day: number, hour: number, o: Partial<Candidate> = {}): Candidate => ({
  id: `${day}-${hour}`,
  occurred_at: new Date(2026, 8, day, hour).toISOString(), // local time: days are local calendar days
  hasPhoto: false,
  text: 'note',
  milestone: null,
  ...o,
});

test('milestones always included; one best moment per day; chronological', () => {
  const picked = selectHighlights([
    c(3, 9, { text: 'short' }),
    c(3, 10, { hasPhoto: true }), // beats the note on the same day
    c(5, 8, { milestone: 'First smile' }),
    c(5, 9, { hasPhoto: true }),
    c(7, 9, { text: null }), // nothing to show
  ]);
  expect(picked.map((p) => p.id)).toEqual(['3-10', '5-8', '5-9']);
});

test('spreads picks across the month when there are too many days', () => {
  const many = Array.from({ length: 30 }, (_, i) => c(i + 1, 12, { hasPhoto: true }));
  const picked = selectHighlights(many, 5);
  expect(picked).toHaveLength(5);
  expect(picked.map((p) => Number(p.id.split('-')[0]))).toEqual([1, 7, 13, 19, 25]);
});

test('months list is unique, newest first', () => {
  expect(monthsWithMemories(['2026-08-26T10:00:00Z', '2026-09-01T10:00:00Z', '2026-09-20T10:00:00Z'])).toEqual([
    monthKey(new Date('2026-09-20T10:00:00Z')),
    monthKey(new Date('2026-08-26T10:00:00Z')),
  ]);
});
