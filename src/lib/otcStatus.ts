import type { DealStatus } from '@/api/types.ts';

/**
 * `StatusEnum` of `POST /v1/otc/deals` and `GET /v1/otc/deals/{id}` (BRCE-4023 §2). The state of a deal
 * lives in `status`; `detailsStatus` is a deprecated mirror and is not read. `INITIALIZED`, `PENDING`,
 * `ACTIVE`, `ACCEPTED` and `PROPOSED` are left from the contract before BRCE-3450: only deals that got
 * stuck in them before 02.10 can still carry them.
 */
export type OtcRealStatus =
  | 'QUOTING' | 'QUOTED' | 'EXPIRED' | 'REQUOTE' | 'TOPUP' | 'CHECKING' | 'REPRICE'
  | 'HOLD' | 'EXECUTED' | 'CANCELED' | 'ERROR'
  | 'PROPOSED' | 'INITIALIZED' | 'PENDING' | 'ACTIVE' | 'ACCEPTED';

/** The card fields that split one backend status into two screens. The list doesn't carry them. */
export interface OtcStatusDetails {
  previousRate?: string | null;
  proposedRate?: string | null;
}

/**
 * Backend status → screen. `QUOTED` is the first quote unless `previousRate` says the operator changed
 * the terms after the quote was accepted; `REPRICE` waits for the operator unless `proposedRate` carries
 * a new rate for the client to accept. Without details (the deals list) both fall back to their first
 * meaning. A status this doesn't know renders read-only: a button on an unknown state is how a client
 * accepts something nobody intended.
 */
export function mapOtcStatus(status: OtcRealStatus, details: OtcStatusDetails = {}): DealStatus {
  switch (status) {
    case 'QUOTING':
    case 'REQUOTE':
    case 'INITIALIZED':
    case 'PENDING':
      return 'RATE_PENDING';
    case 'QUOTED':
      return details.previousRate ? 'TERMS_PROPOSED' : 'RATE_ACTIVE';
    case 'ACTIVE':
      return 'RATE_ACTIVE';
    case 'PROPOSED':
      return 'TERMS_PROPOSED';
    case 'EXPIRED':
      return 'RATE_STALE';
    case 'TOPUP':
    case 'CHECKING':
    case 'ACCEPTED':
      return 'AWAITING_FUNDS';
    case 'REPRICE':
      return details.proposedRate ? 'REPRICE_PROPOSED' : 'SHORTFALL_REVIEW';
    case 'HOLD':
      return 'RUNNING';
    case 'EXECUTED':
      return 'DONE';
    case 'CANCELED':
    case 'ERROR':
      return 'DECLINED';
    default: {
      console.warn('[otc] Unrecognized status from backend, rendering read-only:', status);
      return 'DECLINED';
    }
  }
}
