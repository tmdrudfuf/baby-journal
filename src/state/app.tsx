// Session + current family/baby. Cached locally so the app opens offline.
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import * as local from '@/lib/local-db';
import { deleteAllLocalFiles, deleteLocalFiles } from '@/lib/media';
import { getReminder, setReminder } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/lib/sync';

export type Role = 'viewer' | 'contributor' | 'caregiver' | 'owner';
export type Baby = { id: string; family_id: string; name: string; birth_date: string | null; family_name: string; role: Role };

const RANK: Record<Role, number> = { viewer: 0, contributor: 1, caregiver: 2, owner: 3 };
export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];
type Status = 'loading' | 'signedOut' | 'needsBaby' | 'ready' | 'error';

type AppContext = {
  status: Status;
  session: Session | null;
  baby: Baby | null;
  refresh: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<AppContext | null>(null);
const CACHE_KEY = 'current-baby';
// Invite code from a babyjournal://join link, kept until the join succeeds.
export const PENDING_INVITE_KEY = 'pending-invite';

function readCache(userId: string): Baby | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as Baby) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Server answer for a user: their baby, none yet, or unreachable.
  const [remote, setRemote] = useState<{ userId: string; baby: Baby | null; error?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const fresh = remote?.userId === userId ? remote : null;
  // Cache first so the app opens offline; a successful server answer (even "no baby", e.g. after
  // being removed from the family) always wins over the cache.
  const baby = fresh && !fresh.error ? fresh.baby : (fresh?.baby ?? (userId ? readCache(userId) : null));
  const status: Status =
    session === undefined ? 'loading'
    : !userId ? 'signedOut'
    : baby ? 'ready'
    : !fresh ? 'loading'
    : fresh.error ? 'error'
    : 'needsBaby';

  const setBaby = useCallback(
    (b: Baby) => {
      if (!userId) return;
      localStorage.setItem(`${CACHE_KEY}:${userId}`, JSON.stringify(b));
      setRemote({ userId, baby: b });
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      supabase.from('babies').select('id, family_id, name, birth_date, families(name)').order('created_at').limit(1),
      supabase.from('family_members').select('family_id, role').eq('user_id', userId).is('revoked_at', null),
    ]).then(([babies, members]) => {
      if (cancelled) return;
      if (babies.error || members.error) return setRemote({ userId, baby: null, error: true });
      const row = babies.data[0];
      const role = members.data.find((m) => m.family_id === row?.family_id)?.role;
      if (!row || !role) {
        // Removed from the family (or never joined): drop what this device held for it (§37).
        if (readCache(userId)) local.wipeSynced().forEach(deleteLocalFiles);
        localStorage.removeItem(`${CACHE_KEY}:${userId}`);
        return setRemote({ userId, baby: null });
      }
      setBaby({ id: row.id, family_id: row.family_id, name: row.name, birth_date: row.birth_date, family_name: row.families?.name ?? '', role });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt, setBaby]);

  // Sync on launch, on foreground and whenever connectivity returns.
  const babyId = baby?.id;
  const familyId = baby?.family_id;
  useEffect(() => {
    if (!babyId) return;
    syncNow(babyId);
    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      syncNow(babyId);
      setAttempt((a) => a + 1); // pick up role changes
    });
    // Other family members' changes arrive live; RLS filters what we receive.
    const channel = supabase
      .channel(`family:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `family_id=eq.${familyId}` }, () =>
        syncNow(babyId),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_events', filter: `family_id=eq.${familyId}` }, () =>
        syncNow(babyId),
      )
      .subscribe();
    let wasOnline = true;
    const net = NetInfo.addEventListener((s) => {
      const online = !!s.isConnected;
      if (online && !wasOnline) syncNow(babyId, { force: true });
      wasOnline = online;
    });
    return () => {
      app.remove();
      net();
      supabase.removeChannel(channel);
    };
  }, [babyId, familyId]);

  const signOut = useCallback(async () => {
    if (local.pendingCount() > 0) {
      throw new Error('Some memories have not uploaded yet. Connect to the internet and try again.');
    }
    await supabase.auth.signOut();
    // Private by default: nothing from this account stays on the device.
    local.wipe();
    setReminder({ ...getReminder(), enabled: false }).catch(() => undefined);
    deleteAllLocalFiles();
    if (userId) localStorage.removeItem(`${CACHE_KEY}:${userId}`);
  }, [userId]);

  // Permanent (§37): sole-owned families, their memories and photos are deleted server-side.
  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.functions.invoke('media-sign', { body: { action: 'delete_account' } });
    if (error) throw new Error('Could not delete your account. Check your connection and try again.');
    local.wipe();
    deleteAllLocalFiles();
    setReminder({ ...getReminder(), enabled: false }).catch(() => undefined);
    if (userId) localStorage.removeItem(`${CACHE_KEY}:${userId}`);
    await supabase.auth.signOut({ scope: 'local' }); // the server session is already gone
  }, [userId]);

  return (
    <Ctx.Provider
      value={{ status, session: session ?? null, baby, refresh: () => setAttempt((a) => a + 1), signOut, deleteAccount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}

// Screens behind the `ready` guard always have a baby.
export function useBaby(): Baby {
  const { baby } = useApp();
  if (!baby) throw new Error('useBaby before onboarding');
  return baby;
}
