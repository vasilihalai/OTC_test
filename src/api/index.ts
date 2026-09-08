// Swap point for the real API: screens must import only from this file,
// never from `api/mock/*` or `api/real/*` directly, so flipping
// VITE_USE_REAL_API does not touch a single screen file.
//
// Deals are real-API-ready for the five commands that have a built screen
// (api-integration.md §7.3/§7.4/§7.6) — acceptQuote/rejectQuote/confirmHold/
// requestNewRate/cancelDeal, below. The other four commands (ACCEPT_AMOUNT/
// REJECT_AMOUNT/ACCEPT_REPRICE/REJECT_REPRICE) have no screen to call them
// from — REQUOTE/RATE_RENEGOTIATING is read-only except Cancel, per an
// explicit "flag it to the analyst, do not improvise them" instruction —
// see lib/otcStatus.ts.
import * as mockAuth from '@/api/mock/auth.mock.ts';
import * as realAuth from '@/api/real/auth.ts';
import * as mockData from '@/api/mock/data.mock.ts';
import * as mockActions from '@/api/mock/actions.mock.ts';
import type { ConfirmDealPatch } from '@/api/mock/actions.mock.ts';
import type { ClientType, Deal, RequisitesPayload } from '@/api/types.ts';
import * as realProfile from '@/api/real/profile.ts';
import * as realBalances from '@/api/real/balances.ts';
import * as realOtc from '@/api/real/otc.ts';
import * as mockWithdrawals from '@/api/mock/withdrawals.mock.ts';
import * as realWithdrawals from '@/api/real/withdrawals.ts';
import * as realTransfers from '@/api/real/transfers.ts';
import * as realCertificate from '@/api/real/certificate.ts';
import { authenticateMiniApp } from '@/api/real/miniAppAuth.ts';
import { saveAccessToken } from '@/api/real/http/tokenStore.ts';
import { getFreshInitData } from '@/telegram/initData.ts';
import { setLastClientType } from '@/lib/lastClientType.ts';
import type { Session } from '@/api/types.ts';

export const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

// Generic OTP verification — withdrawal-confirmation 2FA only now (see
// real/auth.ts's own comment). Sign-in and password recovery each have
// their own dedicated pair below, matching api-integration.md §2's three
// genuinely different contracts.
export const sendVerificationCode = USE_REAL_API ? realAuth.sendVerificationCode : mockAuth.sendVerificationCode;
export const verifyCode = USE_REAL_API ? realAuth.verifyCode : mockAuth.verifyCode;
export const MockSignInError = mockAuth.MockSignInError;
export const MockVerifyCodeError = mockAuth.MockVerifyCodeError;

// Sign-in — api-integration.md §2.1. Same two-step OTP shape in both modes,
// so screens still don't branch on USE_REAL_API for this — the Telegram-
// binding orchestration below is entirely absorbed at this swap point.
export const signInRequestOtp = USE_REAL_API ? realAuth.signInRequestOtp : mockAuth.signInRequestOtp;

/**
 * Backend-confirmed flow, replacing the old `x-telegram-init-data`/
 * `markInitDataBindPending()` one-shot-header approach entirely (see
 * `real/miniAppAuth.ts`'s own comment for the full contract). In real mode,
 * the OTP exchange only produces a *platform* JWT — this immediately spends
 * it as a `Bearer` on one `authenticateMiniApp()` call, which creates the
 * Telegram↔platform binding and returns the token that actually becomes
 * the session; that's the one saved into `tokenStore`, not the platform JWT.
 * Kept here rather than in `real/auth.ts` so both modes still return one
 * `Session` shape and `SignIn.tsx` needs no `USE_REAL_API` branch of its own.
 */
export async function signInConfirmOtp(params: { transactionId: string; otp: string; email: string; clientType: ClientType }): Promise<Session> {
  if (!USE_REAL_API) {
    return mockAuth.signInConfirmOtp(params);
  }
  const { platformAccessToken } = await realAuth.signInConfirmOtp(params);
  const initData = getFreshInitData();
  if (!initData) {
    throw new Error('No Telegram initData available to complete sign-in');
  }
  const result = await authenticateMiniApp(initData, platformAccessToken);
  saveAccessToken(result);
  setLastClientType(params.clientType);
  return { email: params.email, clientType: params.clientType };
}

// Google / Apple — §2.2. Mock stays an instant fake session; real opens an
// external browser and completes (if at all) on relaunch — genuinely
// different flows, so SignIn.tsx still branches on USE_REAL_API here only.
export const signInSocial = mockAuth.signInSocial;
export const startSocialSignIn = realAuth.startSocialSignIn;
export const exchangeSocialCode = realAuth.exchangeSocialCode;

// Password recovery — §2.3.
export const recoveryRequestOtp = USE_REAL_API ? realAuth.recoveryRequestOtp : mockAuth.recoveryRequestOtp;
export const recoveryConfirmOtp = USE_REAL_API ? realAuth.recoveryConfirmOtp : mockAuth.recoveryConfirmOtp;
export const recoveryComplete = USE_REAL_API ? realAuth.recoveryComplete : mockAuth.recoveryComplete;

// Sign-out — §1.4. Mock just clears local state (no server call, no tokens
// to revoke); real revokes then clears regardless of the call's outcome.
export async function signOut(): Promise<void> {
  if (USE_REAL_API) {
    await realAuth.signOut();
  }
}

export const getUser = USE_REAL_API ? realProfile.getUser : mockData.getUser;
export const getAssets = USE_REAL_API ? realBalances.getAssets : mockData.getAssets;

export const getWithdrawFiatOptions = USE_REAL_API
  ? realWithdrawals.getWithdrawFiatOptions
  : mockData.getWithdrawFiatOptions;
export const getWithdrawCryptoOptions = USE_REAL_API
  ? realWithdrawals.getWithdrawCryptoOptions
  : mockData.getWithdrawCryptoOptions;

// Withdrawal confirm — api-integration.md §5.2/§5.3. Quote → issue-otp →
// confirm, shared shape for crypto and fiat alike; the "submission" happens
// at confirm, keyed by the quote's own transactionId, in both modes (mock
// mirrors this shape, not just its effect).
export async function getWithdrawCryptoQuote(params: {
  currency: string; currencyNetworkId: string; amount: string; address: string;
}) {
  return USE_REAL_API
    ? realWithdrawals.getWithdrawCryptoQuote(params)
    : mockWithdrawals.getWithdrawCryptoQuote(params);
}
export async function getWithdrawFiatQuote(params: {
  currency: string; paymentType: string; operationOption: string; amount: string; requisites: RequisitesPayload;
}) {
  return USE_REAL_API
    ? realWithdrawals.getWithdrawFiatQuote(params)
    : mockWithdrawals.getWithdrawFiatQuote(params);
}
export async function issueWithdrawOtp(transactionId: string, clientType: ClientType) {
  return USE_REAL_API
    ? realWithdrawals.issueWithdrawOtp(transactionId)
    : mockWithdrawals.issueWithdrawOtp(transactionId, clientType);
}
export async function confirmWithdrawOtp(transactionId: string, otp: string, requisites?: object) {
  return USE_REAL_API
    ? realWithdrawals.confirmWithdrawOtp(transactionId, otp, requisites)
    : mockWithdrawals.confirmWithdrawOtp(transactionId, otp);
}

export const getStats = USE_REAL_API ? realOtc.getStats : mockData.getStats;
export const getAccounts = USE_REAL_API ? realBalances.getAccounts : mockData.getAccounts;
export const getRequisites = USE_REAL_API ? realWithdrawals.getRequisites : mockData.getRequisites;
export const getSavedRequisites = USE_REAL_API ? realWithdrawals.getSavedRequisites : mockData.getSavedRequisites;
export const transfer = USE_REAL_API ? realTransfers.transfer : mockActions.transfer;

// §8. Mock mode just opens the bundled sample PDF directly (Profile.tsx,
// no loading/error states to simulate for a static file) — genuinely
// different flows, same precedent as Google/Apple sign-in above, so
// Profile.tsx branches on USE_REAL_API itself rather than this being a
// mock/real pair.
export const getAccountCertificate = realCertificate.getAccountCertificate;

// Read side — real as of this round (§7.3/§7.4), see the top-of-file note.
export const getDeals = USE_REAL_API ? realOtc.getDeals : mockData.getDeals;
export const getDealById = USE_REAL_API ? realOtc.getDealById : mockData.getDealById;

// Write side — §7.6. Named for the UI action, not the raw command, since
// one button can imply different commands depending which screen it's on
// (both RATE_ACTIVE's and AWAITING_FUNDS's "Отклонить" are REJECT_QUOTE;
// RATE_PENDING's and RATE_RENEGOTIATING's "Отменить заявку" are CANCEL —
// two visually-identical buttons, two different real commands).

/** RATE_ACTIVE's "Подтвердить сделку". */
export async function acceptQuote(dealId: string): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(dealId, 'ACCEPT_QUOTE') : mockActions.confirmDeal(dealId, { status: 'RUNNING' });
}

/** RATE_ACTIVE's and AWAITING_FUNDS's "Отклонить" — both map to REJECT_QUOTE (§7.6's table). */
export async function rejectQuote(dealId: string): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(dealId, 'REJECT_QUOTE') : mockActions.declineDeal(dealId);
}

/**
 * AWAITING_FUNDS's "Подтвердить сделку" (all three non-belowmin branches).
 * Real: a single `CONFIRM_HOLD` — the server decides whether the result is
 * `RUNNING` or a `REQUOTE` renegotiation based on what was actually frozen,
 * so there's nothing to compute client-side; the refetch after the command
 * picks up whichever it was. Mock: no server logic to simulate that
 * decision, so it still needs the branch-computed patch passed in.
 */
export async function confirmHold(dealId: string, mockPatch: ConfirmDealPatch): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(dealId, 'CONFIRM_HOLD') : mockActions.confirmDeal(dealId, mockPatch);
}

/** RATE_STALE's "Запросить новый курс" — always lands in `RATE_RENEGOTIATING`, confirmed directly: this is one of its two real triggers (the other is `confirmHold`'s "short" branch). */
export async function requestNewRate(dealId: string): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(dealId, 'REQUEST_NEW_RATE') : mockActions.requestNewRate(dealId);
}

/** RATE_PENDING's and RATE_RENEGOTIATING's "Отменить заявку" — CANCEL. */
export async function cancelDeal(dealId: string): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(dealId, 'CANCEL') : mockActions.declineDeal(dealId);
}

// Client-driven only (the quote card's own countdown hitting zero) — real
// mode has no command for this at all, the server just eventually reflects
// EXPIRED on its own; see DealDetail.tsx's QuoteCard for how each mode
// handles the countdown reaching zero differently.
export const expireQuote = mockActions.expireQuote;
export const setDepositBalanceForTesting = mockActions.setDepositBalanceForTesting;

export { ApiError } from '@/api/http.ts';
export { mapApiError } from '@/api/real/errorMap.ts';

export type { ConfirmDealPatch } from '@/api/mock/actions.mock.ts';
export type {
  Session,
  User,
  Stats,
  Deal,
  DealStatus,
  DealDirection,
  DealDocument,
  OtcAccessResult,
  Asset,
  AssetGroup,
  ClientType,
  SecurityLevel,
  OtcAccessReason,
  SocialProvider,
  SignInError,
  VerifyCodeError,
  CryptoNetwork,
  FiatTransferType,
  SavedRequisite,
  RequisitesPayload,
  WithdrawNetworkOption,
  CryptoWithdrawOptions,
  WithdrawMethod,
  FiatWithdrawOptions,
  WithdrawLimitEntry,
  WithdrawQuote,
  WithdrawOtpSource,
  AuthOtpSource,
  WithdrawOtpIssueResult,
  WithdrawalResult,
  TransferAccount,
  TransferRequest,
  Accounts,
  Requisites,
  FiatRequisites,
  CryptoRequisites,
  BalanceScenario,
} from '@/api/types.ts';
