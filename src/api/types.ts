export type ClientType = 'UL' | 'FL';

/**
 * UI-facing identity only — no credential lives here. In real mode the
 * actual access/refresh tokens are owned exclusively by
 * `api/real/http/tokenStore.ts` (api-integration.md §1.4); in mock mode
 * nothing reads a token at all. Kept minimal on purpose so there is only
 * ever one place a stale token could leak from.
 */
export interface Session {
  email: string;
  clientType: ClientType;
}

/**
 * BRCE-4023 §8, checked in this order: `level` 0 in the token → VERIFICATION_REQUIRED;
 * `GET /v1/features/availability` row `OTC` with `USER_RESTRICTED` → NOT_ELIGIBLE, with
 * `SYSTEM_DISABLED` → DESK_CLOSED; available and `OTC_ENABLED` in `GET /v1/features/access` → GRANTED.
 */
export type OtcAccessReason = 'GRANTED' | 'VERIFICATION_REQUIRED' | 'DESK_CLOSED' | 'NOT_ELIGIBLE';

/** How the account is protected — not its verification status. */
export type SecurityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface User {
  clientName: string;
  clientType: ClientType;
  verified: boolean;
  securityLevel: SecurityLevel;
  otcAccess: OtcAccessReason;
  email: string;
  phone: string;
  userId: string;
  supportUrl: string;
  faqUrl: string;
  aboutUrl: string;
  /** Gates the 2FA method: Google Authenticator when true, email code otherwise. */
  authenticatorEnabled: boolean;
}

export interface Stats {
  activeDeals: number;
  volume30d: string;
  volumeAsset: string;
}

/**
 * What the client sees, one value per screen. The backend status behind each one
 * (BRCE-4023 §2) is mapped in `lib/otcStatus.ts`.
 */
export type DealStatus =
  /** `QUOTING`, `REQUOTE`: no rate yet, or the client asked for a new one. */
  | 'RATE_PENDING'
  /** `QUOTED` without `previousRate`: the first quote, with a timer. */
  | 'RATE_ACTIVE'
  /** `QUOTED` with `previousRate` (or legacy `PROPOSED`): the operator changed the amount and/or rate before the hold. */
  | 'TERMS_PROPOSED'
  /** `EXPIRED`. */
  | 'RATE_STALE'
  /** `TOPUP`, `CHECKING`: top up the deposit account and confirm the hold. */
  | 'AWAITING_FUNDS'
  /** `REPRICE` without `proposedRate`: less than the deal was frozen, the operator decides. */
  | 'SHORTFALL_REVIEW'
  /** `REPRICE` with `proposedRate`: the operator offers a new rate on the frozen amount. */
  | 'REPRICE_PROPOSED'
  /** `HOLD`. */
  | 'RUNNING'
  /** `EXECUTED`. */
  | 'DONE'
  /** `CANCELED`, `ERROR`. */
  | 'DECLINED';

export type DealDirection = 'BUY' | 'SELL' | 'EXCHANGE';

/**
 * The three client-facing deal documents (BRD FR-7). The backend sends `PAYMENT_INSTRUCTION` → `payment`
 * and `EXECUTION_ACT` → `certificate`; the acceptance has no document there yet (asked for), so its row
 * stays locked until one comes.
 */
export type DealDocumentKind = 'accept' | 'payment' | 'certificate';

/** `documents[]` of `GET /v1/otc/deals/{id}`. */
export interface DealDocument {
  kind: DealDocumentKind;
  /** A full signed link when `hrefExpiresAt` is set; otherwise a gateway path that needs the session token. */
  href?: string;
  /** ISO timestamp — when the signed `href` stops working. */
  hrefExpiresAt?: string;
  available: boolean;
}

/** One side of a deal's terms, ready to show. */
export interface DealTerms {
  /** e.g. `5 000 000 KGS`. */
  from: string;
  to: string | null;
  /** e.g. `1 USDT = 87.45 KGS`. */
  rate: string | null;
  ratePerUnit?: string;
  rateUnitLabel?: string;
}

export interface Deal {
  /** Display id in mock mode; in real mode this is `operationId` — the uuid every subsequent call needs. See `requestNumber` for what the row/header actually show. */
  id: string;
  /** Real mode only — "OTC-1047" etc. Falls back to `id` when absent (mock: the two were never distinct). */
  requestNumber?: string;
  status: DealStatus;
  date: string;
  direction: DealDirection;
  from: string;
  to: string | null;
  rate: string | null;
  /** Ticker of the `from` asset — drives which requisites variant (fiat/crypto) applies. */
  ticker: string;
  /** Quote-card fields — only meaningful while `status === 'RATE_ACTIVE'`. */
  ratePerUnit?: string;
  rateUnitLabel?: string;
  /**
   * ISO timestamp — the quote card counts down to this. Only meaningful for RATE_ACTIVE and
   * TERMS_PROPOSED: after the quote is accepted it is not a top-up deadline (BRCE-4023 §4, Р1).
   */
  quoteExpiresAt?: string;
  /** Ticker of the asset the client receives. */
  toTicker?: string;
  /** Plain decimal of `from`, for the balance math. */
  amount?: string;
  /**
   * Real mode, from the deal card: the available balance in `ticker` on the deposit account
   * (`UNIFIED`), what it lacks against the deal, and the deal's minimum (BRCE-4023 §5).
   */
  balance?: string;
  missingAmount?: string;
  /** Plain decimal in `ticker`; the hold is blocked when the shortfall is over 1% and the balance is not above it. */
  minAmount?: string;
  /** What is actually debited and credited: after a ≤1% recalculation or a partial hold. Display strings. */
  actualFrom?: string;
  actualTo?: string;
  /** The frozen amount, display string. */
  holdAmount?: string;
  /** TERMS_PROPOSED: the agreed terms the operator's proposal would replace (`previous*`). */
  previous?: DealTerms;
  /** REPRICE_PROPOSED: the operator's new rate on the frozen amount and what it gives. */
  reprice?: DealTerms;
  /** SHORTFALL_REVIEW after the client rejected the operator's new rate (`repriceOutcome = REJECTED`). */
  repriceRejected?: boolean;
  /** Legacy `PROPOSED` deals answer with ACCEPT_AMOUNT/REJECT_AMOUNT instead of ACCEPT_QUOTE/REJECT_QUOTE. */
  legacyProposal?: boolean;
  documents?: DealDocument[];
}

export type AssetGroup = 'crypto' | 'fiat';

export interface Asset {
  ticker: string;
  name: string;
  balance: string;
  group: AssetGroup;
  /** USD equivalent of the holding, for ordering and the "under $1" filter; undefined when unknown. */
  usdValue?: number;
}

export type SocialProvider = 'google' | 'apple';

export type SignInError = 'EMAIL_INVALID';

export type VerifyCodeError = 'CODE_INVALID' | 'RATE_LIMIT';

/** Display string, e.g. `TRON (TRC-20)` — the fixture set defines the whole vocabulary, not an enum. */
export type CryptoNetwork = string;

export type FiatTransferType = 'internal' | 'kg' | 'ru';

export interface SavedRequisite {
  id: string;
  transferType: FiatTransferType;
  label: string;
  account: string;
  bankName?: string;
  bic?: string;
  kpp?: string;
  inn?: string;
  correspondentAccount?: string;
}

export interface RequisitesPayload {
  transferType: FiatTransferType;
  account: string;
  bankName?: string;
  bic?: string;
  kpp?: string;
  inn?: string;
  correspondentAccount?: string;
  saveForLater: boolean;
}

/**
 * api-integration.md §5.1 — one entry per network a crypto asset supports,
 * each carrying its own limits/commission (replaces the old one-flat-
 * limits-object-per-asset shape entirely; the real directory has no such
 * per-asset object, only per-network).
 */
export interface WithdrawNetworkOption {
  currencyNetworkId: string;
  networkCode: string;
  networkLabel: string;
  contractAddress: string | null;
  addressRegex: string | null;
  minimalAmount: string;
  maximumAmount: string;
  commissionPercent: string;
  commissionFixed: string;
}

export interface CryptoWithdrawOptions {
  networks: WithdrawNetworkOption[];
}

/** §5.2 — `GET /operations/withdraw/info`'s `limits` map, keyed by period (`DAILY`/`WEEKLY`/…, not all guaranteed present). */
export interface WithdrawLimitEntry {
  availableLimit: string;
  currency: string;
}

/**
 * §5.2's live quote — replaces the old "fetch static limits once" model.
 * Requested fresh whenever the amount/network/method changes; `transactionId`
 * carries through OTP issue + confirm (§5.3), `expiredAt` means re-request
 * if the user sits on the screen past it.
 */
export interface WithdrawQuote {
  transactionId: string;
  minimalAmount: string;
  commission: string;
  commissionPercent: string;
  finalAmount: string;
  amountToWithdraw: string;
  limits: Record<string, WithdrawLimitEntry>;
  expiredAt: string;
  contractAddress: string | null;
  addressRegex: string | null;
  /** Which second factor *this operation* needs — preferred over the account-level `authenticatorEnabled` when present (§5.2). */
  confirmation2FA: boolean;
  confirmationEmail: boolean;
  scannerLink: string | null;
}

export type WithdrawOtpSource = 'email' | 'authenticator' | 'phone';

/**
 * Sign-in/recovery OTP — an account has exactly one second factor
 * configured, never both at once, so the issue-otp step tells the client
 * which single method to ask for (mirrors `WithdrawOtpSource`'s role, just
 * without a documented `phone` case here).
 */
export type AuthOtpSource = 'email' | 'authenticator';

/** `POST /operations/issue-otp/{transactionId}` — §5.3. `source` picks the modal; more precise than the account-level flag. */
export interface WithdrawOtpIssueResult {
  twoFA: boolean;
  source: WithdrawOtpSource;
}

/**
 * api-integration.md §5.1 — one entry per (currency, paymentType,
 * operationOption) triple, each with its own limits/commission (replaces
 * the old one-flat-limits-object-per-currency shape, same restructuring as
 * `WithdrawNetworkOption` did for crypto). `transferType`/`name` are derived
 * from `paymentType` via `lib/paymentType.ts`, not sent by the backend.
 */
export interface WithdrawMethod {
  paymentType: string;
  operationOption: string;
  name: string;
  /** Which requisites field set the method needs — set once here, not re-picked on the requisites screen. */
  transferType: FiatTransferType;
  minimalAmount: string;
  maximumAmount: string;
  commissionPercent: string;
  commissionFixed: string;
}

export interface FiatWithdrawOptions {
  methods: WithdrawMethod[];
}

export interface WithdrawalResult {
  id: string;
  status: 'PENDING';
}

export type TransferAccount = 'deposit' | 'trading';

export interface TransferRequest {
  from: TransferAccount;
  to: TransferAccount;
  ticker: string;
  amount: string;
}

export interface Accounts {
  deposit: Record<string, string>;
  trading: Record<string, string>;
}

/**
 * `GET /v1/otc/deals/{id}/requisites`, `kind: FIAT` (BRCE-4023 §1): the account the operator chose in
 * CRM, or the auto-picked one when `title` is absent. Any field may be missing; empty ones aren't shown.
 */
export interface FiatRequisites {
  kind: 'fiat';
  title?: string;
  purpose?: string;
  /** The frame's "Наименование компании" and "Корреспондентский счёт": not in the contract yet, asked for. */
  companyName?: string;
  correspondentAccount?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientAccount?: string;
  account?: string;
  bankName?: string;
  bankAddress?: string;
  bic?: string;
  bankSwift?: string;
  correspondentBankName?: string;
  correspondentBankAddress?: string;
  correspondentBankSwift?: string;
  intermediaryBankName?: string;
  intermediaryBankAddress?: string;
  intermediaryBankSwift?: string;
}

export interface CryptoRequisites {
  kind: 'crypto';
  asset: string;
  assetName: string;
  network: string;
  address: string;
  /** Other networks this asset can also be deposited over, each with its own address. When present (>1 entry), the network field becomes a real picker instead of a fixed display. */
  networks?: { network: string; address: string }[];
}

export type Requisites = FiatRequisites | CryptoRequisites;

export type BalanceScenario = 'sufficient' | 'short1' | 'short' | 'belowmin';
