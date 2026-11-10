import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Panel } from '@/components/Panel/Panel.tsx';
import { StatCard, StatCardSkeleton } from '@/components/StatCard/StatCard.tsx';
import { CompanyChip } from '@/components/CompanyChip/CompanyChip.tsx';
import { DealRow, DealRowsSkeleton } from '@/components/DealRow/DealRow.tsx';
import { SegmentedControl } from '@/components/SegmentedControl/SegmentedControl.tsx';
import { TableRow, TableRowSkeleton } from '@/components/TableRow/TableRow.tsx';
import { EmptyState } from '@/components/EmptyState/EmptyState.tsx';
import { Skeleton, SkeletonGroup } from '@/components/Skeleton/Skeleton.tsx';
import { Checkbox } from '@/components/Checkbox/Checkbox.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import { USE_REAL_API, invalidateBalances } from '@/api/index.ts';
import type { Asset } from '@/api/index.ts';
import { useRequireOtcAccess, useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { formatAmount } from '@/lib/money.ts';
import { useAssets, useDeals, useStats, useUser } from '@/lib/queries.ts';
import { usePolling } from '@/lib/usePolling.ts';
import { ru } from '@/i18n/ru.ts';

import './Home.css';

const SMALL_BALANCE_USD = 1;
/** How many of the latest deals Home shows; the rest are on the Deals tab. */
const RECENT_DEALS = 2;

// Largest USD equivalent first; a row without one (backend didn't price it) goes last.
const byUsdValueDesc = (a: Asset, b: Asset) => (b.usdValue ?? -1) - (a.usdValue ?? -1);

export function Home() {
  const navigate = useNavigate();
  const session = useRequireSession();
  useRequireOtcAccess();
  const selectedGroup = useUiStore((s) => s.selectedAssetGroup);
  const setSelectedGroup = useUiStore((s) => s.setSelectedAssetGroup);
  const hideSmall = useUiStore((s) => s.hideSmallBalances);
  const setHideSmall = useUiStore((s) => s.setHideSmallBalances);

  // Independent on purpose: one failing request must not leave every widget on its skeleton. What was
  // on screen last time is shown at once and refreshed underneath.
  const user = useUser(session?.clientType);
  const stats = useStats();
  const deals = useDeals();
  const balances = useAssets();

  // Balances follow REST: every 20 seconds while Home is open, and at once on coming back to the app.
  usePolling(() => {
    invalidateBalances();
    void balances.refetch();
  }, 20_000, USE_REAL_API);

  const openDeal = useCallback((id: string) => navigate(`/deals/${id}`), [navigate]);
  const withdraw = useCallback(
    (ticker: string) => navigate(`/withdraw/${selectedGroup}?asset=${ticker}`),
    [navigate, selectedGroup],
  );

  const loadFailed = user.failed || stats.failed || deals.failed;

  function retry() {
    for (const query of [user, stats, deals]) {
      if (query.failed) {
        void query.refetch();
      }
    }
  }

  const assets = balances.data?.[selectedGroup] ?? [];
  const positiveAssets = assets.filter((a) => Number(a.balance) > 0).sort(byUsdValueDesc);
  // An unpriced row is never hidden as dust — it may well not be.
  const visibleAssets = hideSmall
    ? positiveAssets.filter((a) => a.usdValue === undefined || a.usdValue >= SMALL_BALANCE_USD)
    : positiveAssets;
  const hiddenZeroBalance = assets.length > positiveAssets.length;
  const showList = !!balances.data;

  return (
    <div className="home">
      <Panel radius="0 0 16px 16px" padding="8px 16px 20px">
        <div className="home__hero">
          <div className="home__hero-text">
            <h1 className="home__hero-title">{ru.home.heroTitle}</h1>
            <p className="home__hero-subtitle">{ru.home.heroSubtitle}</p>
            <p className="home__desk-hours">{ru.home.deskHours}</p>
          </div>
          {loadFailed && <LoadError message={ru.common.errorGeneric} onRetry={retry}/>}
          {!user.data && !loadFailed && <Skeleton width={148} height={24} radius={20} className="home__chip-skeleton"/>}
          {user.data?.clientName && <CompanyChip>{user.data.clientName}</CompanyChip>}
          <div className="home__stats">
            {stats.data ? (
              <>
                <StatCard value={String(stats.data.activeDeals)} label={ru.home.statActiveDeals}/>
                <StatCard value={stats.data.volume30d} unit={stats.data.volumeAsset} label={ru.home.statVolume30d}/>
              </>
            ) : (
              <>
                <StatCardSkeleton label={ru.home.statActiveDeals}/>
                <StatCardSkeleton label={ru.home.statVolume30d}/>
              </>
            )}
          </div>
        </div>
      </Panel>

      <Panel radius="16px" padding="20px 0 4px">
        <h2 className="home__panel-heading">{ru.home.recentDealsTitle}</h2>
        {!deals.data && <SkeletonGroup><DealRowsSkeleton count={RECENT_DEALS}/></SkeletonGroup>}
        {deals.data?.length === 0 && <EmptyState caption={ru.home.noDeals}/>}
        {deals.data && deals.data.length > 0 && (
          <div className="stagger">
            {deals.data.slice(0, RECENT_DEALS).map((deal) => <DealRow key={deal.id} deal={deal} onOpen={openDeal}/>)}
          </div>
        )}
      </Panel>

      <Panel radius="16px 16px 0 0" padding="20px 0">
        <h2 className="home__panel-heading">{ru.home.depositAccountTitle}</h2>
        <div className="home__segment">
          <SegmentedControl
            options={[
              { value: 'crypto', label: ru.home.segmentCrypto },
              { value: 'fiat', label: ru.home.segmentFiat },
            ]}
            value={selectedGroup}
            onChange={setSelectedGroup}
          />
        </div>
        <div className="home__balance-filter">
          <Checkbox checked={hideSmall} onChange={setHideSmall} label={ru.home.hideSmallBalances}/>
        </div>
        {/* Keyed by the tab: the other group's rows arrive as a list, not one by one as their tickers differ. */}
        <div key={selectedGroup} className="home__assets stagger">
          {balances.loading && (
            <SkeletonGroup>
              <TableRowSkeleton nameWidth={62} amountWidth={104}/>
              <TableRowSkeleton nameWidth={84} amountWidth={88}/>
              <TableRowSkeleton nameWidth={70} amountWidth={96}/>
            </SkeletonGroup>
          )}
          {balances.failed && (
            <div className="home__assets-error">
              <LoadError message={ru.home.balancesError} onRetry={() => void balances.refetch()}/>
            </div>
          )}
          {showList && positiveAssets.length === 0 && (
            <p className="home__empty">{ru.home.noPositiveBalance}</p>
          )}
          {showList && positiveAssets.length > 0 && visibleAssets.length === 0 && (
            <p className="home__empty">{ru.home.allSmallHidden}</p>
          )}
          {showList && visibleAssets.map((asset) => (
            <TableRow
              key={asset.ticker}
              ticker={asset.ticker}
              name={asset.name}
              amount={`${formatAmount(asset.balance, asset.ticker)} ${asset.ticker}`}
              actionLabel={`${ru.home.withdrawAction} ${asset.ticker}`}
              onAction={withdraw}
            />
          ))}
        </div>
        {hiddenZeroBalance && showList && <p className="home__hidden-caption">{ru.home.hiddenZeroBalance}</p>}
      </Panel>
    </div>
  );
}
