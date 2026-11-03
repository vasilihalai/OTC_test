import type { Deal, DealDirection, DealDocument, DealDocumentKind, OtcAccessResult, Stats } from '@/api/types.ts';
import { apiFetch, apiFetchBlob } from '@/api/http.ts';
import { ApiError } from '@/api/real/http/apiError.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';
import { gatewayPath } from '@/api/real/http/servicePaths.ts';
import { useToastStore } from '@/store/toast.ts';
import { formatDealDate } from '@/lib/date.ts';
import { formatAmount, formatAmountInput } from '@/lib/money.ts';
import { type OtcRealStatus, mapOtcStatus } from '@/lib/otcStatus.ts';
import { openExternalLink, openFetchedPdf } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

/**
 * api-integration.md §7.1. Called on app boot (after profile) and again on
 * resume from background per the doc's own instruction — "a client whose
 * verification completed while the app was open should not have to restart
 * it."
 */
export async function getOtcAccess(): Promise<OtcAccessResult> {
  const res = await apiFetch<({ result?: Partial<OtcAccessResult> } & Partial<OtcAccessResult>) | null>(
    '/v1/otc/access', {}, false, 'financial',
  );
  const access = res?.result ?? res;
  if (typeof access?.enabled !== 'boolean') {
    console.error('[otc] unexpected /v1/otc/access response shape', describeShape(res));
    throw new Error('Unexpected OTC access response shape');
  }
  return { enabled: access.enabled, available: access.available ?? true, reasons: access.reasons ?? [] };
}

interface DashboardCounter {
  value: number;
  calculatedAt: string;
}

/**
 * §7.2 — feeds Home's two stat cards. Three counters exist server-side
 * (`activeRequests`, `turnover30Days`, `executedDeals`); the design only
 * shows two, so `executedDeals` is read and discarded per the doc's own
 * instruction. `turnover30Days`'s `value` isn't documented as a plain
 * number or an already-formatted string with its currency baked in — typed
 * loosely (`unknown`, coerced to a display string) since either reads fine
 * as `Stats.volume30d`; `volumeAsset` has no separate field in the response
 * at all, so it ships empty until the backend clarifies.
 */
export async function getStats(): Promise<Stats> {
  const res = await apiFetch<{
    result: { counters: { activeRequests: DashboardCounter; turnover30Days: { value: unknown; calculatedAt: string } } };
  }>('/v1/otc/dashboard', {}, false, 'financial');
  const { counters } = res.result;
  return {
    activeDeals: counters.activeRequests.value,
    volume30d: String(counters.turnover30Days.value),
    volumeAsset: '',
  };
}

const DIRECTION_MAP: Record<string, DealDirection> = { buy: 'BUY', sell: 'SELL', exchange: 'EXCHANGE' };

// The detail response has no createdAt (§7.4), only the list does: kept from
// the list so the card's "Дата создания" row still fills in.
const createdAtById = new Map<string, string>();

interface RawRateFields {
  direction: 'buy' | 'sell' | 'exchange';
  assetFrom: string;
  assetTo: string;
  rate: string | null;
}

/** ТЗ §5.1: `rate` is the "to" amount per 1 "from" on a sale, the "from" amount per 1 "to" on a purchase. */
function rateFields(raw: RawRateFields): Pick<Deal, 'rate' | 'ratePerUnit' | 'rateUnitLabel'> {
  if (!raw.rate) {
    return { rate: null };
  }
  const [base, quote] = raw.direction === 'buy' ? [raw.assetTo, raw.assetFrom] : [raw.assetFrom, raw.assetTo];
  const value = formatAmountInput(raw.rate.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
  return { rate: `1 ${base} = ${value} ${quote}`, ratePerUnit: value, rateUnitLabel: `${quote} за 1 ${base}` };
}

interface RawDealListItem {
  operationId: string;
  requestNumber: string;
  createdAt: string;
  rateExpiresAt: string | null;
  direction: 'buy' | 'sell' | 'exchange';
  assetFrom: string;
  assetTo: string;
  amountFrom: string;
  amountTo: string;
  rate: string | null;
  status: OtcRealStatus;
}

function mapListItem(raw: RawDealListItem): Deal {
  createdAtById.set(raw.operationId, raw.createdAt);
  return {
    id: raw.operationId,
    requestNumber: raw.requestNumber,
    status: mapOtcStatus(raw.status),
    date: formatDealDate(raw.createdAt),
    direction: DIRECTION_MAP[raw.direction] ?? 'EXCHANGE',
    from: `${formatAmount(raw.amountFrom, raw.assetFrom)} ${raw.assetFrom}`,
    to: raw.amountTo ? `${formatAmount(raw.amountTo, raw.assetTo)} ${raw.assetTo}` : null,
    ...rateFields(raw),
    ticker: raw.assetFrom,
    quoteExpiresAt: raw.rateExpiresAt ?? undefined,
  };
}

export interface OtcListFilters {
  statuses?: OtcRealStatus[];
  direction?: ('buy' | 'sell' | 'exchange')[];
}

/** `POST /otc/deals` — §7.3. `filters.statuses` omitted (not an empty array) means "Все," per the doc's explicit note. */
export async function getDeals(filters: OtcListFilters = {}, size = 20): Promise<Deal[]> {
  const res = await apiFetch<{ result: { operations: RawDealListItem[] } }>('/v1/otc/deals', {
    method: 'POST',
    body: JSON.stringify({ filters, pagination: { page: 0, size } }),
  }, false, 'financial');
  return res.result.operations.map(mapListItem);
}

interface RawDocument {
  nameKey: string;
  href?: string | null;
  available?: boolean;
}

/**
 * dev sends PAYMENT_INSTRUCTION and EXECUTION_ACT; the acceptance's key isn't
 * known yet because no such document comes back. Anything else stays off
 * screen: FR-7's "Операция трейдера" must never reach the client.
 */
function documentKind(nameKey: string): DealDocumentKind | undefined {
  if (nameKey === 'PAYMENT_INSTRUCTION') {
    return 'payment';
  }
  if (nameKey === 'EXECUTION_ACT') {
    return 'certificate';
  }
  return nameKey.includes('ACCEPT') ? 'accept' : undefined;
}

function mapDocuments(raw: RawDocument[] = []): DealDocument[] {
  return raw.flatMap((document) => {
    const kind = documentKind(document.nameKey);
    if (!kind) {
      console.warn('[otc] Unknown document, not shown:', document.nameKey);
      return [];
    }
    return [{ kind, href: document.href ?? undefined, available: document.available !== false }];
  });
}

interface RawDealDetail {
  requestNumber: string;
  createdAt?: string;
  direction: 'buy' | 'sell' | 'exchange';
  assetFrom: string;
  assetTo: string;
  status: OtcRealStatus;
  detailsStatus: string;
  rateExpiresAt: string | null;
  amountFrom: string;
  amountTo: string;
  rate: string | null;
  balance: string | null;
  missingAmount: string | null;
  documents?: RawDocument[];
}

function mapDetail(operationId: string, raw: RawDealDetail): Deal {
  const createdAt = raw.createdAt ?? createdAtById.get(operationId);
  return {
    id: operationId,
    requestNumber: raw.requestNumber,
    status: mapOtcStatus(raw.status),
    date: createdAt ? formatDealDate(createdAt) : '',
    direction: DIRECTION_MAP[raw.direction] ?? 'EXCHANGE',
    from: `${formatAmount(raw.amountFrom, raw.assetFrom)} ${raw.assetFrom}`,
    to: raw.amountTo ? `${formatAmount(raw.amountTo, raw.assetTo)} ${raw.assetTo}` : null,
    ...rateFields(raw),
    ticker: raw.assetFrom,
    quoteExpiresAt: raw.rateExpiresAt ?? undefined,
    balance: raw.balance ?? undefined,
    missingAmount: raw.missingAmount ?? undefined,
    documents: mapDocuments(raw.documents),
    detailsStatus: raw.detailsStatus,
  };
}

/** `GET /otc/deals/{operationId}` — §7.4. `undefined` on a 404, matching the mock's `Deal | undefined` shape. */
export async function getDealById(operationId: string): Promise<Deal | undefined> {
  try {
    const res = await apiFetch<{ result: RawDealDetail }>(`/v1/otc/deals/${operationId}`, {}, false, 'financial');
    return mapDetail(operationId, res.result);
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 404) {
      return undefined;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Commands — §7.6. Only the five with a real, built screen today: ACCEPT_QUOTE/
// REJECT_QUOTE (RATE_ACTIVE), REQUEST_NEW_RATE (RATE_STALE), CONFIRM_HOLD
// (AWAITING_FUNDS), CANCEL (RATE_PENDING and RATE_RENEGOTIATING). The other
// four — ACCEPT_AMOUNT/REJECT_AMOUNT, ACCEPT_REPRICE/REJECT_REPRICE — have no
// caller anywhere in the app: they're REQUOTE's accept/reject step, and
// REQUOTE has no screen to trigger them from yet (see lib/otcStatus.ts).
// ---------------------------------------------------------------------------

export type OtcCommand =
  | 'ACCEPT_QUOTE' | 'REJECT_QUOTE' | 'REQUEST_NEW_RATE' | 'CONFIRM_HOLD' | 'CANCEL';

/**
 * §7.6: "After any command: refetch the deal, do not optimistically set the
 * status from the response" — the command response is just `{operationId,
 * status}`, but `detailsStatus`/amounts may also have moved, so this always
 * re-fetches the full detail rather than trusting that shape.
 *
 * `409 Conflict` ("the command is no longer valid for the current state —
 * someone or something moved the deal underneath the user") is handled
 * specifically per the doc's own instruction: swallow it, toast, and still
 * refetch + re-render with whatever the deal's real current state turns out
 * to be, instead of surfacing a generic error.
 */
export async function sendOtcCommand(operationId: string, command: OtcCommand): Promise<Deal | undefined> {
  try {
    await apiFetch<{ operationId: string; status: OtcRealStatus }>(
      `/v2/operations/otc/${operationId}/commands/${command}`,
      { method: 'POST' },
      false,
      'financial',
    );
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 409) {
      useToastStore.getState().show(ru.dealDetail.statusChangedToast);
    } else {
      throw err;
    }
  }
  return getDealById(operationId);
}

const NEW_RATE_RECHECKS = 3;

/**
 * The OTC process applies a command asynchronously, so the refetch right after
 * it can still read the expired quote. Rechecked briefly so the tap lands on
 * "Оператор готовит курс" instead of looking ignored until the next 10s poll.
 */
export async function requestNewRate(operationId: string): Promise<Deal | undefined> {
  let deal = await sendOtcCommand(operationId, 'REQUEST_NEW_RATE');
  for (let attempt = 0; attempt < NEW_RATE_RECHECKS && deal?.status === 'RATE_STALE'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    deal = await getDealById(operationId);
  }
  if (deal?.status === 'RATE_STALE') {
    console.warn('[otc] Deal still EXPIRED after REQUEST_NEW_RATE', operationId, deal.detailsStatus);
  }
  return deal;
}

/**
 * FR-13.8: a document opens in the external browser from a short-lived signed
 * link. A bare gateway URL needs the session token, which that browser doesn't
 * have — it would land on a sign-in screen — so it's downloaded here instead.
 */
export async function openDealDocument(href: string): Promise<void> {
  const path = gatewayPath('financial', href);
  if (path === undefined) {
    openExternalLink(href);
    return;
  }
  await openFetchedPdf(() => apiFetchBlob(path));
}
