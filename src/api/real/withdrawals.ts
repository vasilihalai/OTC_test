import type {
  CryptoWithdrawOptions,
  FiatWithdrawOptions,
  RequisitesPayload,
  SavedRequisite,
  WithdrawMethod,
  WithdrawNetworkOption,
  WithdrawOtpIssueResult,
  WithdrawQuote,
  WithdrawalResult,
} from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { ApiError } from '@/api/real/http/apiError.ts';
import { cacheByToken } from '@/api/real/http/cache.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';
import { paymentTypeMeta } from '@/lib/paymentType.ts';

/** `GET /requisite/list` — §5.4, grouped saved bank requisites for the withdrawal requisites selector. */
export async function getSavedRequisites(): Promise<SavedRequisite[]> {
  const res = await apiFetch<{ result: SavedRequisite[] }>('/requisite/list', {}, false, 'financial');
  return res.result;
}

// ---------------------------------------------------------------------------
// §5.1 directory — one endpoint, both asset kinds. Replaces the old assumed
// `/withdrawals/{crypto,fiat}/options` wholesale.
// ---------------------------------------------------------------------------

interface RawCurrencyItem {
  currency: string;
  // crypto
  currencyNetworkId?: string;
  networkCode?: string;
  networkLabel?: string;
  contractAddress?: string | null;
  addressRegex?: string | null;
  // fiat
  paymentType?: string;
  operationOption?: string;
  // shared
  minimalAmount: string;
  maximumAmount: string;
  commissionPercent: string;
  commissionFixed: string;
}

interface WithdrawConfiguration {
  fiatCurrencies: RawCurrencyItem[];
  cryptoCurrencies: RawCurrencyItem[];
}

/**
 * The financial service answers in a `{ result }` envelope; this read the body bare, so both lists
 * came back undefined and every withdrawal screen failed to load its networks/methods. Both shapes
 * are accepted. Cached briefly — it's the same directory for every asset the user switches to.
 */
const withdrawConfiguration = cacheByToken(async (): Promise<WithdrawConfiguration> => {
  const res = await apiFetch<({ result?: Partial<WithdrawConfiguration> } & Partial<WithdrawConfiguration>) | null>(
    '/v3/configuration/withdraws', {}, false, 'financial',
  );
  const config = res?.result ?? res;
  if (!Array.isArray(config?.cryptoCurrencies) && !Array.isArray(config?.fiatCurrencies)) {
    console.error('[withdraw] unexpected /v3/configuration/withdraws response shape', describeShape(res));
    throw new Error('Unexpected withdraw configuration shape');
  }
  return { cryptoCurrencies: config?.cryptoCurrencies ?? [], fiatCurrencies: config?.fiatCurrencies ?? [] };
}, 5 * 60_000);

function getWithdrawConfiguration(): Promise<WithdrawConfiguration> {
  return withdrawConfiguration.get();
}

export async function getWithdrawCryptoOptions(asset: string): Promise<CryptoWithdrawOptions> {
  const config = await getWithdrawConfiguration();
  const items = config.cryptoCurrencies.filter((item) => item.currency === asset);
  if (items.some((item) => !item.currencyNetworkId)) {
    console.warn('[withdraw] crypto network without currencyNetworkId — fields:', describeShape(items[0]));
  }
  const networks: WithdrawNetworkOption[] = items
    .map((item) => ({
      currencyNetworkId: item.currencyNetworkId ?? '',
      networkCode: item.networkCode ?? '',
      networkLabel: item.networkLabel ?? '',
      contractAddress: item.contractAddress ?? null,
      addressRegex: item.addressRegex ?? null,
      minimalAmount: item.minimalAmount,
      maximumAmount: item.maximumAmount,
      commissionPercent: item.commissionPercent,
      commissionFixed: item.commissionFixed,
    }));
  return { networks };
}

export async function getWithdrawFiatOptions(currency: string): Promise<FiatWithdrawOptions> {
  const config = await getWithdrawConfiguration();
  const methods: WithdrawMethod[] = config.fiatCurrencies
    .filter((item) => item.currency === currency)
    .map((item) => {
      const meta = paymentTypeMeta(item.paymentType ?? '');
      return {
        paymentType: item.paymentType ?? '',
        operationOption: item.operationOption ?? '',
        name: meta.name,
        transferType: meta.transferType,
        minimalAmount: item.minimalAmount,
        maximumAmount: item.maximumAmount,
        commissionPercent: item.commissionPercent,
        commissionFixed: item.commissionFixed,
      };
    });
  return { methods };
}

// ---------------------------------------------------------------------------
// §5.2 quote — one endpoint, different `requisites` shape per asset kind.
// Sent at quote time (not only confirm) so fee/limit math sees the real
// destination, per §5.3's explicit instruction — repeat at confirm only if
// the backend rejects without it.
// ---------------------------------------------------------------------------

async function postWithdrawInfo(body: Record<string, unknown>): Promise<WithdrawQuote> {
  const res = await apiFetch<{ result: WithdrawQuote }>('/v2/operations/withdraw/info', {
    method: 'POST',
    body: JSON.stringify(body),
  }, false, 'financial');
  return res.result;
}

export interface CryptoWithdrawQuoteParams {
  currency: string;
  currencyNetworkId: string;
  amount: string;
  address: string;
  isFullAmount?: boolean;
}

export async function getWithdrawCryptoQuote(params: CryptoWithdrawQuoteParams): Promise<WithdrawQuote> {
  return postWithdrawInfo({
    currency: params.currency,
    operationType: 'WITHDRAW',
    currencyNetworkId: params.currencyNetworkId,
    amount: Number(params.amount),
    isFullAmount: params.isFullAmount ?? false,
    isRequisiteSave: false,
    requisites: { address: params.address },
  });
}

export interface FiatWithdrawQuoteParams {
  currency: string;
  paymentType: string;
  operationOption: string;
  amount: string;
  requisites: RequisitesPayload;
}

/** `isRequisiteSave` mirrors `requisites.saveForLater` — §5.4: new requisites save inline here rather than a separate create-OTP round trip. */
export async function getWithdrawFiatQuote(params: FiatWithdrawQuoteParams): Promise<WithdrawQuote> {
  return postWithdrawInfo({
    currency: params.currency,
    paymentType: params.paymentType,
    operationOption: params.operationOption,
    operationType: 'WITHDRAW',
    amount: Number(params.amount),
    isFullAmount: false,
    isRequisiteSave: params.requisites.saveForLater,
    requisites: params.requisites,
  });
}

// ---------------------------------------------------------------------------
// §5.3 OTP — shared by both asset kinds; `requisites` is optional at confirm
// (only sent if the backend rejected without it at quote time).
// ---------------------------------------------------------------------------

/**
 * A withdrawal can be gated by checks the web cabinet walks the client through and the mini app has no
 * screens for: the anti-fraud questionnaire (`questionnaire`, BRCE-3433) and user tasks (`userTasks`,
 * BRCE-3810). With one required, no code is sent or the confirmed operation never executes — so it is
 * reported as such instead of a code prompt or an "accepted" notice.
 */
interface ExtraChecks {
  questionnaire?: { required?: boolean } | null;
  userTasks?: { required?: boolean } | null;
}

function assertNoExtraChecks(result: ExtraChecks | undefined): void {
  if (result?.questionnaire?.required || result?.userTasks?.required) {
    throw new ApiError(422, 'EXTRA_CHECK_REQUIRED', 'The withdrawal needs a check the mini app does not support', '');
  }
}

/** `clientType` unused (session-derived), kept to mirror the mock's signature. */
export async function issueWithdrawOtp(transactionId: string): Promise<WithdrawOtpIssueResult> {
  const res = await apiFetch<{ result: WithdrawOtpIssueResult & ExtraChecks }>(`/v2/operations/issue-otp/${transactionId}`, { method: 'POST' }, false, 'financial');
  assertNoExtraChecks(res.result);
  return res.result;
}

const CONFIRM_POLLS = 15;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `POST /v2/operations/confirm/{id}`, idempotent by `x-request-id` (BRCE-4023 §6). While the server is
 * still working it answers 202 with no `result`: the same request is repeated with the same id, and so
 * is one that never got an answer. Every new code is a new attempt with a new id — reusing one would
 * replay the stored rejection for two minutes. If the result never shows up, the outcome is unknown and
 * is reported as still processing: confirming again later is safe, it returns the first answer.
 */
export async function confirmWithdrawOtp(transactionId: string, otp: string, requisites?: object): Promise<WithdrawalResult> {
  const requestId = crypto.randomUUID();
  const init: RequestInit = {
    method: 'POST',
    body: JSON.stringify({ otp, requisites }),
    headers: { 'x-request-id': requestId },
  };
  for (let poll = 0; poll < CONFIRM_POLLS; poll += 1) {
    let res: { result?: WithdrawalResult & ExtraChecks } | undefined;
    try {
      res = await apiFetch<{ result?: WithdrawalResult & ExtraChecks } | undefined>(`/v2/operations/confirm/${transactionId}`, init, false, 'financial');
    } catch (err) {
      if (!(err instanceof TypeError) || poll > 0) {
        throw err;
      }
    }
    if (res?.result) {
      assertNoExtraChecks(res.result);
      return res.result;
    }
    await sleep(1000);
  }
  throw new ApiError(202, 'STILL_PROCESSING', 'Confirmation is still being processed', requestId);
}
