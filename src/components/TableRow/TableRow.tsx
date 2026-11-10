import { memo } from 'react';

import { bem } from '@/css/bem.ts';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';

import './TableRow.css';

const [b, e] = bem('table-row');

function ActionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 15.5L15 5M15 5H6.5M15 5V13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export interface TableRowProps {
  ticker: string;
  name: string;
  amount: string;
  /** Takes the ticker, so one stable handler serves every row. */
  onAction: (ticker: string) => void;
  actionLabel: string;
}

export const TableRow = memo(function TableRow({ ticker, name, amount, onAction, actionLabel }: TableRowProps) {
  return (
    <div className={b()}>
      <div className={e('info-cell')}>
        <CurrencyIcon ticker={ticker}/>
        <div className={e('info')}>
          <div className={e('ticker')}>{ticker}</div>
          <div className={e('name')}>{name}</div>
        </div>
      </div>
      <div className={e('amount-cell')}>{amount}</div>
      <div className={e('action-cell')}>
        <button type="button" className={e('action')} aria-label={actionLabel} onClick={() => onAction(ticker)}>
          <span className={e('action-circle')}><ActionIcon/></span>
        </button>
      </div>
    </div>
  );
});

/** The row's own cells with a disc and bars in them. */
export function TableRowSkeleton({ nameWidth = 84, amountWidth = 96 }: { nameWidth?: number; amountWidth?: number }) {
  return (
    <div className={b()} aria-hidden="true">
      <div className={e('info-cell')}>
        <Skeleton width={40} height={40} radius="50%"/>
        <div className={e('info', 'loading')}>
          <Skeleton width={42} height={12} line={20} radius={6}/>
          <Skeleton width={nameWidth} height={12} line={20} radius={6} style={{ marginTop: 6 }}/>
        </div>
      </div>
      <div className={e('amount-cell')}>
        <Skeleton width={amountWidth} height={12} line={20} radius={6}/>
      </div>
      <div className={e('action-cell')}>
        <Skeleton width={36} height={36} radius="50%"/>
      </div>
    </div>
  );
}
