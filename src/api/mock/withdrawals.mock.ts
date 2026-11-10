import type {
  WithdrawOtpIssueResult,
  WithdrawQuote,
  WithdrawalResult,
} from '@/api/types.ts';
import type { ClientType } from '@/api/types.ts';
import { MOCK_USERS, MOCK_WITHDRAW_CRYPTO_NETWORKS, MOCK_WITHDRAW_FIAT_METHODS, mockDelay } from '@/api/mock/fixtures.ts';
import { getAccountBalance, setAccountBalance } from '@/api/mock/accountsStore.ts';
import { ApiError } from '@/api/real/http/apiError.ts';
import { withdrawCheckScenario } from '@/lib/devSwitches.ts';
import { RateLimitedError } from '@/lib/rateLimitedError.ts';
import { ru } from '@/i18n/ru.ts';

// ---------------------------------------------------------------------------
// api-integration.md §5.2/§5.3's quote → issue-otp → confirm shape, shared
// by crypto and fiat alike (they only differ in what goes into the quote
// request). Replaces the old separate submitCryptoWithdrawal/
// submitFiatWithdrawal(payload) calls entirely — the "submission" now
// happens at confirm time, keyed by the quote's own transactionId.
// ---------------------------------------------------------------------------

interface PendingWithdrawal {
  ticker: string;
  amount: number;
}

const pendingWithdrawals = new Map<string, PendingWithdrawal>();
let failedOtpAttempts = 0;

export async function getWithdrawCryptoQuote(params: {
  currency: string;
  currencyNetworkId: string;
  amount: string;
}): Promise<WithdrawQuote> {
  await mockDelay();
  const network = MOCK_WITHDRAW_CRYPTO_NETWORKS.find((n) => n.currencyNetworkId === params.currencyNetworkId);
  const amount = Number(params.amount) || 0;
  const commission = network ? Number(network.commissionFixed) + (amount * Number(network.commissionPercent)) / 100 : 0;
  const transactionId = `mock-wd-${Date.now()}`;
  pendingWithdrawals.set(transactionId, { ticker: params.currency, amount });
  return {
    transactionId,
    minimalAmount: network?.minimalAmount ?? '0',
    commission: String(commission),
    commissionPercent: network?.commissionPercent ?? '0',
    finalAmount: String(Math.max(0, amount - commission)),
    amountToWithdraw: String(amount),
    limits: { DAILY: { availableLimit: network?.maximumAmount ?? '0', currency: params.currency } },
    expiredAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    contractAddress: network?.contractAddress ?? null,
    addressRegex: network?.addressRegex ?? null,
    confirmation2FA: false,
    confirmationEmail: true,
    scannerLink: null,
  };
}

export async function issueWithdrawOtp(_transactionId: string, clientType: ClientType): Promise<WithdrawOtpIssueResult> {
  await mockDelay('write');
  if (withdrawCheckScenario() === 'tasks') {
    throw new ApiError(422, 'EXTRA_CHECK_REQUIRED', 'Mock: the withdrawal is closed by user tasks (?withdraw=tasks)', '');
  }
  return { twoFA: true, source: MOCK_USERS[clientType].authenticatorEnabled ? 'authenticator' : 'email' };
}

/** Any 6 digits succeed except '000000'; 3 consecutive failures rate-limit — same rule `verifyCode` has always used. */
export async function confirmWithdrawOtp(transactionId: string, otp: string): Promise<WithdrawalResult> {
  await mockDelay('write');
  if (otp === '000000') {
    failedOtpAttempts += 1;
    if (failedOtpAttempts >= 3) {
      throw new RateLimitedError();
    }
    throw new Error(ru.verification.errorCodeInvalid);
  }
  failedOtpAttempts = 0;
  const pending = pendingWithdrawals.get(transactionId);
  if (pending) {
    setAccountBalance('deposit', pending.ticker, getAccountBalance('deposit', pending.ticker) - pending.amount);
    pendingWithdrawals.delete(transactionId);
  }
  return {
    id: `WD-${Date.now().toString(36).toUpperCase()}`,
    status: 'PENDING',
    pendingCheck: withdrawCheckScenario() === 'questionnaire' || undefined,
  };
}

export async function getWithdrawFiatQuote(params: {
  currency: string;
  paymentType: string;
  operationOption: string;
  amount: string;
}): Promise<WithdrawQuote> {
  await mockDelay();
  const method = MOCK_WITHDRAW_FIAT_METHODS.find(
    (m) => m.currency === params.currency && m.paymentType === params.paymentType,
  );
  const amount = Number(params.amount) || 0;
  const commission = method ? Number(method.commissionFixed) + (amount * Number(method.commissionPercent)) / 100 : 0;
  const transactionId = `mock-wd-${Date.now()}`;
  pendingWithdrawals.set(transactionId, { ticker: params.currency, amount });
  return {
    transactionId,
    minimalAmount: method?.minimalAmount ?? '0',
    commission: String(commission),
    commissionPercent: method?.commissionPercent ?? '0',
    // §5.2: "amountToWithdraw is what leaves the account; finalAmount is
    // what arrives" — for fiat the amount entered debits the account and
    // the fee comes out of it, so amountToWithdraw is amount+commission,
    // finalAmount (what the recipient sees) is the entered amount itself.
    finalAmount: String(amount),
    amountToWithdraw: String(amount + commission),
    limits: { DAILY: { availableLimit: method?.maximumAmount ?? '0', currency: params.currency } },
    expiredAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    contractAddress: null,
    addressRegex: null,
    confirmation2FA: false,
    confirmationEmail: true,
    scannerLink: null,
  };
}
