import type { Accounts, Asset, AssetGroup, TransferAccount } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { getCurrentUserId } from '@/api/real/profile.ts';

/** api-integration.md §4 — `GET /users/balances/{user-id}` (`balance` service). */
interface BalanceItem {
  coin: string;
  totalAmount: number;
  availableBalance: number;
  frozen: number;
  type: 'CRYPTO' | 'FIAT';
}

interface BalancesData {
  totalBalance: number;
  totalBalanceFiat: number;
  totalBalanceCrypto: number;
  balances: Record<string, { list: BalanceItem[] }>;
}

async function fetchBalancesData(): Promise<BalancesData> {
  // §4: "profile first, balances second — sequence them, do not fire in
  // parallel on boot." `getCurrentUserId` is its own profile round trip
  // (rather than threading a userId through every caller) — an accepted
  // extra request, same trade-off as `getUser`'s access-derived `verified`.
  const userId = await getCurrentUserId();
  // Envelope unconfirmed for this service — the profile one turned out to be unwrapped.
  const res = await apiFetch<{ result?: BalancesData } & Partial<BalancesData>>(`/users/balances/${userId}`, {}, false, 'balance');
  return (res.result ?? res) as BalancesData;
}

/**
 * `balances` is keyed by account — the deposit/trading split — and which
 * key is which isn't documented (question B7). Per the doc's own interim
 * guidance: "render whatever keys come back, defaulting to the first as the
 * deposit account." Both `getAssets` and `getAccounts` below pick account(s)
 * this same way, not by a hardcoded `'deposit'`/`'trading'` string key.
 */
function accountKeys(data: BalancesData): string[] {
  return Object.keys(data.balances);
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
  const list = key ? data.balances[key].list : [];
  const wantedType = group.toUpperCase();
  return list
    .filter((item) => item.type === wantedType)
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
    return Object.fromEntries(data.balances[key].list.map((item) => [item.coin, String(item.availableBalance)]));
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
