// All "day" logic uses the device's local calendar, never UTC (a 3 AM memory belongs to that local day).

export function localDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

// Parses 'YYYY-MM-DD' as a local calendar date (new Date('YYYY-MM-DD') would be UTC midnight).
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Day 1 is the birth day.
export function dayNumber(birthDate: string, now: Date): number {
  const birth = parseLocalDate(birthDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Round to absorb DST hour shifts.
  return Math.round((today.getTime() - birth.getTime()) / 86_400_000) + 1;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Hello';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// "On This Day" (§18): same calendar day in earlier years, plus earlier months during the first
// year (monthiversaries matter most for new parents). Returns a label, or null if not a match.
// A 31st matches only months that have a 31st.
export function onThisDayLabel(iso: string, now: Date): string | null {
  const d = new Date(iso);
  if (d.getDate() !== now.getDate()) return null;
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months <= 0) return null;
  if (months % 12 === 0) return months === 12 ? 'One year ago today' : `${months / 12} years ago today`;
  if (months < 12) return months === 1 ? 'One month ago today' : `${months} months ago today`;
  return null;
}

// Human age on a given date: "3 weeks old" in the first month, then months, then years.
export function ageLabel(birthDate: string, on: Date): string | null {
  const days = dayNumber(birthDate, on) - 1;
  if (days < 0) return null;
  if (days < 7) return days <= 1 ? 'newborn' : `${days} days old`;
  const birth = parseLocalDate(birthDate);
  let months = (on.getFullYear() - birth.getFullYear()) * 12 + (on.getMonth() - birth.getMonth());
  if (on.getDate() < birth.getDate()) months--;
  if (months < 1) return `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'week' : 'weeks'} old`;
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'} old`;
  return `${Math.floor(months / 12)} years old`;
}
