import type { Deal, TransferRequest } from '@/api/types.ts';
import { mockDelay } from '@/api/mock/fixtures.ts';
import { findDeal, updateDeal } from '@/api/mock/store.ts';
import { getAccountBalance, moveBetweenAccounts, setAccountBalance } from '@/api/mock/accountsStore.ts';
import { parseAmountWithTicker } from '@/lib/money.ts';

/** What the hold-confirmation screen worked out for the mock, since there is no server to decide. */
export interface ConfirmDealPatch {
  status: Deal['status'];
  from?: string;
  to?: string;
  rate?: string;
  holdAmount?: string;
}

/** A hold takes the frozen amount off the available deposit balance; a cancel gives it back. */
function adjustDeposit(holdAmount: string | undefined, sign: 1 | -1): void {
  if (!holdAmount) {
    return;
  }
  const { value, ticker } = parseAmountWithTicker(holdAmount);
  setAccountBalance('deposit', ticker, getAccountBalance('deposit', ticker) + sign * value);
}

/** ACCEPT_QUOTE: the quote is fixed and the deal waits for the top-up and the hold. */
export async function acceptQuote(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  return updateDeal(id, { status: 'AWAITING_FUNDS', quoteExpiresAt: undefined });
}

export async function confirmDeal(id: string, patch: ConfirmDealPatch): Promise<Deal | undefined> {
  await mockDelay('write');
  adjustDeposit(patch.holdAmount, -1);
  return updateDeal(id, patch);
}

/** REJECT_QUOTE on a first quote, or CANCEL: a frozen amount goes back to the deposit account. */
export async function declineDeal(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  const deal = findDeal(id);
  if (deal && (deal.status === 'RUNNING' || deal.status === 'SHORTFALL_REVIEW' || deal.status === 'REPRICE_PROPOSED')) {
    adjustDeposit(deal.holdAmount, 1);
  }
  return updateDeal(id, { status: 'DECLINED', reprice: undefined, quoteExpiresAt: undefined });
}

/** The operator's new terms are taken: back to the top-up screen with them. */
export async function acceptTerms(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  return updateDeal(id, { status: 'AWAITING_FUNDS', previous: undefined, quoteExpiresAt: undefined });
}

/** Declined or expired new terms: the deal keeps the previous ones (TOPUP, not EXPIRED). */
function restorePreviousTerms(id: string): Deal | undefined {
  const previous = findDeal(id)?.previous;
  return updateDeal(id, {
    status: 'AWAITING_FUNDS',
    ...(previous ?? {}),
    previous: undefined,
    quoteExpiresAt: undefined,
  });
}

export async function rejectTerms(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  return restorePreviousTerms(id);
}

/** The new rate on the frozen amount is taken: the deal executes at it. */
export async function acceptReprice(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  const reprice = findDeal(id)?.reprice;
  return updateDeal(id, { status: 'RUNNING', ...(reprice ?? {}), reprice: undefined });
}

/** The new rate is declined: back to the operator's decision on the shortfall. */
export async function rejectReprice(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  return updateDeal(id, { status: 'SHORTFALL_REVIEW', reprice: undefined, repriceRejected: true });
}

/**
 * Scenario С-08: the deal keeps its id and goes back to waiting for the
 * operator's quote (`RATE_PENDING`). The old rate and amount no longer apply.
 */
export async function requestNewRate(id: string): Promise<Deal | undefined> {
  await mockDelay('write');
  return updateDeal(id, { status: 'RATE_PENDING', to: null, rate: null });
}

/**
 * Client-driven: the card's own countdown hits zero. No delay — this isn't a user action. A quote
 * expires; new terms that ran out leave the deal on its previous terms.
 */
export function expireQuote(id: string): Deal | undefined {
  if (findDeal(id)?.status === 'TERMS_PROPOSED') {
    return restorePreviousTerms(id);
  }
  return updateDeal(id, { status: 'RATE_STALE', quoteExpiresAt: undefined });
}

export async function transfer(request: TransferRequest): Promise<void> {
  await mockDelay('write');
  moveBetweenAccounts(request.from, request.to, request.ticker, Number(request.amount));
}

/** Dev-only: forces the deposit balance for a ticker, used by the deal-detail scenario switch. */
export function setDepositBalanceForTesting(ticker: string, amount: number): void {
  setAccountBalance('deposit', ticker, amount);
}
