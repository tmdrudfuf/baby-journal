import { dayNumber, greeting, localDayKey, parseLocalDate } from '@/lib/dates';
import { isDue, retryDelayMs } from '@/lib/sync-policy';

test('birth day is day 1, next day is day 2', () => {
  expect(dayNumber('2026-03-26', new Date(2026, 2, 26, 0, 1))).toBe(1);
  expect(dayNumber('2026-03-26', new Date(2026, 2, 26, 23, 59))).toBe(1);
  expect(dayNumber('2026-03-26', new Date(2026, 2, 27, 0, 0))).toBe(2);
});

test('184 days together', () => {
  expect(dayNumber('2026-03-26', new Date(2026, 8, 25, 12))).toBe(184);
});

test('local date parsing is not shifted by UTC', () => {
  const d = parseLocalDate('2026-01-01');
  expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 1]);
  expect(localDayKey(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
});

test('greeting follows local hour', () => {
  expect(greeting(new Date(2026, 0, 1, 3))).toBe('Hello');
  expect(greeting(new Date(2026, 0, 1, 8))).toBe('Good morning');
  expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
});

test('retry backoff grows and caps at 30 minutes', () => {
  expect(retryDelayMs(1)).toBe(5_000);
  expect(retryDelayMs(2)).toBe(10_000);
  expect(retryDelayMs(50)).toBe(30 * 60_000);
  expect(isDue(1000, 999)).toBe(false);
  expect(isDue(1000, 999, true)).toBe(true);
});
