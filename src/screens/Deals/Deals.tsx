import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { DealRow, DealRowsSkeleton } from '@/components/DealRow/DealRow.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { FilterChips } from '@/components/FilterChips/FilterChips.tsx';
import { SkeletonGroup } from '@/components/Skeleton/Skeleton.tsx';
import { EmptyState } from '@/components/EmptyState/EmptyState.tsx';
import { USE_REAL_API } from '@/api/index.ts';
import { useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { matchesFilter } from '@/lib/dealStatus.ts';
import { useDeals } from '@/lib/queries.ts';
import { usePolling } from '@/lib/usePolling.ts';
import { ru } from '@/i18n/ru.ts';

import './Deals.css';

const FILTERS = [
  { value: 'ALL' as const, label: ru.deals.filterAll },
  { value: 'ACTIVE' as const, label: ru.deals.filterActive },
  { value: 'DONE' as const, label: ru.deals.filterDone },
  { value: 'DECLINED' as const, label: ru.deals.filterDeclined },
];

export function Deals() {
  const navigate = useNavigate();
  useRequireSession();
  // The list last seen is shown at once and refreshed underneath; the filter is remembered for the
  // session, so coming back from a deal lands on the same list at the same place.
  const { data: deals, failed, refetch } = useDeals();
  const filter = useUiStore((s) => s.dealsFilter);
  const setFilter = useUiStore((s) => s.setDealsFilter);

  // §7.7 — real mode only, the list has no server push to lean on instead.
  usePolling(() => void refetch(), 30_000, USE_REAL_API);

  const openDeal = useCallback((id: string) => navigate(`/deals/${id}`), [navigate]);
  const filteredDeals = useMemo(() => (deals ?? []).filter((deal) => matchesFilter(deal.status, filter)), [deals, filter]);

  return (
    <div className="deals">
      <FilterChips options={FILTERS} value={filter} onChange={setFilter}/>

      {failed && (
        <div className="deals__error rise">
          <p>{ru.common.errorGeneric}</p>
          <Button variant="secondary" onClick={() => void refetch()}>{ru.common.retryAction}</Button>
        </div>
      )}

      {!failed && !deals && <SkeletonGroup className="deals__list"><DealRowsSkeleton count={5}/></SkeletonGroup>}

      {deals?.length === 0 && <EmptyState caption={ru.home.noDeals}/>}
      {deals && deals.length > 0 && filteredDeals.length === 0 && (
        <div className="deals__empty-filtered rise">
          <EmptyState caption={ru.deals.emptyForFilter}/>
          <Button type="button" variant="link" onClick={() => setFilter('ALL')}>{ru.deals.showAllAction}</Button>
        </div>
      )}
      {filteredDeals.length > 0 && (
        // Keyed by the filter: choosing another one brings its rows in as a list.
        <div key={filter} className="deals__list stagger">
          {filteredDeals.map((deal) => <DealRow key={deal.id} deal={deal} onOpen={openDeal}/>)}
        </div>
      )}
    </div>
  );
}
