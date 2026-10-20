import type { Accounts, Asset, AssetGroup, TransferAccount } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { ensureFreshAccessToken } from '@/api/real/http/tokenStore.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';

/** api-integration.md §4 — `GET /users/balances/{user-id}` (`balance` service). */
interface BalanceItem {
  coin: string;
  totalAmount: number;
  availableBalance: number;
  frozen: number;
  type: 'CRYPTO' | 'FIAT';
}

/** Account key → its items, in response order (first = deposit, see `accountKeys`). */
type AccountBalances = Record<string, BalanceItem[]>;

/**
 * The platform user id is the access token's `sub`. Not the profile's `userPublicId` — on dev
 * that's a different UUID (display id), and the balances path rejected it.
 */
async function currentUserId(): Promise<string> {
  const token = await ensureFreshAccessToken();
  const payload = token?.split('.')[1];
  const sub = payload
    ? (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown }).sub
    : undefined;
  if (typeof sub !== 'string' || !sub) {
    throw new Error('No user id (sub) in the access token');
  }
  return sub;
}

const isItemList = (value: unknown): value is BalanceItem[] =>
  Array.isArray(value) && value.every((item) => typeof (item as Partial<BalanceItem> | null)?.coin === 'string');

/**
 * §4 documents `balances: { [account]: { list: BalanceItem[] } }`, but dev answers 200 with a body
 * that doesn't parse as that. Accepted: that shape, `{ [account]: BalanceItem[] }`, a flat
 * `BalanceItem[]` (as `balances` or as the whole result), and an explicit `null` for an account
 * with nothing on it yet. Anything else logs its field names and throws.
 */
function toAccountBalances(data: unknown): AccountBalances | undefined {
  if (data === null) {
    return {};
  }
  let raw: unknown = data;
  if (!Array.isArray(data)) {
    raw = typeof data === 'object' ? (data as { balances?: unknown }).balances : undefined;
  }
  if (raw === null) {
    return {};
  }
  if (isItemList(raw)) {
    return { default: raw };
  }
  if (raw === undefined || typeof raw !== 'object') {
    return undefined;
  }
  const accounts: AccountBalances = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const list = isItemList(value) ? value : (value as { list?: unknown } | null)?.list ?? null;
    if (list === null) {
      accounts[key] = [];
    } else if (isItemList(list)) {
      accounts[key] = list;
    } else {
      return undefined;
    }
  }
  return accounts;
}

async function fetchBalancesData(): Promise<AccountBalances> {
  const userId = await currentUserId();
  const res = await apiFetch<{ result?: unknown } | null>(`/users/balances/${userId}`, {}, false, 'balance');
  const data = res !== null && typeof res === 'object' && 'result' in res ? res.result : res;
  const accounts = toAccountBalances(data);
  if (!accounts) {
    const balances = (data as { balances?: unknown } | null)?.balances;
    const firstAccount: unknown = balances && typeof balances === 'object' ? Object.values(balances)[0] : undefined;
    console.error('[balances] unexpected response shape', {
      body: describeShape(res),
      data: describeShape(data),
      balances: describeShape(balances),
      firstAccount: describeShape(firstAccount),
    });
    throw new Error('Unexpected balances response shape');
  }
  return accounts;
}

/**
 * `balances` is keyed by account — the deposit/trading split — and which
 * key is which isn't documented (question B7). Per the doc's own interim
 * guidance: "render whatever keys come back, defaulting to the first as the
 * deposit account." Both `getAssets` and `getAccounts` below pick account(s)
 * this same way, not by a hardcoded `'deposit'`/`'trading'` string key.
 */
function accountKeys(data: AccountBalances): string[] {
  return Object.keys(data);
}

// The balance item schema (§4) is coin/totalAmount/availableBalance/frozen/
// type only — no human-readable name — so this fills what `TableRow`'s
// `name` prop needs. Static display metadata, not mock data (same role as
// an icon set); extend as new tickers show up.
const ASSET_NAMES: Record<string, string> = {
  USDT: 'Tether', USDC: 'USD Coin', BTC: 'Bitcoin',
  KGS: 'Кыргызский сом', RUB: 'Российский рубль', USD: 'Доллар США',
};

export async function getAssets(group: AssetGroup): Promise<Asset[]> {
  const data = await fetchBalancesData();
  const key = accountKeys(data)[0];
  const list = key ? data[key] : [];
  const wantedType = group.toUpperCase();
  return list
    .filter((item) => String(item.type).toUpperCase() === wantedType)
    .filter((item) => item.totalAmount !== 0) // §4: "Hide rows where totalAmount === 0."
    .map((item) => ({
      ticker: item.coin,
      name: ASSET_NAMES[item.coin] ?? item.coin,
      // §4: "The available figure shown in a TableRow is availableBalance,
      // never totalAmount" — total includes whatever an OTC deal has frozen.
      balance: String(item.availableBalance),
      group,
    }));
}

export async function getAccounts(): Promise<Accounts> {
  const data = await fetchBalancesData();
  const [depositKey, tradingKey] = accountKeys(data);
  const toRecord = (key: string | undefined): Record<string, string> => {
    if (!key) {
      return {};
    }
    return Object.fromEntries(data[key].map((item) => [item.coin, String(item.availableBalance)]));
  };
  return { deposit: toRecord(depositKey), trading: toRecord(tradingKey) };
}

/**
 * §6: `accountFrom`/`accountTo` on the transfer call are the *real* backend
 * account keys, not the app's own `deposit`/`trading` labels `getAccounts()`
 * remaps them to for display — this resolves one back to the other, using
 * the same positional first/second-key convention as everything else in
 * this file (question B7).
 */
export async function resolveTransferAccounts(): Promise<Record<TransferAccount, string>> {
  const data = await fetchBalancesData();
  const [depositKey, tradingKey] = accountKeys(data);
  return { deposit: depositKey ?? '', trading: tradingKey ?? '' };
}
