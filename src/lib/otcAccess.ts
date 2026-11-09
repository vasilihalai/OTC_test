import type { OtcAccessReason } from '@/api/types.ts';

/** The `OTC` row of `GET /v1/features/availability`. */
export interface OtcAvailability {
  available: boolean;
  /** Only when `available` is false: `USER_RESTRICTED` or `SYSTEM_DISABLED`. */
  reason?: string;
}

export interface OtcAccessInputs {
  /** `level` claim of the access token: 0 means no KYC/KYB yet. `undefined` when the token has none. */
  level?: number;
  /** `undefined` when the row is missing. */
  availability?: OtcAvailability;
  /** `result.features` of `GET /v1/features/access`. */
  features: string[];
}

/**
 * BRCE-4023 §8, in the backend's order. The level goes first: without KYC the flag is off by
 * default, and availability would answer USER_RESTRICTED for the same user.
 */
export function toOtcAccessReason({ level, availability, features }: OtcAccessInputs): OtcAccessReason {
  if (level === 0) {
    return 'VERIFICATION_REQUIRED';
  }
  if (availability && !availability.available) {
    return availability.reason === 'SYSTEM_DISABLED' ? 'DESK_CLOSED' : 'NOT_ELIGIBLE';
  }
  if (features.includes('OTC_ENABLED')) {
    return 'GRANTED';
  }
  console.warn('[otc] OTC is available but OTC_ENABLED is missing from features', { level, availability, features });
  return 'NOT_ELIGIBLE';
}
