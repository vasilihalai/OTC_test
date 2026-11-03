import type { DealDocumentKind, DealStatus } from '@/api/index.ts';
import { ru } from '@/i18n/ru.ts';

interface StatusMeta {
  listLabel: string;
  detailLabel: string;
}

// The chip text differs between the list and the detail header for
// AWAITING_FUNDS only — every other status shares one label in both places.
export const DEAL_STATUS_META: Record<DealStatus, StatusMeta> = {
  RATE_PENDING: { listLabel: ru.deals.statusRatePending, detailLabel: ru.deals.statusRatePending },
  RATE_ACTIVE: { listLabel: ru.deals.statusRateActive, detailLabel: ru.deals.statusRateActive },
  RATE_STALE: { listLabel: ru.deals.statusRateStale, detailLabel: ru.deals.statusRateStale },
  AWAITING_FUNDS: { listLabel: ru.deals.statusAwaitingFundsList, detailLabel: ru.deals.statusAwaitingFundsDetail },
  RUNNING: { listLabel: ru.deals.statusRunning, detailLabel: ru.deals.statusRunning },
  DONE: { listLabel: ru.deals.statusDone, detailLabel: ru.deals.statusDone },
  DECLINED: { listLabel: ru.deals.statusDeclined, detailLabel: ru.deals.statusDeclined },
  RATE_RENEGOTIATING: { listLabel: ru.deals.statusRenegotiating, detailLabel: ru.deals.statusRenegotiating },
};

const ACTIVE_STATUSES: DealStatus[] = ['RATE_PENDING', 'RATE_ACTIVE', 'RATE_STALE', 'AWAITING_FUNDS', 'RUNNING', 'RATE_RENEGOTIATING'];

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

export type DocumentAvailability = Record<DealDocumentKind, boolean> & { showCaption: boolean };

/**
 * BRD FR-7 and the OTC detail frames: the acceptance and the payment order
 * after the quote is confirmed, the certificate after execution. A declined
 * deal never gets them, so unlike the other locked rows it has no "станет
 * доступен позже" caption.
 */
export function getDocumentAvailability(status: DealStatus): DocumentAvailability {
  if (status === 'DONE') {
    return { accept: true, payment: true, certificate: true, showCaption: false };
  }
  if (status === 'DECLINED') {
    return { accept: false, payment: false, certificate: false, showCaption: false };
  }
  if (status === 'RATE_PENDING' || status === 'RATE_ACTIVE' || status === 'RATE_STALE' || status === 'RATE_RENEGOTIATING') {
    return { accept: false, payment: false, certificate: false, showCaption: true };
  }
  // AWAITING_FUNDS, RUNNING
  return { accept: true, payment: true, certificate: false, showCaption: true };
}

/** Only AWAITING_FUNDS is the hold-confirmation body now — RATE_ACTIVE is its own quote-card branch. */
export function isHoldConfirmationStatus(status: DealStatus): boolean {
  return status === 'AWAITING_FUNDS';
}

export interface DealDetailRows {
  give: boolean;
  receive: boolean;
  rate: boolean;
}

/**
 * What `Детали` shows besides Дата создания/Направление, per the OTC detail
 * frames. An active quote carries its amounts and rate on the card above;
 * "Вы получите" only appears once the rate behind it is settled.
 */
export function getDetailRows(status: DealStatus): DealDetailRows {
  switch (status) {
    case 'RATE_ACTIVE':
      return { give: false, receive: false, rate: false };
    case 'RATE_PENDING':
      return { give: false, receive: false, rate: true };
    case 'RATE_STALE':
    case 'AWAITING_FUNDS':
    case 'RATE_RENEGOTIATING':
      return { give: true, receive: false, rate: true };
    default:
      return { give: true, receive: true, rate: true };
  }
}

/** §7.7 — `EXECUTED`/`CANCELED`/`ERROR` (→ `DONE`/`DECLINED`) stop polling entirely; nothing about them changes server-side again. */
export function isTerminalDealStatus(status: DealStatus): boolean {
  return status === 'DONE' || status === 'DECLINED';
}
