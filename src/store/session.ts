import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Session } from '@/api/types.ts';
import { clearTokens } from '@/api/real/http/tokenStore.ts';
import { clearQueries } from '@/lib/query.ts';
import { useUser } from '@/lib/queries.ts';

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
 * an explicit sign-out and by `http.ts`'s failed-refresh fallback. It also
 * empties the screens' data cache (`lib/query.ts`), so nothing of this
 * account can show up under the next one.
 */
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => {
        clearTokens();
        clearQueries();
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

/**
 * Redirects to `/otc-unavailable` when the account's OTC access isn't granted. Reads the same user the
 * screen itself shows, so the check costs no request of its own; a failed read doesn't redirect on a
 * guess — the screen's own load surfaces it.
 */
export function useRequireOtcAccess(): void {
  const session = useSessionStore((s) => s.session);
  const navigate = useNavigate();
  const access = useUser(session?.clientType).data?.otcAccess;

  useEffect(() => {
    if (session && access && access !== 'GRANTED') {
      navigate('/otc-unavailable', { replace: true, state: { otcAccess: access } });
    }
  }, [session, access, navigate]);
}
