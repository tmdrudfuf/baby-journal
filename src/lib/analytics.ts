// Product analytics (§43). One place defines every event and what it may carry.
// Privacy rule: properties are numbers, booleans or fixed enums only — never journal text, names,
// photo URLs, baby health data or family messages. The type below makes free text impossible.
type Props = Record<string, number | boolean | 'camera' | 'library' | 'none' | 'feed' | 'sleep' | 'diaper' | 'growth'>;

export type AnalyticsEvent =
  | 'app_opened'
  | 'onboarding_completed'
  | 'capture_opened'
  | 'memory_created'
  | 'photo_added'
  | 'milestone_confirmed'
  | 'family_invited'
  | 'family_joined'
  | 'monthly_story_viewed'
  | 'yearly_story_viewed'
  | 'quick_log';

type Sink = (event: AnalyticsEvent, props: Props) => void;

// No provider is connected yet (needs an account decision). Swap the sink when one is chosen;
// call sites stay the same. ponytail: no batching/offline queue until a provider exists.
let sink: Sink = __DEV__ ? (e, p) => console.log('[analytics]', e, p) : () => undefined;

export function setAnalyticsSink(next: Sink) {
  sink = next;
}

export function track(event: AnalyticsEvent, props: Props = {}) {
  try {
    sink(event, props);
  } catch {
    // Analytics must never break the app (§54).
  }
}
