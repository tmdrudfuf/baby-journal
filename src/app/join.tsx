// Deep link target: babyjournal://join?code=... Keeps the code until the user is signed in and
// on the onboarding screen, which then opens "Join with an invite code" pre-filled.
import { Redirect, useLocalSearchParams } from 'expo-router';

import { PENDING_INVITE_KEY, useApp } from '@/state/app';

export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { status } = useApp();
  if (code && /^[0-9a-f]{32,128}$/i.test(code)) {
    try {
      localStorage.setItem(PENDING_INVITE_KEY, code);
    } catch {
      // storage unavailable: the user can still paste the code
    }
  }
  // Go straight to the screen this user can use now (protected routes would bounce otherwise).
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'needsBaby') return <Redirect href="/onboarding" />;
  return <Redirect href="/" />;
}
