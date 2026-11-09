import type { DealStatus } from '@/api/index.ts';
import { ru } from '@/i18n/ru.ts';

interface StatusMeta {
  listLabel: string;
  detailLabel: string;
}

/**
 * The list can't tell the operator's new terms from a first quote, nor a new rate from the wait
 * for the operator (the list item has no `previousRate`/`proposedRate`), so those read as their
 * first meaning there and get their own label only on the card.
 */
export const DEAL_STATUS_META: Record<DealStatus, StatusMeta> = {
  RATE_PENDING: { listLabel: ru.deals.statusRatePending, detailLabel: ru.deals.statusRatePending },
  RATE_ACTIVE: { listLabel: ru.deals.statusRateActive, detailLabel: ru.deals.statusRateActive },
  TERMS_PROPOSED: { listLabel: ru.deals.statusTermsProposed, detailLabel: ru.deals.statusTermsProposed },
  RATE_STALE: { listLabel: ru.deals.statusRateStale, detailLabel: ru.deals.statusRateStale },
  AWAITING_FUNDS: { listLabel: ru.deals.statusAwaitingFundsList, detailLabel: ru.deals.statusAwaitingFundsDetail },
  SHORTFALL_REVIEW: { listLabel: ru.deals.statusRenegotiating, detailLabel: ru.deals.statusRenegotiating },
  REPRICE_PROPOSED: { listLabel: ru.deals.statusRepriceProposed, detailLabel: ru.deals.statusRepriceProposed },
  RUNNING: { listLabel: ru.deals.statusRunning, detailLabel: ru.deals.statusRunning },
  DONE: { listLabel: ru.deals.statusDone, detailLabel: ru.deals.statusDone },
  DECLINED: { listLabel: ru.deals.statusDeclined, detailLabel: ru.deals.statusDeclined },
};

const ACTIVE_STATUSES: DealStatus[] = [
  'RATE_PENDING', 'RATE_ACTIVE', 'TERMS_PROPOSED', 'RATE_STALE', 'AWAITING_FUNDS',
  'SHORTFALL_REVIEW', 'REPRICE_PROPOSED', 'RUNNING',
];

export type DealFilter = 'ALL' | 'ACTIVE' | 'DONE' | 'DECLINED';

export function matchesFilter(status: DealStatus, filter: DealFilter): boolean {
  if (filter === 'ALL') {
    return true;
  }
  if (filter === 'ACTIVE') {
    return ACTIVE_STATUSES.includes(status);
  }
  if (filter === 'DONE') {
    return status === 'DONE';
  }
  return status === 'DECLINED';
}

export interface DealDetailRows {
  give: boolean;
  receive: boolean;
  rate: boolean;
  hold: boolean;
}

/**
 * What `Детали` shows besides Дата создания/Направление, per the OTC detail frames. A card that
 * carries the amounts and the rate itself (a quote, new terms, a new rate) leaves them out here;
 * "Вы получите" only appears once the rate behind it is settled.
 */
export function getDetailRows(status: DealStatus): DealDetailRows {
  switch (status) {
    case 'RATE_ACTIVE':
    case 'TERMS_PROPOSED':
    case 'REPRICE_PROPOSED':
      return { give: false, receive: false, rate: false, hold: false };
    case 'RATE_PENDING':
      return { give: false, receive: false, rate: true, hold: false };
    case 'RATE_STALE':
    case 'AWAITING_FUNDS':
      return { give: true, receive: false, rate: true, hold: false };
    case 'SHORTFALL_REVIEW':
      return { give: true, receive: false, rate: true, hold: true };
    default:
      return { give: true, receive: true, rate: true, hold: false };
  }
}

/** `EXECUTED`/`CANCELED`/`ERROR` (→ `DONE`/`DECLINED`) stop polling; nothing about them changes server-side again. */
export function isTerminalDealStatus(status: DealStatus): boolean {
  return status === 'DONE' || status === 'DECLINED';
}
