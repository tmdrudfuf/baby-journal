// Session + current family/baby. Cached locally so the app opens offline.
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import * as local from '@/lib/local-db';
import { deleteAllLocalFiles } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/lib/sync';

export type Baby = { id: string; family_id: string; name: string; birth_date: string | null; family_name: string };
type Status = 'loading' | 'signedOut' | 'needsBaby' | 'ready' | 'error';

type AppContext = {
  status: Status;
  session: Session | null;
  baby: Baby | null;
  setBaby: (baby: Baby) => void;
  refresh: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AppContext | null>(null);
const CACHE_KEY = 'current-baby';

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
  // Cache first so the app opens offline; the server answer replaces it when it arrives.
  const baby = fresh?.baby ?? (userId ? readCache(userId) : null);
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
    supabase
      .from('babies')
      .select('id, family_id, name, birth_date, families(name)')
      .order('created_at')
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setRemote({ userId, baby: null, error: true });
        const row = data[0];
        if (!row) return setRemote({ userId, baby: null });
        setBaby({ id: row.id, family_id: row.family_id, name: row.name, birth_date: row.birth_date, family_name: row.families?.name ?? '' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt, setBaby]);

  // Sync on launch, on foreground and whenever connectivity returns.
  const babyId = baby?.id;
  useEffect(() => {
    if (!babyId) return;
    syncNow(babyId);
    const app = AppState.addEventListener('change', (s) => s === 'active' && syncNow(babyId));
    let wasOnline = true;
    const net = NetInfo.addEventListener((s) => {
      const online = !!s.isConnected;
      if (online && !wasOnline) syncNow(babyId, { force: true });
      wasOnline = online;
    });
    return () => {
      app.remove();
      net();
    };
  }, [babyId]);

  const signOut = useCallback(async () => {
    if (local.pendingCount() > 0) {
      throw new Error('Some memories have not uploaded yet. Connect to the internet and try again.');
    }
    await supabase.auth.signOut();
    // Private by default: nothing from this account stays on the device.
    local.wipe();
    deleteAllLocalFiles();
    if (userId) localStorage.removeItem(`${CACHE_KEY}:${userId}`);
  }, [userId]);

  return (
    <Ctx.Provider
      value={{ status, session: session ?? null, baby, setBaby, refresh: () => setAttempt((a) => a + 1), signOut }}>
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
