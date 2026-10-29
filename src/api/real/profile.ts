import type { ClientType, SecurityLevel, User } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { getOtcAccess } from '@/api/real/otc.ts';
import { ensureFreshAccessToken } from '@/api/real/http/tokenStore.ts';
import { cacheByToken } from '@/api/real/http/cache.ts';
import { toOtcAccessReason } from '@/lib/otcAccess.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';

type AccountType = 'INDIVIDUAL' | 'BUSINESS';

/** What the Profile/Home screens need, whichever of the two per-type endpoints it came from. */
interface ProfileDetails {
  email: string;
  /** Display-only, random, unrelated to the user id — 8 groups of 4 separated by spaces. Never sent to the API. */
  userPublicId: string;
  phone: string;
  securityLevel: SecurityLevel;
  /** Used only when short-profile has no name yet. */
  fallbackName: string;
}

/** The users service answers without the `{ result }` envelope the financial one uses; both are accepted. */
async function fetchUsers<T>(path: string): Promise<Partial<T>> {
  const body = await apiFetch<({ result?: Partial<T> } & Partial<T>) | null>(path, {}, false, 'userAccount');
  return body?.result ?? body ?? {};
}

/** Backend-confirmed: the token's `accountType` claim is the source of truth for individual vs business. */
async function tokenAccountType(): Promise<AccountType> {
  const payload = (await ensureFreshAccessToken())?.split('.')[1];
  const claims = payload
    ? JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { accountType?: unknown }
    : {};
  return claims.accountType === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL';
}

const phoneOf = (code?: string, number?: string) => [code, number].filter(Boolean).join(' ');

/** `GET /secured/user/profile` — individuals only (a business account gets 400 ER_SYS0000). */
async function fetchIndividualDetails(): Promise<ProfileDetails> {
  const profile = await fetchUsers<{
    email: string;
    userPublicId: string;
    securityLevel: SecurityLevel;
    phoneCode: string;
    phoneNumber: string;
    lastName: string;
    firstName: string;
    middleName: string;
  }>('/secured/user/profile');
  if (!profile.userPublicId) {
    console.error('[profile] unexpected /secured/user/profile response shape', describeShape(profile));
    throw new Error('Unexpected profile response shape');
  }
  return {
    email: profile.email ?? '',
    userPublicId: profile.userPublicId,
    phone: phoneOf(profile.phoneCode, profile.phoneNumber),
    securityLevel: profile.securityLevel ?? 'LOW',
    fallbackName: [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' '),
  };
}

/**
 * `GET /secured/business-accounts/profile`. Only `companyInfo.name` is confirmed; the contact
 * fields are read where the individual profile has them, and the field names are logged when
 * they're missing so the real ones can be wired in.
 */
async function fetchBusinessDetails(): Promise<ProfileDetails> {
  const profile = await fetchUsers<{
    companyInfo: { name?: string };
    email: string;
    userPublicId: string;
    securityLevel: SecurityLevel;
    phoneCode: string;
    phoneNumber: string;
  }>('/secured/business-accounts/profile');
  if (!profile.email || !profile.userPublicId) {
    console.warn('[profile] business profile fields:', describeShape(profile));
  }
  return {
    email: profile.email ?? '',
    userPublicId: profile.userPublicId ?? '',
    phone: phoneOf(profile.phoneCode, profile.phoneNumber),
    securityLevel: profile.securityLevel ?? 'LOW',
    fallbackName: profile.companyInfo?.name ?? '',
  };
}

/**
 * `GET /secured/user/short-profile` — the ready display name for both account types (full name
 * for an individual, company name for a business; empty while a company hasn't filled it in).
 */
async function fetchDisplayName(): Promise<string> {
  const shortProfile = await fetchUsers<{ name: string }>('/secured/user/short-profile');
  return shortProfile.name ?? '';
}

// Boot, Home and the OTC-access gate all ask for the user on one navigation — three requests each.
const userCache = cacheByToken(() => loadUser(), 30_000);

/** `clientType` is kept only to mirror the mock's signature; the real one comes from the token. */
export function getUser(_clientType: ClientType): Promise<User> {
  return userCache.get();
}

// §3: "There is no `verified: boolean` in the contract" — derived from `/v1/otc/access`'s
// `enabled` flag instead (question B6).
async function loadUser(): Promise<User> {
  const accountType = await tokenAccountType();
  const [details, name, access] = await Promise.all([
    accountType === 'BUSINESS' ? fetchBusinessDetails() : fetchIndividualDetails(),
    fetchDisplayName().catch((err: unknown) => {
      console.error('[profile] short-profile failed', err);
      return '';
    }),
    // Only feeds the verified badge and the OTC gate — a failure here must not take the
    // whole profile down. Unknown access falls back to GRANTED: the backend still enforces
    // OTC access on every OTC call, while a wrong NOT_ELIGIBLE would lock the user out.
    getOtcAccess().catch((err: unknown) => {
      console.error('[profile] OTC access check failed', err);
      return undefined;
    }),
  ]);

  return {
    clientName: name || details.fallbackName,
    clientType: accountType === 'BUSINESS' ? 'UL' : 'FL',
    verified: access?.enabled ?? false,
    securityLevel: details.securityLevel,
    otcAccess: access ? toOtcAccessReason(access) : 'GRANTED',
    email: details.email,
    phone: details.phone,
    userId: details.userPublicId,
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
