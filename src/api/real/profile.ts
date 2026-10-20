import type { ClientType, SecurityLevel, User } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { getOtcAccess } from '@/api/real/otc.ts';
import { toOtcAccessReason } from '@/lib/otcAccess.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';

/**
 * api-integration.md §3 — `GET /secured/user/profile` (`userAccount`
 * service). `clientType` is kept only to mirror the mock's signature; the
 * real call is session-derived and ignores it (per §3's own note).
 */
interface RawProfile {
  name?: string;
  fullName?: string;
  companyName?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  email: string;
  userPublicId: string;
  securityLevel: SecurityLevel;
  phoneCode?: string;
  phoneNumber?: string;
}

/**
 * Seen on dev: this endpoint answers 200 without the `{ result }` envelope the
 * financial service uses, so both shapes are accepted. On anything else the
 * field names (not values) are logged, since they're the only clue.
 */
async function fetchProfile(): Promise<RawProfile> {
  const body = await apiFetch<({ result?: RawProfile } & Partial<RawProfile>) | null>(
    '/secured/user/profile', {}, false, 'userAccount',
  );
  const profile = body?.result ?? body;
  if (!profile?.userPublicId) {
    console.error('[profile] unexpected /secured/user/profile response shape', describeShape(body));
    throw new Error('Unexpected profile response shape');
  }
  if (!displayName(profile as RawProfile)) {
    console.warn('[profile] no name field in /secured/user/profile — fields:', describeShape(body));
  }
  return profile as RawProfile;
}

/** §3 says `name`; dev's profile has none, so the usual alternatives are tried — full name for a person, company name for a business. */
function displayName(profile: RawProfile): string {
  return profile.name || profile.fullName || profile.companyName
    || [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' ');
}

// §3: "There is no `verified: boolean` in the contract" — derived from
// `/v1/otc/access`'s `enabled` flag instead, per the doc's own instruction
// (question B6, pending a `states` key the backend hasn't confirmed yet).
// This couples an extra request to every profile fetch — acceptable for now,
// worth caching/short-circuiting once this is a measured problem rather than
// a guessed one.
export async function getUser(_clientType: ClientType): Promise<User> {
  const [profile, access] = await Promise.all([
    fetchProfile(),
    // Only feeds the verified badge and the OTC gate — a failure here must not take the
    // whole profile down. Unknown access falls back to GRANTED: the backend still enforces
    // OTC access on every OTC call, while a wrong NOT_ELIGIBLE would lock the user out.
    getOtcAccess().catch((err: unknown) => {
      console.error('[profile] OTC access check failed', err);
      return undefined;
    }),
  ]);

  return {
    clientName: displayName(profile),
    clientType: _clientType,
    verified: access?.enabled ?? false,
    securityLevel: profile.securityLevel,
    otcAccess: access ? toOtcAccessReason(access) : 'GRANTED',
    email: profile.email,
    phone: [profile.phoneCode, profile.phoneNumber].filter(Boolean).join(' '),
    userId: compactPublicId(profile.userPublicId),
    // Not present anywhere in api-integration.md's field mapping (§3) — the
    // profile endpoint doesn't carry them, and nothing in the doc says where
    // else they'd come from. Left empty rather than guessed; Profile's
    // certificate/support/FAQ/about links and OtcUnavailable's actions will
    // silently no-op until these have real values. Flag with the backend.
    webCabinetUrl: '',
    supportUrl: '',
    faqUrl: '',
    aboutUrl: '',
    // §5.2's `options.confirmation2FA`/`confirmationEmail` (per-operation)
    // take priority over this account-level flag when present — this is
    // still the fallback for sign-in and any operation that doesn't specify.
    // Real 2FA-gating for withdrawals isn't wired yet (see real/auth.ts).
    authenticatorEnabled: false,
  };
}

/** Seen on dev: `userPublicId` arrives display-formatted, e.g. "2F88 2AD2 53C7 4704 A28F 4374 AE78 23FC". */
function compactPublicId(userPublicId: string): string {
  return userPublicId.replace(/\s+/g, '');
}
