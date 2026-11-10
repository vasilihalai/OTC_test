import { useCallback } from 'react';

import {
  getAccounts,
  getAssets,
  getDealById,
  getDealRequisites,
  getDeals,
  getSavedRequisites,
  getStats,
  getUser,
  getWithdrawCryptoOptions,
  getWithdrawFiatOptions,
  invalidateBalances,
} from '@/api/index.ts';
import type {
  Accounts,
  Asset,
  AssetGroup,
  ClientType,
  CryptoWithdrawOptions,
  Deal,
  FiatWithdrawOptions,
  Requisites,
  SavedRequisite,
  Stats,
  User,
} from '@/api/index.ts';
import {
  type QueryResult,
  fetchQuery,
  getQueryData,
  invalidateQuery,
  patchQueryData,
  prefetchQuery,
  setQueryData,
  useQuery,
} from '@/lib/query.ts';

/** What each screen reads, by name. Screens use the hooks below; the names are for whoever changes the data. */
export const queryKeys = {
  user: (clientType: ClientType) => `user:${clientType}`,
  stats: 'stats',
  deals: 'deals',
  deal: (id: string) => `deal:${id}`,
  requisites: (dealId: string) => `requisites:${dealId}`,
  assets: 'assets',
  accounts: 'accounts',
  withdrawCrypto: (ticker: string) => `withdraw-crypto:${ticker}`,
  withdrawFiat: (currency: string) => `withdraw-fiat:${currency}`,
  savedRequisites: 'saved-requisites',
};

const MINUTE = 60_000;

/**
 * Money and whatever a client acts on is shown from memory only while it is fresh: past a minute the
 * screen opens on a skeleton and waits for the server. The list, the profile and the dashboard may be
 * older — they are refreshed underneath all the same.
 */
const MONEY_MAX_AGE = MINUTE;
/** Flipping between tabs must not read the same list twice in a row. */
const LIST_STALE_TIME = 5_000;
/** The withdrawal directory changes about never. */
const DIRECTORY_STALE_TIME = 5 * MINUTE;

export function useUser(clientType: ClientType | undefined): QueryResult<User> {
  return useQuery(clientType ? queryKeys.user(clientType) : undefined, () => getUser(clientType!), { maxAge: 10 * MINUTE });
}

export function useStats(): QueryResult<Stats> {
  return useQuery(queryKeys.stats, getStats, { staleTime: LIST_STALE_TIME });
}

/** As many cards as one list is worth reading for their exact status. */
const MAX_REFINED = 6;

/**
 * Real mode: a list item can't tell a first quote from the operator's new terms, nor the wait for the
 * operator from a new rate (`statusPending`). Those few deals take their status from their cards — and
 * the cards stay in the cache, so opening one of them is instant.
 */
async function refine(list: Deal[]): Promise<Deal[]> {
  const exact = new Map<string, Deal['status']>();
  await Promise.all(list.filter((deal) => deal.statusPending).slice(0, MAX_REFINED).map(async (deal) => {
    try {
      const card = await getDealById(deal.id);
      if (card) {
        setQueryData(queryKeys.deal(deal.id), card);
        exact.set(deal.id, card.status);
      }
    } catch (err) {
      console.warn('[deals] could not read the exact status of', deal.requestNumber ?? deal.id, err);
    }
  }));
  // A card that didn't load leaves the list's own reading.
  return list.map((deal) => (deal.statusPending ? { ...deal, status: exact.get(deal.id) ?? deal.status, statusPending: undefined } : deal));
}

/**
 * The first time, the list is shown as soon as it arrives and the few unsettled statuses follow (their
 * chips wait as placeholders). A refresh of a list already on screen swaps in only once it is exact,
 * so no chip flickers back and forth.
 */
async function loadDeals(): Promise<Deal[]> {
  const list = await getDeals();
  if (!list.some((deal) => deal.statusPending)) {
    return list;
  }
  const refined = refine(list);
  if (getQueryData(queryKeys.deals) !== undefined) {
    return refined;
  }
  void refined.then((exact) => {
    const byId = new Map(exact.map((deal) => [deal.id, deal]));
    patchQueryData<Deal[]>(queryKeys.deals, (current) => current.map((deal) => (deal.statusPending ? byId.get(deal.id) ?? deal : deal)));
  });
  return list;
}

export function useDeals(): QueryResult<Deal[]> {
  return useQuery(queryKeys.deals, loadDeals, { staleTime: LIST_STALE_TIME });
}

/** The list row of a deal follows what its card says, without waiting for the list's own refresh. */
function patchDealInList(deal: Deal): void {
  patchQueryData<Deal[]>(queryKeys.deals, (list) => list.map((item) => (
    item.id === deal.id
      ? { ...item, status: deal.status, statusPending: undefined, from: deal.from, to: deal.to, rate: deal.rate, quoteExpiresAt: deal.quoteExpiresAt }
      : item
  )));
}

/** `null` is "no such deal"; the cache keeps `undefined` for "not read yet". */
async function loadDeal(id: string): Promise<Deal | null> {
  const deal = await getDealById(id);
  if (deal) {
    patchDealInList(deal);
  }
  return deal ?? null;
}

export interface DealQuery {
  deal: Deal | undefined;
  /** What the list already knows about this deal — enough for the header while the card loads. */
  preview: Deal | undefined;
  notFound: boolean;
  failed: boolean;
  /** Re-reads the card. A read that fails is simply retried by the next one. */
  refresh: () => Promise<void>;
  /** Shows a card that is known to be newer than any read in flight — an action's result. */
  show: (deal: Deal) => void;
}

export function useDeal(id: string | undefined): DealQuery {
  const { data, failed, refetch } = useQuery(id ? queryKeys.deal(id) : undefined, () => loadDeal(id!), { maxAge: MONEY_MAX_AGE });
  const show = useCallback((deal: Deal) => {
    setQueryData(queryKeys.deal(deal.id), deal);
    patchDealInList(deal);
  }, []);
  return {
    deal: data ?? undefined,
    preview: data ? undefined : getQueryData<Deal[]>(queryKeys.deals)?.find((item) => item.id === id),
    notFound: data === null,
    failed,
    refresh: refetch,
    show,
  };
}

/**
 * A command went through: the list and the dashboard counters are out of date, and so are the balances
 * (a hold freezes money, a cancel releases it). They are re-read when their screen opens.
 */
export function dealChanged(): void {
  invalidateQuery(queryKeys.deals);
  invalidateQuery(queryKeys.stats);
  balancesChanged();
}

/** A transfer, a withdrawal, a hold: every balance on screen re-reads, the rest when they open. */
export function balancesChanged(): void {
  invalidateBalances();
  invalidateQuery(queryKeys.assets);
  invalidateQuery(queryKeys.accounts);
}

export type AssetsByGroup = Record<AssetGroup, Asset[]>;

/** Both groups at once (one balances request in real mode), so switching crypto/fiat never waits. */
async function loadAssets(): Promise<AssetsByGroup> {
  const [crypto, fiat] = await Promise.all([getAssets('crypto'), getAssets('fiat')]);
  return { crypto, fiat };
}

/** The deposit account's assets. `wanted` is false where they aren't on screen yet (a closed modal). */
export function useAssets(wanted = true): QueryResult<AssetsByGroup> {
  return useQuery(wanted ? queryKeys.assets : undefined, loadAssets, { maxAge: MONEY_MAX_AGE });
}

/** Both accounts' balances by ticker. `wanted` is false where the screen may not need them at all. */
export function useAccounts(wanted = true): QueryResult<Accounts> {
  return useQuery(wanted ? queryKeys.accounts : undefined, getAccounts, { maxAge: MONEY_MAX_AGE });
}

/**
 * Deposit requisites of a deal. `wanted` is false until their panel shows: the method is read once
 * per visit and isn't meant for polling (BRCE-4023 §1). A minute-old copy may open the panel at once;
 * the fresh read still follows, since paying to outdated requisites costs more than a skeleton.
 */
export function useDealRequisites(dealId: string, wanted: boolean): QueryResult<Requisites> {
  return useQuery(wanted ? queryKeys.requisites(dealId) : undefined, async () => {
    const requisites = await getDealRequisites(dealId);
    if (!requisites) {
      throw new Error('No requisites for this deal');
    }
    return requisites;
  }, { maxAge: MONEY_MAX_AGE });
}

export function useWithdrawCryptoOptions(ticker: string): QueryResult<CryptoWithdrawOptions> {
  return useQuery(ticker ? queryKeys.withdrawCrypto(ticker) : undefined, () => getWithdrawCryptoOptions(ticker), { staleTime: DIRECTORY_STALE_TIME });
}

export function useWithdrawFiatOptions(currency: string): QueryResult<FiatWithdrawOptions> {
  return useQuery(currency ? queryKeys.withdrawFiat(currency) : undefined, () => getWithdrawFiatOptions(currency), { staleTime: DIRECTORY_STALE_TIME });
}

export function useSavedRequisites(): QueryResult<SavedRequisite[]> {
  return useQuery(queryKeys.savedRequisites, getSavedRequisites);
}

/**
 * Home's reads, started before the screen exists: at boot they run while the app is still being put
 * on screen, so the first paint often has data instead of skeletons. The user is included when the
 * account type is already known (a returning client).
 */
export function prefetchHome(clientType?: ClientType): void {
  if (clientType) {
    prefetchQuery(queryKeys.user(clientType), () => getUser(clientType));
  }
  prefetchQuery(queryKeys.stats, getStats);
  prefetchQuery(queryKeys.deals, loadDeals);
  prefetchQuery(queryKeys.assets, loadAssets);
}

/**
 * The profile read at boot — the very read the screens ask for, so the two never go out twice. In real
 * mode the account type comes from the token, whatever `clientType` was assumed; the answer is kept
 * under its real one too.
 */
export async function fetchUser(clientType: ClientType): Promise<User> {
  const user = await fetchQuery(queryKeys.user(clientType), () => getUser(clientType));
  if (user.clientType !== clientType) {
    setQueryData(queryKeys.user(user.clientType), user);
  }
  return user;
}
