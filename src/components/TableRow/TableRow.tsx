import { bem } from '@/css/bem.ts';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';

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
  onAction: () => void;
  actionLabel: string;
}

export function TableRow({ ticker, name, amount, onAction, actionLabel }: TableRowProps) {
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
        <button type="button" className={e('action')} aria-label={actionLabel} onClick={onAction}>
          <span className={e('action-circle')}><ActionIcon/></span>
        </button>
      </div>
    </div>
  );
}
