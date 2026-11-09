import type {
  Deal,
  DealDirection,
  DealDocument,
  DealDocumentKind,
  DealStatus,
  DealTerms,
  FiatRequisites,
  Requisites,
  Stats,
} from '@/api/types.ts';
import { apiFetch, apiFetchBlob } from '@/api/http.ts';
import { ApiError } from '@/api/real/http/apiError.ts';
import { gatewayPath } from '@/api/real/http/servicePaths.ts';
import { assetName } from '@/api/real/balances.ts';
import { useToastStore } from '@/store/toast.ts';
import { formatDealDate } from '@/lib/date.ts';
import { msUntil } from '@/lib/countdown.ts';
import { formatAmount, formatAmountInput } from '@/lib/money.ts';
import { type OtcRealStatus, mapOtcStatus } from '@/lib/otcStatus.ts';
import { openExternalLink, openFetchedPdf } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

type RawDirection = 'buy' | 'sell' | 'exchange';

const DIRECTION_MAP: Record<string, DealDirection> = { buy: 'BUY', sell: 'SELL', exchange: 'EXCHANGE' };

function directionOf(raw: string): DealDirection {
  return DIRECTION_MAP[raw.toLowerCase()] ?? 'EXCHANGE';
}

// Older detail responses had no createdAt, only the list did: kept from the list as a fallback.
const createdAtById = new Map<string, string>();

interface RawRateFields {
  direction: RawDirection;
  assetFrom: string;
  assetTo: string;
}

/** ТЗ §5.1: `rate` is the "to" amount per 1 "from" on a sale, the "from" amount per 1 "to" on a purchase. */
function rateFields(raw: RawRateFields, rate: string | null | undefined): Pick<DealTerms, 'rate' | 'ratePerUnit' | 'rateUnitLabel'> {
  if (!rate) {
    return { rate: null };
  }
  const [base, quote] = directionOf(raw.direction) === 'BUY' ? [raw.assetTo, raw.assetFrom] : [raw.assetFrom, raw.assetTo];
  const value = formatAmountInput(rate.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
  return { rate: `1 ${base} = ${value} ${quote}`, ratePerUnit: value, rateUnitLabel: `${quote} за 1 ${base}` };
}

function amountLabel(value: string | null | undefined, ticker: string): string | null {
  return value ? `${formatAmount(value, ticker)} ${ticker}` : null;
}

interface RawDealListItem {
  operationId: string;
  requestNumber: string;
  createdAt: string;
  rateExpiresAt: string | null;
  direction: RawDirection;
  assetFrom: string;
  assetTo: string;
  amountFrom: string;
  amountTo: string | null;
  rate: string | null;
  status: OtcRealStatus;
}

/** The list has no `previousRate`/`proposedRate`, so QUOTED reads as a quote and REPRICE as the operator's turn. */
function mapListItem(raw: RawDealListItem): Deal {
  createdAtById.set(raw.operationId, raw.createdAt);
  const status = mapOtcStatus(raw.status);
  return {
    id: raw.operationId,
    requestNumber: raw.requestNumber,
    status,
    date: formatDealDate(raw.createdAt),
    direction: directionOf(raw.direction),
    from: amountLabel(raw.amountFrom, raw.assetFrom) ?? '',
    to: amountLabel(raw.amountTo, raw.assetTo),
    ...rateFields(raw, raw.rate),
    ticker: raw.assetFrom,
    toTicker: raw.assetTo,
    amount: raw.amountFrom,
    quoteExpiresAt: status === 'RATE_ACTIVE' ? raw.rateExpiresAt ?? undefined : undefined,
  };
}

export interface OtcListFilters {
  statuses?: OtcRealStatus[];
  direction?: RawDirection[];
}

/** `POST /v1/otc/deals`. `filters.statuses` omitted (not an empty array) means "Все". */
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
  hrefExpiresAt?: string | null;
  available?: boolean;
  availabilityHint?: string | null;
}

/**
 * The deal's documents are `PAYMENT_INSTRUCTION` and `EXECUTION_ACT` (BRCE-4023 §7); the acceptance's
 * key isn't settled yet, so any deal-level `…ACCEPT…` key is read as it. Anything else stays off screen:
 * FR-7's "Операция трейдера" must never reach the client, and the account certificate
 * (`ACCOUNT_ACCEPTANCE_CERTIFICATE`) is not a deal document.
 */
function documentKind(nameKey: string): DealDocumentKind | undefined {
  if (nameKey === 'PAYMENT_INSTRUCTION') {
    return 'payment';
  }
  if (nameKey === 'EXECUTION_ACT') {
    return 'certificate';
  }
  return nameKey.includes('ACCEPT') && !nameKey.startsWith('ACCOUNT_') ? 'accept' : undefined;
}

function mapDocuments(raw: RawDocument[] = []): DealDocument[] {
  return raw.flatMap((document) => {
    const kind = documentKind(document.nameKey);
    if (!kind) {
      console.warn('[otc] Unknown document, not shown:', document.nameKey);
      return [];
    }
    return [{
      kind,
      href: document.href ?? undefined,
      hrefExpiresAt: document.hrefExpiresAt ?? undefined,
      available: document.available !== false,
    }];
  });
}

/** `OtcOperationDetails`, common-module 0.1.273. A field without a value comes as `null`. */
interface RawDealDetail {
  requestNumber: string;
  createdAt?: string;
  direction: RawDirection;
  assetFrom: string;
  assetTo: string;
  status: OtcRealStatus;
  rateExpiresAt: string | null;
  amountFrom: string;
  amountTo: string | null;
  rate: string | null;
  actualAmountFrom?: string | null;
  actualAmountTo?: string | null;
  minAmount?: string | null;
  holdAmount?: string | null;
  previousAmountFrom?: string | null;
  previousAmountTo?: string | null;
  previousRate?: string | null;
  proposedRate?: string | null;
  proposedAmountFrom?: string | null;
  proposedAmountTo?: string | null;
  repriceOutcome?: 'ACCEPTED' | 'REJECTED' | null;
  balance?: string | null;
  missingAmount?: string | null;
  documents?: RawDocument[];
}

function mapDetail(operationId: string, raw: RawDealDetail): Deal {
  const createdAt = raw.createdAt ?? createdAtById.get(operationId);
  const status = mapOtcStatus(raw.status, raw);
  const deal: Deal = {
    id: operationId,
    requestNumber: raw.requestNumber,
    status,
    date: createdAt ? formatDealDate(createdAt) : '',
    direction: directionOf(raw.direction),
    from: amountLabel(raw.amountFrom, raw.assetFrom) ?? '',
    to: amountLabel(raw.amountTo, raw.assetTo),
    ...rateFields(raw, raw.rate),
    ticker: raw.assetFrom,
    toTicker: raw.assetTo,
    amount: raw.amountFrom,
    // After the quote is accepted `rateExpiresAt` is not a top-up deadline (BRCE-4023 §4, Р1).
    quoteExpiresAt: status === 'RATE_ACTIVE' || status === 'TERMS_PROPOSED' ? raw.rateExpiresAt ?? undefined : undefined,
    balance: raw.balance ?? undefined,
    missingAmount: raw.missingAmount ?? undefined,
    minAmount: raw.minAmount ?? undefined,
    actualFrom: amountLabel(raw.actualAmountFrom, raw.assetFrom) ?? undefined,
    actualTo: amountLabel(raw.actualAmountTo, raw.assetTo) ?? undefined,
    holdAmount: amountLabel(raw.holdAmount, raw.assetFrom) ?? undefined,
    documents: mapDocuments(raw.documents),
  };
  if (status === 'TERMS_PROPOSED') {
    if (raw.status === 'PROPOSED') {
      // Deals stuck in the pre-02.10 proposal: the card already shows the new terms, the old ones aren't sent.
      deal.legacyProposal = true;
    } else {
      deal.previous = {
        from: amountLabel(raw.previousAmountFrom ?? raw.amountFrom, raw.assetFrom) ?? '',
        to: amountLabel(raw.previousAmountTo, raw.assetTo),
        ...rateFields(raw, raw.previousRate),
      };
    }
  }
  if (status === 'REPRICE_PROPOSED') {
    // Before BRCE-4023 there's no proposedAmountFrom; the frozen amount is the same figure.
    deal.reprice = {
      from: amountLabel(raw.proposedAmountFrom ?? raw.holdAmount ?? raw.actualAmountFrom, raw.assetFrom) ?? '',
      to: amountLabel(raw.proposedAmountTo, raw.assetTo),
      ...rateFields(raw, raw.proposedRate),
    };
  }
  if (status === 'SHORTFALL_REVIEW') {
    deal.repriceRejected = raw.repriceOutcome === 'REJECTED';
  }
  return deal;
}

/** `GET /v1/otc/deals/{operationId}`. `undefined` on a 404, matching the mock's `Deal | undefined` shape. */
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

interface RawCryptoNetwork {
  currency?: string;
  network?: string | null;
  networkLabel?: string | null;
  address: string;
}

interface RawCryptoRequisites extends RawCryptoNetwork {
  currency: string;
  /** Every network of the asset, when it has several; each item may leave out `currency`. */
  networks?: RawCryptoNetwork[] | null;
}

interface RawRequisites {
  kind: 'FIAT' | 'CRYPTO';
  title?: string | null;
  paymentPurpose?: string | null;
  bank?: Record<string, string | null> | null;
  /**
   * One object for an asset with a single network. For an asset with several the backend sends every
   * network with its address; read either as a list here or as `networks` inside the object.
   */
  crypto?: RawCryptoRequisites | RawCryptoRequisites[] | null;
}

const BANK_FIELDS = [
  'companyName', 'recipientName', 'recipientAddress', 'recipientAccount', 'account', 'bankName', 'bankAddress', 'bic',
  'bankSwift', 'correspondentAccount', 'correspondentBankName', 'correspondentBankAddress', 'correspondentBankSwift',
  'intermediaryBankName', 'intermediaryBankAddress', 'intermediaryBankSwift',
] as const;

/**
 * `GET /v1/otc/deals/{operationId}/requisites` (BRCE-4023 §1): on a purchase the account the operator
 * chose in CRM (auto-picked when `title` is null); on a sale or an exchange the coin, network and
 * deposit address — one per network, and the client picks when there are several. Read once per
 * screen, the method is not meant for polling. Any failure, an empty answer included, throws: the
 * screen offers a retry.
 */
export async function getDealRequisites(operationId: string): Promise<Requisites> {
  const raw = (await apiFetch<{ result: RawRequisites }>(`/v1/otc/deals/${operationId}/requisites`, {}, false, 'financial')).result;
  if (raw.kind === 'CRYPTO') {
    const items = Array.isArray(raw.crypto) ? raw.crypto : raw.crypto ? [raw.crypto] : [];
    const asset = items[0]?.currency;
    const list = items
      .flatMap((item): RawCryptoNetwork[] => (item.networks?.length ? item.networks : [item]))
      .filter((item) => item.address);
    if (!asset || list.length === 0) {
      throw new Error('Crypto requisites without an address');
    }
    const networks = list.map((item) => ({ network: item.networkLabel || item.network || '', address: item.address }));
    return {
      kind: 'crypto',
      asset,
      assetName: assetName(asset),
      network: networks[0].network,
      address: networks[0].address,
      networks,
    };
  }
  if (!raw.bank) {
    throw new Error('Fiat requisites without bank details');
  }
  const bank = raw.bank;
  const requisites: FiatRequisites = {
    kind: 'fiat',
    title: raw.title ?? undefined,
    purpose: raw.paymentPurpose ?? undefined,
  };
  for (const field of BANK_FIELDS) {
    const value = bank[field];
    if (value) {
      requisites[field] = value;
    }
  }
  return requisites;
}

export type OtcCommand =
  | 'ACCEPT_QUOTE' | 'REJECT_QUOTE' | 'REQUEST_NEW_RATE' | 'CONFIRM_HOLD'
  | 'ACCEPT_AMOUNT' | 'REJECT_AMOUNT' | 'ACCEPT_REPRICE' | 'REJECT_REPRICE' | 'CANCEL';

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const NETWORK_RETRIES = 2;

/**
 * `POST /v1/operations/otc/{operationId}/commands/{command}`. `x-request-id` is the idempotency key
 * (BRCE-4023 §6): a dropped connection or a gateway hiccup is retried with the same id, so the server
 * applies the command once and answers the repeat with the current status.
 */
async function postCommand(operationId: string, command: OtcCommand, requestId: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await apiFetch(`/v1/operations/otc/${operationId}/commands/${command}`, {
        method: 'POST',
        headers: { 'x-request-id': requestId },
      }, false, 'financial');
      return;
    } catch (err) {
      const transient = err instanceof TypeError || (err instanceof ApiError && TRANSIENT_STATUSES.has(err.httpStatus));
      if (!transient || attempt >= NETWORK_RETRIES) {
        throw err;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
}

const EARLY_REPRICE_RETRIES = 3;

/**
 * The new rate shows up in the card before the process can take the answer, so an early
 * ACCEPT_REPRICE/REJECT_REPRICE gets 409 and is repeated. Each repeat is a new attempt with its own id:
 * if an earlier one did land, the repeat gets 409 and changes nothing.
 */
async function postRepriceDecision(operationId: string, command: OtcCommand): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await postCommand(operationId, command, crypto.randomUUID());
      return;
    } catch (err) {
      if (!(err instanceof ApiError && err.httpStatus === 409) || attempt >= EARLY_REPRICE_RETRIES) {
        throw err;
      }
      await sleep(1000);
    }
  }
}

const SETTLE_CHECKS = 5;

/**
 * Most commands are asynchronous: the answer carries the status at intake and the result lands a
 * moment later (BRCE-4023 §2). The card is re-read a few times, a second apart, until the screen
 * changes; polling and notifications pick up anything slower.
 */
async function settle(operationId: string, before: DealStatus): Promise<Deal | undefined> {
  let deal = await getDealById(operationId);
  for (let check = 0; check < SETTLE_CHECKS && deal?.status === before; check += 1) {
    await sleep(1000);
    deal = await getDealById(operationId);
  }
  return deal;
}

/**
 * Sends one client action and returns the re-read deal; never trusts the command's own status. A 409
 * means the deal moved underneath the user: toast and show its real state instead of an error. Any
 * other error is rethrown — the screen re-reads the card itself after showing it.
 */
export async function sendOtcCommand(deal: Deal, command: OtcCommand): Promise<Deal | undefined> {
  try {
    if (command === 'ACCEPT_REPRICE' || command === 'REJECT_REPRICE') {
      await postRepriceDecision(deal.id, command);
    } else {
      await postCommand(deal.id, command, crypto.randomUUID());
    }
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 409) {
      useToastStore.getState().show(ru.dealDetail.statusChangedToast);
      return getDealById(deal.id);
    }
    throw err;
  }
  const settled = await settle(deal.id, deal.status);
  if (settled?.status === deal.status) {
    console.warn('[otc] status unchanged after command', command, deal.id, deal.status);
  }
  return settled;
}

/** Answers with REQUOTE straight away (BRCE-4023 §3): the tap lands on "Оператор готовит курс". */
export async function requestNewRate(deal: Deal): Promise<Deal | undefined> {
  return sendOtcCommand(deal, 'REQUEST_NEW_RATE');
}

/** A signed link is taken only with this much life left; otherwise a fresh card is read first. */
const LINK_MARGIN_MS = 20_000;

export class DocumentUnavailableError extends Error {}

/**
 * BRCE-4023 §7: a document opens in the browser from its short-lived signed `href`, no token needed —
 * it isn't downloaded by the app. The link lives a couple of minutes, so it's taken from a fresh card
 * unless the one on screen still has time on it, which also keeps the tap's user gesture for
 * Telegram. Returns the fresh deal when one was read. A contour without a signing secret still sends a
 * relative path: that one is fetched with the session token, which only works where the app has
 * browser tabs.
 */
export async function openDealDocument(deal: Deal, kind: DealDocumentKind): Promise<Deal | undefined> {
  const current = deal.documents?.find((document) => document.kind === kind);
  if (current?.available && current.href && current.hrefExpiresAt && msUntil(current.hrefExpiresAt) > LINK_MARGIN_MS) {
    openExternalLink(current.href);
    return undefined;
  }
  const fresh = await getDealById(deal.id);
  const document = fresh?.documents?.find((item) => item.kind === kind);
  if (!document?.available || !document.href) {
    throw new DocumentUnavailableError(`Document ${kind} is not available now`);
  }
  if (document.hrefExpiresAt) {
    openExternalLink(document.href);
    return fresh;
  }
  const path = gatewayPath('financial', document.href);
  if (path === undefined) {
    openExternalLink(document.href);
    return fresh;
  }
  await openFetchedPdf(() => apiFetchBlob(path));
  return fresh;
}

/**
 * The OTC account certificate (`ACCOUNT_ACCEPTANCE_CERTIFICATE`, BRCE-4023 §7, Р6) by a signed link.
 * 409 means the contour has no signing secret yet: the file is then downloaded with the token.
 */
export async function openAccountCertificate(): Promise<void> {
  let link: { href: string; expiresAt: string };
  try {
    link = (await apiFetch<{ result: { href: string; expiresAt: string } }>(
      '/v1/otc/documents/account-acceptance-certificate/link', { method: 'POST' }, false, 'financial',
    )).result;
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 409) {
      await openFetchedPdf(() => apiFetchBlob('/v1/otc/documents/account-acceptance-certificate'));
      return;
    }
    throw err;
  }
  openExternalLink(link.href);
}
