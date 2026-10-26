import type { Accounts, Asset, AssetGroup, TransferAccount } from '@/api/types.ts';
import { apiFetch } from '@/api/http.ts';
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

async function fetchAccountLists(): Promise<Record<TransferAccount, BalanceItem[]>> {
  const res = await apiFetch<{ result?: { balances?: Record<string, { list?: BalanceItem[] } | null> } }>(
    '/v2/users/balances', {}, false, 'balance',
  );
  const balances = res.result?.balances;
  if (!balances || typeof balances !== 'object') {
    console.error('[balances] unexpected response shape', { body: describeShape(res), result: describeShape(res.result) });
    throw new Error('Unexpected balances response shape');
  }
  // Both keys always come back; an empty account has `list: []`.
  return {
    deposit: balances[ACCOUNT_KEY.deposit]?.list ?? [],
    trading: balances[ACCOUNT_KEY.trading]?.list ?? [],
  };
}

// The balance row has no human-readable name, so this fills what `TableRow`'s `name` prop needs.
// Static display metadata, not mock data; extend as new tickers show up.
const ASSET_NAMES: Record<string, string> = {
  USDT: 'Tether', USDC: 'USD Coin', BTC: 'Bitcoin',
  KGS: 'Кыргызский сом', RUB: 'Российский рубль', USD: 'Доллар США',
};

export async function getAssets(group: AssetGroup): Promise<Asset[]> {
  const { deposit } = await fetchAccountLists();
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
    }));
}

export async function getAccounts(): Promise<Accounts> {
  const lists = await fetchAccountLists();
  const toRecord = (list: BalanceItem[]): Record<string, string> =>
    Object.fromEntries(list.map((item) => [item.coin, String(item.amount)]));
  return { deposit: toRecord(lists.deposit), trading: toRecord(lists.trading) };
}
