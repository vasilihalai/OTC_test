import type { AuthOtpSource, ClientType, SocialProvider } from '@/api/types.ts';
import { authBasicFetch, formBody } from '@/api/real/http/authClient.ts';
import { publicPost } from '@/api/real/http/publicClient.ts';
import { clearTokens } from '@/api/real/http/tokenStore.ts';
import { openExternalLink } from '@/telegram/adapter.ts';
import { apiFetch } from '@/api/http.ts';

/**
 * Real auth — api-integration.md §2. `accountType` is the personal/business
 * split now: a body field sent to one gateway, not (as an earlier round had
 * it) two separate backends/OAuth clients — that whole two-backend `config.ts`
 * is gone along with the Telegram-binding session flow it supported.
 */
function accountType(clientType: ClientType): 'BUSINESS' | 'INDIVIDUAL' {
  return clientType === 'UL' ? 'BUSINESS' : 'INDIVIDUAL';
}

// ---------------------------------------------------------------------------
// Sign-in — §2.1. Two calls: issue OTP, then exchange it for tokens.
// ---------------------------------------------------------------------------

export interface OtpIssueResult {
  transactionId: string;
  source: AuthOtpSource;
}

/**
 * An account has exactly one second factor configured, never both — the
 * modal shows a single code field, picked by this response's `source`
 * (product decision, overriding an earlier "email always, plus an
 * authenticator code when enabled" reading of §2.1). The real field name
 * for this isn't documented anywhere; assumed to be `source` to match the
 * withdrawal OTP contract's own field of the same name and purpose
 * (§5.2/§5.3) — reconcile here if the backend calls it something else.
 */
export async function signInRequestOtp(email: string, password: string, clientType: ClientType): Promise<OtpIssueResult> {
  const res = await authBasicFetch<{ success: boolean; timestamp: string; transactionId: string; source: AuthOtpSource }>(
    '/oauth2/otp',
    JSON.stringify({
      grant_type: 'email_password',
      target: email,
      password,
      accountType: accountType(clientType),
    }),
    'application/json',
  );
  return { transactionId: res.transactionId, source: res.source };
}

export interface OtpConfirmParams {
  transactionId: string;
  /** The one code the modal collected, whichever source it came from. */
  otp: string;
  /** Unused here (kept only so this call's shape matches the mock's — see below); the real flow derives the session from `authenticateMiniApp()` afterward, not from this response. */
  email: string;
  clientType: ClientType;
}

/**
 * Exchanges the OTP for a **platform** JWT — not the mini app session.
 * Backend-confirmed flow (superseding the §2.1 reading this was originally
 * built against): this token is only ever used once, as a `Bearer` on a
 * single `authenticateMiniApp()` call that creates the Telegram↔platform
 * binding and returns the token that actually becomes the session (see
 * `SignIn.tsx`). Never saved into `tokenStore` here.
 *
 * The `scope` value is undocumented (question B2) — sent empty for now.
 */
export async function signInConfirmOtp(params: OtpConfirmParams): Promise<{ platformAccessToken: string }> {
  const res = await authBasicFetch<{ access_token: string; token_type: string; expires_in: number }>(
    '/oauth2/token',
    formBody({
      grant_type: 'email_password',
      scope: '', // question B2 — scope value for this grant isn't documented
      otp: params.otp,
      transactionId: params.transactionId,
    }),
    'application/x-www-form-urlencoded',
  );
  return { platformAccessToken: res.access_token };
}

// ---------------------------------------------------------------------------
// Google / Apple — §2.2. Best-effort for MVP (question B3): the redirect
// back into the mini app isn't reliably capturable on every Telegram
// client, so this only ever opens the provider's page — completion is
// handled opportunistically at boot (see `index.tsx`) if the app happens to
// relaunch with `code`/`state` in the URL.
// ---------------------------------------------------------------------------

export async function startSocialSignIn(provider: SocialProvider, clientType: ClientType): Promise<void> {
  // `ct` rides along in the redirect URL so that *if* the relaunch is
  // captured (see `index.tsx`), the exchange response's `email` can be
  // paired back up with which account type this was for — the exchange
  // response itself carries no account-type field.
  const redirectUrl = new URL(window.location.href);
  redirectUrl.searchParams.set('ct', clientType);
  const res = await publicPost<{ authorizationUrl: string }>('auth', '/public/oauth/init', {
    provider: provider.toUpperCase(),
    accountType: accountType(clientType),
    language: 'RU',
    redirectUrl: redirectUrl.toString(),
  });
  openExternalLink(res.authorizationUrl);
}

export interface OAuthExchangeResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  email: string;
  isRegistration: boolean;
  twoFA: boolean;
}

/**
 * Camelcase envelope — different from `/oauth2/token`'s snake_case (§2.2's
 * own note). **Disabled and unreconciled with the Telegram-binding flow**
 * (`SignIn.tsx`'s `SOCIAL_AUTH_ENABLED = false`, no real contract for it
 * yet) — this used to save the resulting tokens straight into `tokenStore`
 * as the session, which no longer applies now that the session is always a
 * mini-app access token obtained via `authenticateMiniApp()`. Left
 * returning the raw exchange result without touching `tokenStore` at all;
 * revisit alongside re-enabling social sign-in.
 */
export async function exchangeSocialCode(code: string, state: string): Promise<OAuthExchangeResult> {
  const res = await publicPost<{
    accessToken: string; refreshToken: string; transactionId: string; email: string;
    tokenType: string; expiresIn: number; isRegistration: boolean; twoFA: boolean;
  }>('auth', '/public/oauth/exchange', { code, state });

  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    tokenType: res.tokenType,
    expiresIn: res.expiresIn,
    email: res.email,
    isRegistration: res.isRegistration,
    twoFA: res.twoFA,
  };
}

// ---------------------------------------------------------------------------
// Password recovery — §2.3. Three calls, each carrying the transactionId
// the previous one returned (step 2 issues a *new* one — don't reuse step 1's).
// ---------------------------------------------------------------------------

export async function recoveryRequestOtp(email: string, clientType: ClientType): Promise<OtpIssueResult> {
  return publicPost<OtpIssueResult>('userAccount', '/public/restore-password/generate-otp', {
    grant_type: 'email_password',
    target: email,
    accountType: accountType(clientType),
  });
}

export async function recoveryConfirmOtp(transactionId: string, otp: string): Promise<OtpIssueResult> {
  return publicPost<OtpIssueResult>('userAccount', '/public/restore-password/confirm-otp', { transactionId, otp });
}

export async function recoveryComplete(transactionId: string, password: string): Promise<void> {
  await publicPost<void>('userAccount', '/public/restore-password/complete', { transactionId, password });
}

// ---------------------------------------------------------------------------
// Sign-out. No revoke endpoint is documented for the mini app's own access
// token (there's no refresh token either — see `tokenStore.ts`'s own
// comment), so this just clears local state. The Telegram↔platform binding
// itself is unaffected server-side either way — tapping "Выход" only signs
// this device out of the mini app locally; whether/how to also break the
// binding (so a silent re-entry at next boot doesn't immediately undo the
// sign-out) isn't specified anywhere and needs a product answer, not a
// guessed API call.
// ---------------------------------------------------------------------------

export function signOut(): Promise<void> {
  clearTokens();
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Generic code verification — used only by the withdrawal-confirmation 2FA
// step (`TwoFactorGate`/`VerificationModal`/`AuthenticatorModal`, shared with
// sign-in until this round). Sign-in and password recovery moved to their
// own dedicated, spec-accurate functions above; withdrawal confirmation's
// real contract is §5.3's `/operations/issue-otp/{id}` + `/confirm/{id}`,
// tied to a withdrawal quote's own transactionId — genuinely different from
// this, and out of scope for the Auth step. Left pointing at the old assumed
// (unconfirmed) endpoints for now; replace when the Withdrawals step wires
// §5 for real.
// ---------------------------------------------------------------------------

export async function sendVerificationCode(email: string, password?: string): Promise<void> {
  await apiFetch<void>('/auth/send-code', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function verifyCode(code: string): Promise<void> {
  await apiFetch<void>('/auth/verify-code', { method: 'POST', body: JSON.stringify({ code }) });
}
