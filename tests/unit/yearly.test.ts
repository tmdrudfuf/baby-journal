import { buildYearStory, yearRange } from '@/lib/yearly';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();
const mem = (iso: string, o = {}) => ({ id: iso, occurred_at: iso, hasPhoto: true, text: 'x', milestone: null, ...o });

test('year N runs birthday to birthday', () => {
  const { from, to } = yearRange('2026-09-01', 1);
  expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([2026, 8, 1]);
  expect([to.getFullYear(), to.getMonth(), to.getDate()]).toEqual([2027, 8, 1]);
});

test('first year story: months of life, milestones, counts; only months that started', () => {
  const s = buildYearStory(
    '2026-09-01',
    1,
    new Date(2026, 10, 15), // 2.5 months in
    [mem(at(2026, 8, 3)), mem(at(2026, 9, 5), { hasPhoto: false }), mem(at(2025, 1, 1))],
    [{ title: 'First smile', occurred_on: '2026-10-05' }, { title: 'Before birth', occurred_on: '2026-08-01' }],
    [{ kind: 'feed', started_at: at(2026, 8, 2) }, { kind: 'diaper', started_at: at(2026, 8, 2) }, { kind: 'feed', started_at: at(2027, 9, 1) }],
  );
  expect(s.complete).toBe(false);
  expect(s.months.map((m) => m.index)).toEqual([1, 2, 3]);
  expect(s.months[0].highlight?.occurred_at).toBe(at(2026, 8, 3));
  expect(s.months[2].highlight).toBeNull();
  expect(s.milestones.map((m) => m.title)).toEqual(['First smile']);
  expect(s.counts).toEqual({ memories: 2, photos: 1, feeds: 1, diapers: 1 });
});
