import { serviceUrl } from '@/api/real/http/servicePaths.ts';
import { toApiError } from '@/api/real/http/apiError.ts';

/**
 * Isolated caller for the four auth-service endpoints declared
 * `security: basicAuth` — `/oauth2/otp`, `/oauth2/token`, `/oauth2/revoke`,
 * `/oauth2/introspect` (api-integration.md §1.3). Going direct to the
 * gateway (no BFF, per §0's topology decision) means those client
 * credentials have to ship inside the mini app bundle, where anyone can
 * read them — a known-bad interim state, flagged as question B1. Kept in
 * this one file and never referenced anywhere else, so once B1 is answered
 * (a public/PKCE client, or a thin proxy) swapping the auth model is a
 * one-file change instead of a grep-and-replace across every call site.
 */
const BASIC = import.meta.env.VITE_AUTH_BASIC ?? '';

if (BASIC && import.meta.env.PROD) {
  console.warn(
    '[SECURITY] VITE_AUTH_BASIC is set in a production build — OAuth client '
    + 'credentials are shipping inside the bundle. See api-integration.md §1.3 (question B1).',
  );
}

function requestId(): string {
  return crypto.randomUUID();
}

/** POST with `Authorization: Basic <client:secret>` — used only by the four oauth2/* endpoints above. */
export async function authBasicFetch<T>(path: string, body: BodyInit, contentType: string): Promise<T> {
  if (!BASIC) {
    // Backend-confirmed failure mode: an empty/missing Basic header gets rejected by
    // Spring's client check before the request body (grant_type/otp/transactionId) is
    // even looked at — surfacing as an opaque 401 with no OTP-related detail. Fail loud
    // here instead, since VITE_AUTH_BASIC missing from .env is a much more likely cause
    // than a genuine credentials error.
    throw new Error('VITE_AUTH_BASIC is not set — cannot call ' + path + ' (see .env.example).');
  }
  const reqId = requestId();
  const res = await fetch(serviceUrl('auth', path), {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Authorization: `Basic ${BASIC}`,
      'x-request-id': reqId,
    },
    body,
  });

  if (!res.ok) {
    throw await toApiError(res, reqId);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

/** `application/x-www-form-urlencoded` body helper for `/oauth2/token`. */
export function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}
