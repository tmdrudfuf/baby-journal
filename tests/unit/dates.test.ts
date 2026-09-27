import { dayNumber, greeting, localDayKey, onThisDayLabel, parseLocalDate } from '@/lib/dates';
import { isDue, isPermanent, PermanentError, retryDelayMs } from '@/lib/sync-policy';

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

test('permanent vs retryable sync errors', () => {
  expect(isPermanent({ code: '42501', message: 'row-level security' })).toBe(true);
  expect(isPermanent({ code: '23503' })).toBe(true);
  expect(isPermanent(new PermanentError('deleted elsewhere'))).toBe(true);
  expect(isPermanent({ context: { status: 403 } })).toBe(true);
  expect(isPermanent({ context: { status: 401 } })).toBe(false);
  expect(isPermanent({ context: { status: 503 } })).toBe(false);
  expect(isPermanent(new TypeError('Network request failed'))).toBe(false);
  expect(isPermanent({ code: '40001' })).toBe(false);
});

test('on this day: yearly always, monthly only in the first year', () => {
  const now = new Date(2027, 8, 26, 9);
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 20).toISOString();
  expect(onThisDayLabel(at(2026, 8, 26), now)).toBe('One year ago today');
  expect(onThisDayLabel(at(2025, 8, 26), now)).toBe('2 years ago today');
  expect(onThisDayLabel(at(2027, 7, 26), now)).toBe('One month ago today');
  expect(onThisDayLabel(at(2027, 2, 26), now)).toBe('6 months ago today');
  expect(onThisDayLabel(at(2026, 10, 26), now)).toBe('10 months ago today');
  expect(onThisDayLabel(at(2027, 8, 26), now)).toBeNull(); // today itself
  expect(onThisDayLabel(at(2027, 8, 25), now)).toBeNull();
  expect(onThisDayLabel(at(2025, 11, 26), now)).toBeNull(); // 21 months: not a year boundary
});
