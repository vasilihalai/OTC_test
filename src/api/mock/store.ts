import type { Deal, DealDocument, DealStatus } from '@/api/types.ts';
import { MOCK_DEALS, MOCK_MIN_DEAL } from '@/api/mock/fixtures.ts';
import { isEmptyDealsScenario, isQuoteExpiringScenario } from '@/lib/devSwitches.ts';
import { parseAmountWithTicker } from '@/lib/money.ts';
import { SAMPLE_DOCUMENT_URL } from '@/lib/sampleDocument.ts';

const PAYMENT_AVAILABLE: DealStatus[] = ['AWAITING_FUNDS', 'SHORTFALL_REVIEW', 'REPRICE_PROPOSED', 'RUNNING', 'DONE'];

/**
 * The three deal documents (BRD FR-7, the frames): the acceptance and the payment instruction once the
 * quote is accepted, the execution certificate after settlement.
 */
function documentsFor(status: DealStatus): DealDocument[] {
  const accepted = PAYMENT_AVAILABLE.includes(status);
  const settled = status === 'DONE';
  return [
    { kind: 'accept', available: accepted, href: accepted ? SAMPLE_DOCUMENT_URL : undefined },
    { kind: 'payment', available: accepted, href: accepted ? SAMPLE_DOCUMENT_URL : undefined },
    { kind: 'certificate', available: settled, href: settled ? SAMPLE_DOCUMENT_URL : undefined },
  ];
}

/** What the backend computes for every card: the plain amount, the minimum, the documents. */
function withServerFields(deal: Deal): Deal {
  return {
    ...deal,
    amount: String(parseAmountWithTicker(deal.from).value),
    minAmount: deal.minAmount ?? MOCK_MIN_DEAL[deal.ticker],
    documents: documentsFor(deal.status),
  };
}

// In-memory, mutated by actions.mock.ts so a status change is visible
// immediately and survives navigation within the session; a reload resets
// back to the fixtures.
const deals: Deal[] = isEmptyDealsScenario() ? [] : MOCK_DEALS.map((deal) => {
  if (isQuoteExpiringScenario() && (deal.status === 'RATE_ACTIVE' || deal.status === 'TERMS_PROPOSED')) {
    return withServerFields({ ...deal, quoteExpiresAt: new Date(Date.now() + 10_000).toISOString() });
  }
  return withServerFields(deal);
});

export function listDeals(): Deal[] {
  return deals;
}

export function findDeal(id: string): Deal | undefined {
  return deals.find((deal) => deal.id === id);
}

export function updateDeal(id: string, patch: Partial<Deal>): Deal | undefined {
  const index = deals.findIndex((deal) => deal.id === id);
  if (index === -1) {
    return undefined;
  }
  deals[index] = withServerFields({ ...deals[index], ...patch });
  return deals[index];
}
