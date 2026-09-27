// Pure retry policy for the upload queue. A memory is never dropped; it just waits longer.
const BASE_MS = 5_000;
const MAX_MS = 30 * 60_000;

export function retryDelayMs(attempts: number): number {
  return Math.min(BASE_MS * 2 ** Math.max(0, attempts - 1), MAX_MS);
}

export function isDue(nextAttemptAt: number, now: number, force = false): boolean {
  return force || nextAttemptAt <= now;
}
