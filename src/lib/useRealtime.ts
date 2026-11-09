import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  USE_REAL_API,
  invalidateUser,
  isRealtimeConnected,
  reissueToken,
  startRealtime,
  stopRealtime,
  subscribeRealtime,
  subscribeRealtimeConnection,
} from '@/api/index.ts';
import type { RealtimeEvent } from '@/api/index.ts';
import { useSessionStore } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';

/** Whether the STOMP connection is up — screens poll less often while it is (BRCE-4023 §9). */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(subscribeRealtimeConnection, isRealtimeConnected);
}

/** Calls the latest `listener` for every realtime event while the component is mounted. */
export function useRealtimeEvent(listener: (event: RealtimeEvent) => void): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => subscribeRealtime((event) => listenerRef.current(event)), []);
}

/**
 * Mounted once in the shell: connects while there is a session, and handles what concerns the whole
 * app — a balance change re-reads every balance on screen, a new verification level needs a new token
 * (the old one keeps the old `level`) and a fresh look at the OTC gate.
 */
export function useRealtimeLifecycle(): void {
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    if (!USE_REAL_API) {
      return;
    }
    if (session) {
      void startRealtime();
    } else {
      void stopRealtime();
    }
  }, [session]);

  useRealtimeEvent((event) => {
    if (event.type === 'wallet-changed') {
      useUiStore.getState().bumpBalancesVersion();
    } else if (event.type === 'verification-level') {
      void reissueToken()
        .then(() => {
          invalidateUser();
          useUiStore.getState().bumpUserVersion();
        })
        .catch((err: unknown) => console.error('[realtime] token re-issue after a level change failed', err));
    }
  });
}
