import type { AuthOtpSource, ClientType, Session, SignInError, SocialProvider, VerifyCodeError } from '@/api/types.ts';
import { isValidEmail } from '@/lib/validate.ts';
import { MOCK_USERS, mockDelay } from '@/api/mock/fixtures.ts';

export const MAX_CONSECUTIVE_CODE_ATTEMPTS = 3;

export class MockSignInError extends Error {
  constructor(public readonly code: SignInError) {
    super(code);
  }
}

export class MockVerifyCodeError extends Error {
  constructor(public readonly code: VerifyCodeError) {
    super(code);
  }
}

// Consecutive failed verifyCode attempts since the last successful send.
let failedAttempts = 0;

/**
 * Shared by sign-in (after the password step) and password recovery.
 * `password` is unused by the mock (any non-empty value is accepted) — kept
 * in the signature so the real implementation, which does need it, is a
 * drop-in swap with no screen changes.
 */
export async function sendVerificationCode(email: string, _password?: string): Promise<void> {
  await mockDelay('write');
  if (!isValidEmail(email)) {
    throw new MockSignInError('EMAIL_INVALID');
  }
  failedAttempts = 0;
}

/** Any 6 digits succeed except '000000'; 3 consecutive failures rate-limit. */
export async function verifyCode(code: string): Promise<void> {
  await mockDelay('write');

  if (failedAttempts >= MAX_CONSECUTIVE_CODE_ATTEMPTS) {
    throw new MockVerifyCodeError('RATE_LIMIT');
  }

  if (code === '000000') {
    failedAttempts += 1;
    if (failedAttempts >= MAX_CONSECUTIVE_CODE_ATTEMPTS) {
      throw new MockVerifyCodeError('RATE_LIMIT');
    }
    throw new MockVerifyCodeError('CODE_INVALID');
  }

  failedAttempts = 0;
}

export async function signInSocial(_provider: SocialProvider, clientType: ClientType): Promise<Session> {
  await mockDelay('write');
  return { email: MOCK_USERS[clientType].email, clientType };
}

// ---------------------------------------------------------------------------
// Sign-in — api-integration.md §2.1 shape, mocked. An account has exactly
// one second factor, never both: OTP-issue returns which single one
// (`source`, straight from the fixture's `authenticatorEnabled`) rather
// than a `twoFA` boolean the modal used to read as "email always, plus an
// authenticator code on top" — product decision, not a spec reading.
// Confirm validates the single code the same way `verifyCode` above always has.
// ---------------------------------------------------------------------------

let signInFailedAttempts = 0;

function otpSourceFor(clientType: ClientType): AuthOtpSource {
  return MOCK_USERS[clientType].authenticatorEnabled ? 'authenticator' : 'email';
}

export async function signInRequestOtp(email: string, password: string, clientType: ClientType): Promise<{ transactionId: string; source: AuthOtpSource }> {
  await mockDelay('write');
  if (!isValidEmail(email) || !password.trim()) {
    throw new MockSignInError('EMAIL_INVALID');
  }
  signInFailedAttempts = 0;
  return { transactionId: `mock-tx-${Date.now()}`, source: otpSourceFor(clientType) };
}

export interface SignInConfirmParams {
  transactionId: string;
  otp: string;
  email: string;
  clientType: ClientType;
}

export async function signInConfirmOtp(params: SignInConfirmParams): Promise<Session> {
  await mockDelay('write');
  if (signInFailedAttempts >= MAX_CONSECUTIVE_CODE_ATTEMPTS) {
    throw new MockVerifyCodeError('RATE_LIMIT');
  }
  if (params.otp === '000000') {
    signInFailedAttempts += 1;
    throw new MockVerifyCodeError(signInFailedAttempts >= MAX_CONSECUTIVE_CODE_ATTEMPTS ? 'RATE_LIMIT' : 'CODE_INVALID');
  }
  signInFailedAttempts = 0;
  return { email: params.email, clientType: params.clientType };
}

// ---------------------------------------------------------------------------
// Password recovery — §2.3 shape, mocked.
// ---------------------------------------------------------------------------

export async function recoveryRequestOtp(email: string, clientType: ClientType): Promise<{ transactionId: string; source: AuthOtpSource }> {
  await mockDelay('write');
  if (!isValidEmail(email)) {
    throw new MockSignInError('EMAIL_INVALID');
  }
  return { transactionId: `mock-recovery-${Date.now()}`, source: otpSourceFor(clientType) };
}

export async function recoveryConfirmOtp(_transactionId: string, otp: string): Promise<{ transactionId: string }> {
  await mockDelay('write');
  if (otp === '000000') {
    throw new MockVerifyCodeError('CODE_INVALID');
  }
  return { transactionId: `mock-recovery-confirmed-${Date.now()}` };
}

export async function recoveryComplete(_transactionId: string, _password: string): Promise<void> {
  await mockDelay('write');
}
