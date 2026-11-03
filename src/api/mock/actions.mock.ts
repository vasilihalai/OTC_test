import type { Deal, TransferRequest } from '@/api/types.ts';
import { mockDelay } from '@/api/mock/fixtures.ts';
import { updateDeal } from '@/api/mock/store.ts';
import { moveBetweenAccounts, setAccountBalance } from '@/api/mock/accountsStore.ts';

export interface ConfirmDealPatch {
  status: Deal['status'];
  from?: string;
  to?: string;
  rate?: string;
}

export async function confirmDeal(id: string, patch: ConfirmDealPatch): Promise<Deal | undefined> {
  await mockDelay();
  return updateDeal(id, patch);
}

export async function declineDeal(id: string): Promise<Deal | undefined> {
  await mockDelay();
  return updateDeal(id, { status: 'DECLINED' });
}

/**
 * Scenario С-08: the deal keeps its id and goes back to waiting for the
 * operator's quote (`RATE_PENDING`). The old rate and amount no longer apply.
 */
export async function requestNewRate(id: string): Promise<Deal | undefined> {
  await mockDelay();
  return updateDeal(id, { status: 'RATE_PENDING', to: null, rate: null });
}

/** Client-driven: the quote card's own countdown hits zero. No delay — this isn't a user action. */
export function expireQuote(id: string): Deal | undefined {
  return updateDeal(id, { status: 'RATE_STALE' });
}

export async function transfer(request: TransferRequest): Promise<void> {
  await mockDelay();
  moveBetweenAccounts(request.from, request.to, request.ticker, Number(request.amount));
}

/** Dev-only: forces the deposit balance for a ticker, used by the deal-detail scenario switch. */
export function setDepositBalanceForTesting(ticker: string, amount: number): void {
  setAccountBalance('deposit', ticker, amount);
}
