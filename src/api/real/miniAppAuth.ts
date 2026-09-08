import { serviceUrl } from '@/api/real/http/servicePaths.ts';
import { toApiError } from '@/api/real/http/apiError.ts';

const CLIENT_ID = import.meta.env.VITE_TELEGRAM_MINI_APP_CLIENT_ID ?? '';

export interface MiniAppAuthResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * `POST /telegram-mini-apps/{clientId}/authenticate` (`auth` service) —
 * backend-confirmed Telegram-binding flow, replacing the earlier
 * `x-telegram-init-data`-on-first-request approach (§2.4) entirely: that
 * header and `markInitDataBindPending()` are gone, not just unused.
 *
 * Called two ways:
 *  - No `bearerToken` — silent re-entry. If this Telegram identity is
 *    already bound to a platform account, the backend returns a mini app
 *    access token straight away; this is tried on every cold boot before
 *    showing the login screen at all (`index.tsx`).
 *  - `bearerToken` set to a freshly-obtained platform JWT (from the
 *    standard email+password+OTP flow, §2.1) — creates the binding and
 *    returns the same shape. That platform JWT is used for this one call
 *    only and then discarded; it is never saved as the session token (see
 *    `SignIn.tsx`).
 *
 * `initData` must be read fresh immediately before each call, never reused
 * — same TTL concern as the old flow (`telegram/initData.ts`).
 *
 * Two things aren't nailed down in what was relayed, so both are
 * assumptions isolated to this one function: the success response's exact
 * field names (assumed camelCase `accessToken`/`expiresIn`, matching
 * `exchangeSocialCode`'s own shape), and the exact signal for "not bound
 * yet" (any non-2xx here is read that way — see the one caller in
 * `index.tsx` — rather than switched on a specific status/code, since none
 * was specified).
 */
export async function authenticateMiniApp(initData: string, bearerToken?: string): Promise<MiniAppAuthResult> {
  const reqId = crypto.randomUUID();
  const res = await fetch(serviceUrl('auth', `/public/telegram-mini-apps/${CLIENT_ID}/authenticate`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': reqId,
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok) {
    throw await toApiError(res, reqId);
  }
  return res.json() as Promise<MiniAppAuthResult>;
}
