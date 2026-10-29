import type { Accounts, Asset, AssetGroup, TransferAccount } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
import { cacheByToken } from '@/api/real/http/cache.ts';
import { describeShape } from '@/api/real/http/responseShape.ts';

/**
 * `GET /balance/api/v2/users/balances` — backend-confirmed replacement for §4's v1 call (which
 * takes a user id and answers in a `balancesData` envelope). No id in the path: the gateway takes
 * the user from the token. Same endpoint the web cabinets use; answers in `result`.
 */
interface BalanceItem {
  coin: string;
  /** Total, frozen included — v1's `totalAmount`. */
  equity: number | string;
  /** Available — v1's `availableBalance`. */
  amount: number | string;
  frozen: number | string;
  type: string;
}

/**
 * Backend account keys, picked by name — order isn't stable (dev returned TRADE first). Also the
 * values the transfer call takes as `accountFrom`/`accountTo`.
 */
export const ACCOUNT_KEY: Record<TransferAccount, string> = { deposit: 'UNIFIED', trading: 'TRADE' };

const USD_PEGGED = new Set(['USD', 'USDT', 'USDC']);

const numeric = (value: unknown): number | undefined =>
  value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;

/**
 * USD equivalent of a row. The backend confirmed `*Usd` totals per account but hasn't named a
 * per-row field, so the row's `…usd…` value field is used (an equity/total one first), or a USD
 * price × equity. USD-pegged coins fall back to their own equity. Undefined otherwise.
 */
function usdValueOf(item: BalanceItem): number | undefined {
  const row = item as unknown as Record<string, unknown>;
  const usdKeys = Object.keys(row).filter((key) => /usd/i.test(key));
  const valueKeys = usdKeys.filter((key) => !/rate|price/i.test(key));
  const valueKey = valueKeys.find((key) => /equity|total/i.test(key)) ?? valueKeys[0];
  if (valueKey) {
    return numeric(row[valueKey]);
  }
  const priceKey = usdKeys.find((key) => /rate|price/i.test(key));
  const price = priceKey ? numeric(row[priceKey]) : undefined;
  if (price !== undefined) {
    return price * Number(item.equity);
  }
  return USD_PEGGED.has(item.coin) ? numeric(item.equity) : undefined;
}

let warnedNoUsd = false;

const accountLists = cacheByToken(async (): Promise<Record<TransferAccount, BalanceItem[]>> => {
  const res = await apiFetch<{ result?: { balances?: Record<string, { list?: BalanceItem[] } | null>; coins?: unknown } }>(
    '/v2/users/balances', {}, false, 'balance',
  );
  const balances = res.result?.balances;
  if (!balances || typeof balances !== 'object') {
    console.error('[balances] unexpected response shape', { body: describeShape(res), result: describeShape(res.result) });
    throw new Error('Unexpected balances response shape');
  }
  // Both keys always come back; an empty account has `list: []`.
  const lists = {
    deposit: balances[ACCOUNT_KEY.deposit]?.list ?? [],
    trading: balances[ACCOUNT_KEY.trading]?.list ?? [],
  };
  const unpriced = lists.deposit.find((item) => usdValueOf(item) === undefined);
  if (unpriced && !warnedNoUsd) {
    warnedNoUsd = true;
    console.warn('[balances] no USD equivalent on a balance row — sorting/"under $1" filter degrade. Fields:', {
      row: describeShape(unpriced),
      coins: describeShape(res.result?.coins),
    });
  }
  return lists;
}, 15_000);

/** After a transfer/withdrawal — the next read must not serve pre-operation balances. */
export function invalidateBalances(): void {
  accountLists.invalidate();
}

// The balance row has no human-readable name, so this fills what `TableRow`'s `name` prop needs.
// Static display metadata, not mock data; extend as new tickers show up.
const ASSET_NAMES: Record<string, string> = {
  USDT: 'Tether', USDC: 'USD Coin', BTC: 'Bitcoin', ETH: 'Ethereum', TRX: 'TRON', TON: 'Toncoin',
  KGS: 'Кыргызский сом', RUB: 'Российский рубль', USD: 'Доллар США',
};

export async function getAssets(group: AssetGroup): Promise<Asset[]> {
  const { deposit } = await accountLists.get();
  const wantedType = group.toUpperCase();
  return deposit
    .filter((item) => String(item.type).toUpperCase() === wantedType)
    // Zero-balance coins still come back once they've had movement — hidden, per §4.
    .filter((item) => Number(item.equity) !== 0)
    .map((item) => ({
      ticker: item.coin,
      name: ASSET_NAMES[item.coin] ?? item.coin,
      // §4: the figure shown is the available one, never the total — the total includes
      // whatever an OTC deal has frozen.
      balance: String(item.amount),
      group,
      usdValue: usdValueOf(item),
    }));
}

export async function getAccounts(): Promise<Accounts> {
  const lists = await accountLists.get();
  const toRecord = (list: BalanceItem[]): Record<string, string> =>
    Object.fromEntries(list.map((item) => [item.coin, String(item.amount)]));
  return { deposit: toRecord(lists.deposit), trading: toRecord(lists.trading) };
}
