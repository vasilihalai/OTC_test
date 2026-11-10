import { memo } from 'react';

import type { Deal } from '@/api/index.ts';
import { StatusChip } from '@/components/StatusChip/StatusChip.tsx';
import { KeyValueRow } from '@/components/KeyValueRow/KeyValueRow.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { bem } from '@/css/bem.ts';
import { DEAL_STATUS_META } from '@/lib/dealStatus.ts';
import { ru } from '@/i18n/ru.ts';

import './DealRow.css';

const [b, e] = bem('deal-row');

const DIRECTION_LABEL: Record<Deal['direction'], string> = {
  BUY: ru.deals.directionBuy,
  SELL: ru.deals.directionSell,
  EXCHANGE: ru.deals.directionExchange,
};

export interface DealRowProps {
  deal: Deal;
  /** Takes the deal's id, so one stable handler serves the whole list and unchanged rows skip re-rendering. */
  onOpen: (id: string) => void;
}

export const DealRow = memo(function DealRow({ deal, onOpen }: DealRowProps) {
  const meta = DEAL_STATUS_META[deal.status];
  return (
    <div className={b()} onClick={() => onOpen(deal.id)} role="button" tabIndex={0}>
      <div className={e('top')}>
        <span className={e('id')}>
          {deal.requestNumber ?? deal.id}
          {' '}
          {deal.statusPending
            // The list alone doesn't say which of two screens the deal is on; the card does, in a moment.
            ? <Skeleton width={104} height={18} radius={9}/>
            : <StatusChip tone={deal.status} size="sm">{meta.listLabel}</StatusChip>}
        </span>
        <span className={e('date')}>{deal.date}</span>
      </div>
      <KeyValueRow label={ru.deals.direction} value={DIRECTION_LABEL[deal.direction]}/>
      <KeyValueRow label={ru.deals.give} value={deal.from}/>
      <KeyValueRow label={ru.deals.receive} value={deal.to ?? ru.deals.receiveTbd}/>
    </div>
  );
});

/** Label and value widths of the three rows, so the placeholder has the row's ragged right edge. */
const ROW_WIDTHS = [[86, 62], [58, 104], [66, 118]] as const;

/** The row's own box and spacing with bars where its text goes: the list doesn't move when it loads. */
export function DealRowSkeleton() {
  return (
    <div className={b('skeleton')} aria-hidden="true">
      <div className={e('top')}>
        <span className={e('id')}>
          <Skeleton width={76} height={14} line={24} radius={6}/>
          <Skeleton width={104} height={18} radius={9}/>
        </span>
        <Skeleton width={70} height={12} line={20} radius={6}/>
      </div>
      {ROW_WIDTHS.map(([label, value]) => (
        <div key={label} className="key-value-row">
          <Skeleton width={label} height={12} line={20} radius={6}/>
          <Skeleton width={value} height={12} line={20} radius={6}/>
        </div>
      ))}
    </div>
  );
}

/** A list's worth of placeholder rows. */
export function DealRowsSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => <DealRowSkeleton key={index}/>)}
    </>
  );
}
