import { useParams } from 'react-router-dom';

import type { Deal, DealStatus } from '@/api/index.ts';
import { BalanceBlockSkeleton } from '@/components/BalanceBlock/BalanceBlock.tsx';
import { KeyValueRow } from '@/components/KeyValueRow/KeyValueRow.tsx';
import { Skeleton, SkeletonGroup } from '@/components/Skeleton/Skeleton.tsx';
import { StatusChip } from '@/components/StatusChip/StatusChip.tsx';
import { DEAL_STATUS_META, getDetailRows } from '@/lib/dealStatus.ts';
import { getQueryData } from '@/lib/query.ts';
import { queryKeys } from '@/lib/queries.ts';
import { ru } from '@/i18n/ru.ts';

import './DealDetail.css';

export const DIRECTION_LABEL: Record<Deal['direction'], string> = {
  BUY: ru.deals.directionBuy,
  SELL: ru.deals.directionSell,
  EXCHANGE: ru.deals.directionExchange,
};

/**
 * The number, the status and the direction. `deal` is the card when it is loaded, or what the list
 * already said about the deal while it isn't — so the top of the screen is there from the first frame.
 */
export function DealHeader({ deal }: { deal: Deal | undefined }) {
  return (
    <>
      <div className="deal-detail__header">
        {deal
          ? <h1 className="deal-detail__id">{deal.requestNumber ?? deal.id}</h1>
          : <Skeleton width={104} height={18} line={28} radius={6}/>}
        {deal && !deal.statusPending
          // Keyed by the status: a new one arrives with the chip's own entrance instead of a text swap.
          ? <StatusChip key={deal.status} tone={deal.status} size="lg">{DEAL_STATUS_META[deal.status].detailLabel}</StatusChip>
          : <Skeleton width={124} height={24} radius={12}/>}
      </div>
      {deal
        ? <p className="deal-detail__direction">{DIRECTION_LABEL[deal.direction]}</p>
        : <Skeleton width={72} height={14} line={24} radius={6}/>}
    </>
  );
}

/** The three shapes the top card takes: a status with its icon, a quote to answer, the balance to top up. */
type BodyShape = 'hero' | 'quote' | 'balance';

function shapeOf(status: DealStatus | undefined): BodyShape {
  switch (status) {
    case 'RATE_ACTIVE':
    case 'TERMS_PROPOSED':
    case 'REPRICE_PROPOSED':
      return 'quote';
    case 'AWAITING_FUNDS':
      return 'balance';
    default:
      return 'hero';
  }
}

function HeroPlaceholder({ withAction }: { withAction: boolean }) {
  return (
    <div className="status-hero deal-detail__placeholder-card">
      <Skeleton width={48} height={48} radius="50%"/>
      <Skeleton width={176} height={14} line={24} radius={6} style={{ marginTop: 17 }}/>
      <Skeleton width={228} height={12} line={20} radius={6} style={{ marginTop: 8 }}/>
      <Skeleton width={164} height={12} line={20} radius={6}/>
      {withAction && <Skeleton height={44} radius={30} style={{ marginTop: 16 }}/>}
    </div>
  );
}

function QuotePlaceholder() {
  return (
    <div className="quote-card deal-detail__placeholder-card">
      <Skeleton width={252} height={12} line={20} radius={6}/>
      <Skeleton width={148} height={12} line={20} radius={6} style={{ marginTop: 0, marginBottom: 16 }}/>
      <Skeleton width={84} height={12} line={20} radius={6}/>
      <Skeleton width={204} height={24} line={36} radius={8}/>
      <Skeleton width={168} height={12} line={20} radius={6} style={{ marginTop: 12, marginBottom: 20 }}/>
      <div className="quote-card__rows">
        <KeyValueRow label={ru.dealDetail.giveLabel} loading/>
        <KeyValueRow label={ru.dealDetail.receiveLabel} loading/>
      </div>
      <Skeleton height={44} radius={30}/>
      <Skeleton width={84} height={14} line={22} radius={6} style={{ marginTop: 16 }}/>
    </div>
  );
}

function BalancePlaceholder({ dealAmount }: { dealAmount: string }) {
  return (
    <>
      <BalanceBlockSkeleton dealAmount={dealAmount}/>
      <Skeleton height={64} radius={12}/>
      <Skeleton height={44} radius={30}/>
      <Skeleton width={84} height={14} line={22} radius={6} style={{ alignSelf: 'center' }}/>
    </>
  );
}

const WITH_ACTION: DealStatus[] = ['RATE_PENDING', 'RATE_STALE', 'SHORTFALL_REVIEW', 'DONE'];

/**
 * Everything under the header while the card loads, in the shape the card will have: the list's
 * status (when the deal was opened from the list) picks the top card and the rows of "Детали", so
 * the loaded screen lands where its placeholder was.
 */
export function DealPlaceholder({ preview }: { preview: Deal | undefined }) {
  const status = preview && !preview.statusPending ? preview.status : undefined;
  const shape = shapeOf(status);
  const rows = status ? getDetailRows(status) : { give: true, receive: false, rate: true, hold: false };

  return (
    <SkeletonGroup className="deal-detail__placeholder">
      {shape === 'hero' && <HeroPlaceholder withAction={!status || WITH_ACTION.includes(status)}/>}
      {shape === 'quote' && <QuotePlaceholder/>}
      {shape === 'balance' && <BalancePlaceholder dealAmount={preview?.from ?? ''}/>}

      <div className="deal-detail__section">
        <h2 className="deal-detail__section-title">{ru.dealDetail.detailsTitle}</h2>
        {/* The date and the direction don't change: the list's are the card's. */}
        <KeyValueRow label={ru.dealDetail.createdDateLabel} value={preview?.date} loading={!preview}/>
        <KeyValueRow label={ru.dealDetail.directionLabel} value={preview && DIRECTION_LABEL[preview.direction]} loading={!preview}/>
        {rows.give && <KeyValueRow label={status === 'SHORTFALL_REVIEW' ? ru.dealDetail.dealAmountLabel : ru.dealDetail.giveLabel} loading/>}
        {rows.hold && <KeyValueRow label={ru.dealDetail.holdLabel} loading/>}
        {rows.receive && <KeyValueRow label={ru.dealDetail.receiveLabel} loading/>}
        {rows.rate && <KeyValueRow label={ru.dealDetail.rateLabel} loading/>}
      </div>

      <div className="deal-detail__section">
        <h2 className="deal-detail__section-title">{ru.dealDetail.documentsTitle}</h2>
        {[168, 204, 252].map((width) => (
          <div key={width} className="deal-detail__placeholder-document">
            <Skeleton width={16} height={16} radius={4}/>
            <Skeleton width={width} height={12} radius={6}/>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/**
 * The whole screen as a placeholder — what the route shows while the screen's own code is still on
 * its way (first visit on a slow connection). Same pieces the screen uses while its card loads.
 */
export function DealDetailSkeleton() {
  const { id } = useParams();
  const preview = getQueryData<Deal[]>(queryKeys.deals)?.find((deal) => deal.id === id);
  return (
    <div className="deal-detail">
      <DealHeader deal={preview}/>
      <DealPlaceholder preview={preview}/>
    </div>
  );
}
