import { describe as describeEvent, formatDuration, parseMeasure, summarizeDay, type TrackerEvent } from '@/lib/tracker';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).toISOString();
const ev = (kind: TrackerEvent['kind'], started_at: string, ended_at: string | null = null, data = {}): TrackerEvent => ({
  kind,
  started_at,
  ended_at,
  data,
});

test('daily summary counts feeds/diapers in the local day and clips sleep at midnight', () => {
  const events = [
    ev('feed', at(26, 7, 20)),
    ev('feed', at(25, 23)), // yesterday
    ev('diaper', at(26, 9), null, { type: 'wet' }),
    ev('sleep', at(25, 23), at(26, 1)), // 1h after midnight counts today
    ev('sleep', at(26, 13), at(26, 14, 30)),
  ];
  expect(summarizeDay(events, new Date(2026, 8, 26), new Date(2026, 8, 26, 20))).toEqual({
    feeds: 1,
    diapers: 1,
    sleepMinutes: 150,
    sleeping: false,
  });
});

test('ongoing sleep counts up to now and flags sleeping', () => {
  const s = summarizeDay([ev('sleep', at(26, 20))], new Date(2026, 8, 26), new Date(2026, 8, 26, 20, 45));
  expect(s).toMatchObject({ sleepMinutes: 45, sleeping: true });
});

test('descriptions', () => {
  const now = new Date(2026, 8, 26, 12);
  expect(describeEvent(ev('feed', at(26, 7), null, { method: 'bottle', amount_ml: 120 }), now)).toBe('Bottle · 120 ml');
  expect(describeEvent(ev('feed', at(26, 7), null, { method: 'breast', side: 'left' }), now)).toBe('Breastfeed (left)');
  expect(describeEvent(ev('sleep', at(26, 10), at(26, 11, 20)), now)).toBe('Sleep · 1h 20m');
  expect(describeEvent(ev('diaper', at(26, 9), null, { type: 'both' }), now)).toBe('Wet + dirty diaper');
  expect(describeEvent(ev('growth', at(26, 9), null, { weight_kg: 6.2, height_cm: 63 }), now)).toBe('Growth · 6.2 kg, 63 cm');
});

test('durations and measurement parsing', () => {
  expect(formatDuration(45)).toBe('45m');
  expect(formatDuration(120)).toBe('2h');
  expect(formatDuration(135)).toBe('2h 15m');
  expect(parseMeasure('3,45', 30)).toBe(3.45);
  expect(parseMeasure('', 30)).toBeNull();
  expect(parseMeasure('300', 30)).toBeNull();
  expect(parseMeasure('abc', 30)).toBeNull();
});
