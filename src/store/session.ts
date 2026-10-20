import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { getUser } from '@/api/index.ts';
import type { Session } from '@/api/types.ts';
import { clearTokens } from '@/api/real/http/tokenStore.ts';

interface SessionStore {
  session: Session | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

/**
 * `session` (email/clientType only — no token, see `Session`'s own doc
 * comment) persists across reloads via its own `localStorage` slot,
 * independent of `tokenStore`'s. The two are complementary: on a fresh page
 * load, `session` rehydrates instantly and synchronously here, while
 * `tokenStore.hydrateTokensFromStorage()` (called once at boot, real mode
 * only) separately restores the actual credential. `clearSession` clears
 * both — it's the single "log this device out locally" action, used both by
 * an explicit sign-out and by `http.ts`'s failed-refresh fallback.
 */
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => {
        clearTokens();
        set({ session: null });
      },
    }),
    { name: 'xruby-session' },
  ),
);

/** Bounces to /login if there's no active session (e.g. direct navigation, sign-out, reload). */
export function useRequireSession(): Session | null {
  const session = useSessionStore((s) => s.session);
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
    }
  }, [session, navigate]);

  return session;
}

/** Redirects to `/otc-unavailable` when the account's OTC access isn't granted. */
export function useRequireOtcAccess(): void {
  const session = useSessionStore((s) => s.session);
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      return;
    }
    let cancelled = false;
    void getUser(session.clientType).then((user) => {
      if (!cancelled && user.otcAccess !== 'GRANTED') {
        navigate('/otc-unavailable', { replace: true, state: { otcAccess: user.otcAccess } });
      }
    }).catch((err: unknown) => {
      // The screen's own load surfaces the failure; don't redirect on a guess.
      console.error('[session] OTC access check failed', err);
    });
    return () => {
      cancelled = true;
    };
  }, [session, navigate]);
}
