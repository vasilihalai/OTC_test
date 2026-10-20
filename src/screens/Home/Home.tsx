import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Panel } from '@/components/Panel/Panel.tsx';
import { StatCard } from '@/components/StatCard/StatCard.tsx';
import { CompanyChip } from '@/components/CompanyChip/CompanyChip.tsx';
import { DealRow } from '@/components/DealRow/DealRow.tsx';
import { SegmentedControl } from '@/components/SegmentedControl/SegmentedControl.tsx';
import { TableRow } from '@/components/TableRow/TableRow.tsx';
import { EmptyState } from '@/components/EmptyState/EmptyState.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { getAssets, getDeals, getStats, getUser } from '@/api/index.ts';
import type { Asset, Deal, Stats, User } from '@/api/index.ts';
import { useRequireOtcAccess, useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { formatAmount } from '@/lib/money.ts';
import { ru } from '@/i18n/ru.ts';

import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const session = useRequireSession();
  useRequireOtcAccess();
  const clientType = session?.clientType ?? 'FL';
  const selectedGroup = useUiStore((s) => s.selectedAssetGroup);
  const setSelectedGroup = useUiStore((s) => s.setSelectedAssetGroup);
  const balancesVersion = useUiStore((s) => s.balancesVersion);

  const [user, setUser] = useState<User>();
  const [stats, setStats] = useState<Stats>();
  const [deals, setDeals] = useState<Deal[]>();
  const [assets, setAssets] = useState<Asset[]>();
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const fail = useCallback((err: unknown) => {
    console.error('[Home] load failed', err);
    setLoadFailed(true);
  }, []);

  // Independent on purpose: one failing request must not leave every widget on its skeleton.
  const load = useCallback(() => {
    void getUser(clientType).then(setUser).catch(fail);
    void getStats().then(setStats).catch(fail);
    void getDeals().then(setDeals).catch(fail);
  }, [clientType, fail]);

  // Failure shown inside the deposit panel, not the hero banner — that one is for the widgets above.
  const loadAssets = useCallback(() => {
    setAssetsLoading(true);
    setAssetsFailed(false);
    void getAssets(selectedGroup).then((data) => {
      setAssets(data);
      setAssetsLoading(false);
    }).catch((err: unknown) => {
      console.error('[Home] balances load failed', err);
      setAssetsLoading(false);
      setAssetsFailed(true);
    });
  }, [selectedGroup]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets, balancesVersion]);

  function retry() {
    setLoadFailed(false);
    load();
  }

  const positiveAssets = (assets ?? []).filter((a) => Number(a.balance) > 0);
  const hiddenZeroBalance = (assets ?? []).length > positiveAssets.length;

  return (
    <div className="home">
      <Panel radius="0 0 16px 16px" padding="8px 16px 20px">
        <div className="home__hero">
          <div className="home__hero-text">
            <h1 className="home__hero-title">{ru.home.heroTitle}</h1>
            <p className="home__hero-subtitle">{ru.home.heroSubtitle}</p>
            <p className="home__desk-hours">{ru.home.deskHours}</p>
          </div>
          {loadFailed && (
            <div className="home__load-error">
              <p className="home__load-error-text">{ru.common.errorGeneric}</p>
              <Button variant="secondary" size="compact" onClick={retry}>{ru.common.retryAction}</Button>
            </div>
          )}
          {!user && !loadFailed && <Skeleton width={140} height={22} radius={8}/>}
          {user?.clientName && <CompanyChip>{user.clientName}</CompanyChip>}
          <div className="home__stats">
            {stats ? (
              <>
                <StatCard value={String(stats.activeDeals)} label={ru.home.statActiveDeals}/>
                <StatCard value={stats.volume30d} unit={stats.volumeAsset} label={ru.home.statVolume30d}/>
              </>
            ) : (
              <>
                <Skeleton height={84} radius={16}/>
                <Skeleton height={84} radius={16}/>
              </>
            )}
          </div>
        </div>
      </Panel>

      <Panel radius="16px" padding="20px 0 4px">
        <h2 className="home__panel-heading">{ru.home.recentDealsTitle}</h2>
        {!deals && (
          <div className="home__deals-skeleton">
            <Skeleton height={72} radius={12}/>
            <Skeleton height={72} radius={12}/>
          </div>
        )}
        {deals && deals.length === 0 && <EmptyState caption={ru.home.noDeals}/>}
        {deals?.slice(0, 2).map((deal) => (
          <DealRow key={deal.id} deal={deal} onClick={() => navigate(`/deals/${deal.id}`)}/>
        ))}
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
        <div className="home__assets">
          {assetsLoading && (
            <div className="home__deals-skeleton">
              <Skeleton height={60} radius={12}/>
              <Skeleton height={60} radius={12}/>
            </div>
          )}
          {assetsFailed && (
            <div className="home__load-error home__load-error--assets">
              <p className="home__load-error-text">{ru.home.balancesError}</p>
              <Button variant="secondary" size="compact" onClick={loadAssets}>{ru.common.retryAction}</Button>
            </div>
          )}
          {!assetsLoading && !assetsFailed && positiveAssets.length === 0 && (
            <p className="home__empty">{ru.home.noPositiveBalance}</p>
          )}
          {!assetsLoading && !assetsFailed && positiveAssets.map((asset) => (
            <TableRow
              key={asset.ticker}
              ticker={asset.ticker}
              name={asset.name}
              amount={formatAmount(asset.balance, asset.ticker)}
              actionLabel={`${ru.home.withdrawAction} ${asset.ticker}`}
              onAction={() => navigate(`/withdraw/${asset.group}?asset=${asset.ticker}`)}
            />
          ))}
        </div>
        {hiddenZeroBalance && !assetsFailed && <p className="home__hidden-caption">{ru.home.hiddenZeroBalance}</p>}
      </Panel>
    </div>
  );
}
