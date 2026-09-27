// Pure retry policy for the upload queue. A memory is never dropped; it just waits longer.
const BASE_MS = 5_000;
const MAX_MS = 30 * 60_000;

export function retryDelayMs(attempts: number): number {
  return Math.min(BASE_MS * 2 ** Math.max(0, attempts - 1), MAX_MS);
}

export function isDue(nextAttemptAt: number, now: number, force = false): boolean {
  return force || nextAttemptAt <= now;
}

// Thrown when an item can never succeed as-is (e.g. deleted by another family member).
export class PermanentError extends Error {}

// Postgres codes that retrying cannot fix: RLS/permission, missing reference, check/not-null, bad input.
const PERMANENT_CODES = new Set(['42501', '23503', '23514', '23502', '22P02']);

// Network failures, timeouts, 401 (token refresh fixes it), 408/429 and 5xx stay retryable.
export function isPermanent(e: unknown): boolean {
  if (e instanceof PermanentError) return true;
  const err = e as { code?: unknown; context?: { status?: unknown } } | null;
  if (typeof err?.code === 'string' && PERMANENT_CODES.has(err.code)) return true;
  const status = err?.context?.status; // supabase-js FunctionsHttpError carries the Response
  return typeof status === 'number' && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}
