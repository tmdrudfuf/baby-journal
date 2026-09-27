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
