import type { Client, IMessage } from '@stomp/stompjs';

import { ensureFreshAccessToken } from '@/api/real/http/tokenStore.ts';

/**
 * BRCE-4023 §9: STOMP over SockJS on `/ws`, the web cabinet's address, `Authorization: Bearer` in
 * CONNECT. Two subscriptions: `wallet-changed` (re-read balances) and `notifications`
 * (`OPERATION_STATUS_CHANGED` → re-read the deal, `VERIFICATION_LEVEL_CHANGED` → re-issue the token).
 * Delivery isn't guaranteed, so screens keep polling — less often while this is connected.
 */
export type RealtimeEvent =
  | { type: 'wallet-changed' }
  | { type: 'operation-status'; operationId: string; status?: string }
  | { type: 'verification-level' };

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();
const connectionListeners = new Set<(connected: boolean) => void>();
let connected = false;
let client: Client | null = null;
let starting = false;

/** `VITE_WS_URL` is the full SockJS endpoint; by default it's `/ws` on the API gateway. */
export function realtimeUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) {
    return explicit;
  }
  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  return `${base.replace(/\/$/, '')}/ws`;
}

function setConnected(value: boolean): void {
  if (connected === value) {
    return;
  }
  connected = value;
  connectionListeners.forEach((listener) => listener(value));
}

function emit(event: RealtimeEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('[realtime] listener failed', err);
    }
  });
}

interface RawNotification {
  notificationType?: string;
  operationId?: string;
  status?: string;
}

/** `{ notification: { notificationType, … } }` per the ws-1 swagger; a bare notification is accepted too. */
function onNotification(message: IMessage): void {
  let body: { notification?: RawNotification } & RawNotification;
  try {
    body = JSON.parse(message.body) as typeof body;
  } catch {
    console.warn('[realtime] notification is not JSON');
    return;
  }
  const notification = body.notification ?? body;
  if (notification.notificationType === 'OPERATION_STATUS_CHANGED' && notification.operationId) {
    emit({ type: 'operation-status', operationId: notification.operationId, status: notification.status });
  } else if (notification.notificationType === 'VERIFICATION_LEVEL_CHANGED') {
    emit({ type: 'verification-level' });
  }
}

/** Idempotent; connects in the background and reconnects on its own with a growing delay. */
export async function startRealtime(): Promise<void> {
  if (client || starting) {
    return;
  }
  starting = true;
  try {
    const [{ Client: StompClient, ReconnectionTimeMode }, { default: SockJS }] = await Promise.all([
      import('@stomp/stompjs'),
      import('sockjs-client/dist/sockjs.min.js'),
    ]);
    const stomp = new StompClient({
      webSocketFactory: () => new SockJS(realtimeUrl()),
      reconnectDelay: 2_000,
      maxReconnectDelay: 60_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      beforeConnect: async () => {
        // A token that expired while disconnected is re-issued here, so every reconnect signs in afresh.
        const token = await ensureFreshAccessToken();
        stomp.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect: () => {
        stomp.subscribe('/user/topic/private/wallet-changed', () => emit({ type: 'wallet-changed' }));
        stomp.subscribe('/user/topic/private/notifications', onNotification);
        setConnected(true);
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) => {
        console.warn('[realtime] STOMP error:', frame.headers.message);
        setConnected(false);
      },
    });
    client = stomp;
    stomp.activate();
  } catch (err) {
    console.error('[realtime] could not start', err);
  } finally {
    starting = false;
  }
}

export async function stopRealtime(): Promise<void> {
  const current = client;
  client = null;
  setConnected(false);
  await current?.deactivate();
}

export function isRealtimeConnected(): boolean {
  return connected;
}

export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeRealtimeConnection(listener: (connected: boolean) => void): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}
