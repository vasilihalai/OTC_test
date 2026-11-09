import type { OtcAccessReason } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { ensureFreshAccessToken } from '@/api/real/http/tokenStore.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';
import { type OtcAvailability, toOtcAccessReason } from '@/lib/otcAccess.ts';

export interface TokenClaims {
  /** Backend-confirmed source of truth for individual vs business. */
  accountType?: string;
  /** Verification level: 0, 1, 2 for individuals, 0 or 1 for businesses. Changes only with a new token. */
  level?: number;
}

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** The current access token's claims; empty when there's no token or it can't be read. */
export async function tokenClaims(): Promise<TokenClaims> {
  const payload = (await ensureFreshAccessToken())?.split('.')[1];
  if (!payload) {
    return {};
  }
  try {
    const claims = decodeSegment(payload) as { accountType?: unknown; level?: unknown };
    const level = claims.level === undefined || claims.level === null ? undefined : Number(claims.level);
    return {
      accountType: typeof claims.accountType === 'string' ? claims.accountType : undefined,
      level: Number.isFinite(level) ? level : undefined,
    };
  } catch (err) {
    console.error('[access] token claims unreadable', err);
    return {};
  }
}

/** `GET /v1/features/availability`, the `OTC` row. */
async function fetchOtcAvailability(): Promise<OtcAvailability | undefined> {
  const res = await apiFetch<{ result?: { items?: { code: string; available: boolean; reason?: string | null }[] } }>(
    '/v1/features/availability', {}, false, 'financial',
  );
  const items = res.result?.items;
  if (!Array.isArray(items)) {
    console.error('[access] unexpected /v1/features/availability shape', describeShape(res));
    throw new Error('Unexpected availability response shape');
  }
  const row = items.find((item) => item.code === 'OTC');
  if (!row) {
    console.warn('[access] no OTC row in /v1/features/availability');
    return undefined;
  }
  return { available: row.available, reason: row.reason ?? undefined };
}

/** `GET /v1/features/access` — `OTC_ENABLED` when the flag is on and KYC is passed. */
async function fetchFeatures(): Promise<string[]> {
  const res = await apiFetch<{ result?: { features?: string[] } }>('/v1/features/access', {}, false, 'financial');
  const features = res.result?.features;
  if (!Array.isArray(features)) {
    console.error('[access] unexpected /v1/features/access shape', describeShape(res));
    throw new Error('Unexpected features response shape');
  }
  return features;
}

/**
 * BRCE-4023 §8. `/v1/otc/access` has no `enabled`/`available`/`reasons`, so it's no longer read. The
 * level check needs no request; the two feature calls go out together.
 */
export async function getOtcAccessReason(level: number | undefined): Promise<OtcAccessReason> {
  if (level === 0) {
    return 'VERIFICATION_REQUIRED';
  }
  const [availability, features] = await Promise.all([fetchOtcAvailability(), fetchFeatures()]);
  return toOtcAccessReason({ level, availability, features });
}
