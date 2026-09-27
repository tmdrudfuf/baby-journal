// Crash and error reporting (M10). Like analytics: one sink, swapped when a provider is chosen
// (needs an account decision). Reports carry the error name, message and stack only; never journal
// content, names or photos — callers must not put user data into error messages.
type ErrorSink = (error: Error, context: string) => void;

let sink: ErrorSink = (error, context) => console.warn(`[monitoring] ${context}:`, error.message);

export function setErrorSink(next: ErrorSink) {
  sink = next;
}

export function reportError(error: unknown, context: string) {
  try {
    sink(error instanceof Error ? error : new Error(String(error)), context);
  } catch {
    // Reporting must never break the app.
  }
}

// Uncaught JS errors (outside React rendering) also reach the sink; the default handler still runs.
const g = globalThis as { ErrorUtils?: { getGlobalHandler(): (e: Error, fatal?: boolean) => void; setGlobalHandler(h: (e: Error, fatal?: boolean) => void): void } };
const previous = g.ErrorUtils?.getGlobalHandler();
g.ErrorUtils?.setGlobalHandler((error, fatal) => {
  reportError(error, fatal ? 'fatal' : 'uncaught');
  previous?.(error, fatal);
});
