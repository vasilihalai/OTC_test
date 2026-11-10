// Swap point for the real API: screens must import only from this file,
// never from `api/mock/*` or `api/real/*` directly, so flipping
// VITE_USE_REAL_API does not touch a single screen file.
//
// Deals follow the BRCE-4023 contract: every client command has a screen
// (see the deal actions below and lib/otcStatus.ts).
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
import { authenticateMiniApp } from '@/api/real/miniAppAuth.ts';
import { ApiError } from '@/api/http.ts';
import { saveAccessToken } from '@/api/real/http/tokenStore.ts';
import { getFreshInitData } from '@/telegram/initData.ts';
import type { Session } from '@/api/types.ts';

export const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

/**
 * Stands in, in a real-mode build, for the few calls that exist only for the mock (its callers are all
 * behind `!USE_REAL_API`). With nothing left pointing at the mock's data and store, the bundler leaves
 * them out of the production bundle (see `treeshake` in vite.config.ts).
 */
function mockOnly(): never {
  throw new Error('This call exists only in mock mode');
}

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
  let result;
  try {
    result = await authenticateMiniApp(initData, platformAccessToken);
  } catch (err) {
    if (!(err instanceof ApiError)) {
      throw err;
    }
    // The OTP is already spent by now, so retrying the code can't help; the backend's
    // initData TTL counts from app launch, so the age is the first thing to check.
    const authDate = Number(new URLSearchParams(initData).get('auth_date'));
    console.error('[signIn] Telegram bind failed', {
      code: err.code,
      message: err.message,
      requestId: err.requestId,
      initDataAgeSeconds: Math.round(Date.now() / 1000 - authDate),
    });
    throw new ApiError(err.httpStatus, 'TELEGRAM_BIND_FAILED', err.message, err.requestId, err.raw);
  }
  saveAccessToken(result);
  return { email: params.email, clientType: params.clientType };
}

// Google / Apple — §2.2. Mock stays an instant fake session; real opens an
// external browser and completes (if at all) on relaunch — genuinely
// different flows, so SignIn.tsx still branches on USE_REAL_API here only.
export const signInSocial = USE_REAL_API ? mockOnly : mockAuth.signInSocial;
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
/** Real balances are cached briefly; mock balances are always read live from `accountsStore`. */
export const invalidateBalances = USE_REAL_API ? realBalances.invalidateBalances : () => undefined;

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
/** Deposit requisites of a deal: read once per screen (BRCE-4023 §1). */
export const getDealRequisites = USE_REAL_API ? realOtc.getDealRequisites : mockData.getRequisites;
export const getSavedRequisites = USE_REAL_API ? realWithdrawals.getSavedRequisites : mockData.getSavedRequisites;
export const transfer = USE_REAL_API ? realTransfers.transfer : mockActions.transfer;

// The OTC account certificate by a signed link (BRCE-4023 §7). Mock mode
// opens the bundled sample PDF directly in Profile.tsx instead.
export const openAccountCertificate = realOtc.openAccountCertificate;

// Read side — real as of this round (§7.3/§7.4), see the top-of-file note.
export const getDeals = USE_REAL_API ? realOtc.getDeals : mockData.getDeals;
export const getDealById = USE_REAL_API ? realOtc.getDealById : mockData.getDealById;

// Write side. Named for the UI action, not the raw command: the same button
// sends different commands on different screens (BRCE-4023 §2).

/** RATE_ACTIVE's "Подтвердить сделку" — ACCEPT_QUOTE; the deal moves to TOPUP at once. */
export async function acceptQuote(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(deal, 'ACCEPT_QUOTE') : mockActions.acceptQuote(deal.id);
}

/** RATE_ACTIVE's "Отклонить" — REJECT_QUOTE on the first quote cancels the deal. */
export async function rejectQuote(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(deal, 'REJECT_QUOTE') : mockActions.declineDeal(deal.id);
}

/**
 * TERMS_PROPOSED's accept. The server reads ACCEPT_QUOTE on a QUOTED proposal as the answer to the new
 * terms; legacy PROPOSED deals take ACCEPT_AMOUNT. Back to the top-up screen with the new terms.
 */
export async function acceptTerms(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API
    ? realOtc.sendOtcCommand(deal, deal.legacyProposal ? 'ACCEPT_AMOUNT' : 'ACCEPT_QUOTE')
    : mockActions.acceptTerms(deal.id);
}

/** TERMS_PROPOSED's decline: back to the top-up screen with the previous terms, the deal stays. */
export async function rejectTerms(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API
    ? realOtc.sendOtcCommand(deal, deal.legacyProposal ? 'REJECT_AMOUNT' : 'REJECT_QUOTE')
    : mockActions.rejectTerms(deal.id);
}

/**
 * AWAITING_FUNDS's "Подтвердить сделку" — CONFIRM_HOLD. The server picks the branch from the balance at
 * that moment (enough, ≤1% short, partial hold); the mock has no server, so it takes the patch the
 * screen computed.
 */
export async function confirmHold(deal: Deal, mockPatch: ConfirmDealPatch): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(deal, 'CONFIRM_HOLD') : mockActions.confirmDeal(deal.id, mockPatch);
}

/** RATE_STALE's "Запросить новый курс" — REQUEST_NEW_RATE, the deal waits for the operator again (REQUOTE). */
export async function requestNewRate(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.requestNewRate(deal) : mockActions.requestNewRate(deal.id);
}

/** REPRICE_PROPOSED's accept — the deal goes to HOLD at the new rate. */
export async function acceptReprice(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(deal, 'ACCEPT_REPRICE') : mockActions.acceptReprice(deal.id);
}

/** REPRICE_PROPOSED's decline — back to the operator's decision on the shortfall. */
export async function rejectReprice(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(deal, 'REJECT_REPRICE') : mockActions.rejectReprice(deal.id);
}

/**
 * CANCEL: "Отменить заявку" while the operator works (RATE_PENDING, SHORTFALL_REVIEW) and the top-up
 * screen's "Отклонить" — REJECT_QUOTE there would get 409. A frozen amount is released.
 */
export async function cancelDeal(deal: Deal): Promise<Deal | undefined> {
  return USE_REAL_API ? realOtc.sendOtcCommand(deal, 'CANCEL') : mockActions.declineDeal(deal.id);
}

export const openDealDocument = realOtc.openDealDocument;
export { DocumentUnavailableError } from '@/api/real/otc.ts';

// Client-driven only (the quote card's own countdown hitting zero) — real
// mode has no command for this, the server reflects EXPIRED (a quote) or
// TOPUP (expired new terms) on its own.
export const expireQuote = USE_REAL_API ? mockOnly : mockActions.expireQuote;
export const setDepositBalanceForTesting = USE_REAL_API ? mockOnly : mockActions.setDepositBalanceForTesting;

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
  DealDocumentKind,
  DealTerms,
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
