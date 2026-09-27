// Pure tracker helpers (no native imports) so they are unit-testable.
export type EventKind = 'feed' | 'sleep' | 'diaper' | 'growth';

export type TrackerEvent = {
  kind: EventKind;
  started_at: string;
  ended_at: string | null;
  data: Record<string, unknown>;
};

export type DaySummary = { feeds: number; sleepMinutes: number; diapers: number; sleeping: boolean };

// Counts events in the local calendar day containing `day`. Sleep is clipped to the day,
// so a nap across midnight is split between both days; an ongoing sleep counts up to `now`.
export function summarizeDay(events: TrackerEvent[], day: Date, now: Date): DaySummary {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = start + 86_400_000;
  const inDay = (iso: string) => {
    const t = Date.parse(iso);
    return t >= start && t < end;
  };
  let sleepMs = 0;
  let sleeping = false;
  for (const e of events) {
    if (e.kind !== 'sleep') continue;
    const s = Date.parse(e.started_at);
    const f = e.ended_at ? Date.parse(e.ended_at) : now.getTime();
    if (!e.ended_at) sleeping = true;
    sleepMs += Math.max(0, Math.min(f, end) - Math.max(s, start));
  }
  return {
    feeds: events.filter((e) => e.kind === 'feed' && inDay(e.started_at)).length,
    diapers: events.filter((e) => e.kind === 'diaper' && inDay(e.started_at)).length,
    sleepMinutes: Math.round(sleepMs / 60_000),
    sleeping,
  };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const FEED: Record<string, string> = { breast: 'Breastfeed', bottle: 'Bottle', solid: 'Solid food' };
const SIDE: Record<string, string> = { left: 'left', right: 'right' };
const DIAPER: Record<string, string> = { wet: 'Wet diaper', dirty: 'Dirty diaper', both: 'Wet + dirty diaper' };

// One-line human description, e.g. "Bottle · 120 ml", "Sleep · 1h 20m".
export function describe(e: TrackerEvent, now: Date): string {
  const d = e.data;
  switch (e.kind) {
    case 'feed': {
      const parts = [FEED[String(d.method)] ?? 'Feed'];
      if (d.side && SIDE[String(d.side)]) parts[0] += ` (${SIDE[String(d.side)]})`;
      if (typeof d.amount_ml === 'number') parts.push(`${d.amount_ml} ml`);
      return parts.join(' · ');
    }
    case 'sleep': {
      const mins = Math.round(((e.ended_at ? Date.parse(e.ended_at) : now.getTime()) - Date.parse(e.started_at)) / 60_000);
      return e.ended_at ? `Sleep · ${formatDuration(mins)}` : `Sleeping · ${formatDuration(mins)} so far`;
    }
    case 'diaper':
      return DIAPER[String(d.type)] ?? 'Diaper';
    case 'growth': {
      const parts = [];
      if (typeof d.weight_kg === 'number') parts.push(`${d.weight_kg} kg`);
      if (typeof d.height_cm === 'number') parts.push(`${d.height_cm} cm`);
      if (typeof d.head_cm === 'number') parts.push(`head ${d.head_cm} cm`);
      return `Growth · ${parts.join(', ') || 'measured'}`;
    }
  }
}

// Parses a user-typed measurement ("3,4" or "3.4"); null when empty or out of range.
export function parseMeasure(text: string, max: number): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
}
