import { useRef } from 'react';

import { KeyValueRow } from '@/components/KeyValueRow/KeyValueRow.tsx';
import { bem } from '@/css/bem.ts';
import { ru } from '@/i18n/ru.ts';

import './BalanceBlock.css';

const [b, e] = bem('balance-block');

const LONG_PRESS_MS = 600;

function TransferIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <path
        d="M3.4 11.575L5.275 13.45C5.45833 13.6333 5.55 13.8625 5.55 14.1375C5.55 14.4125 5.45833 14.65 5.275 14.85C5.075 15.05 4.8375 15.15 4.5625 15.15C4.2875 15.15 4.05 15.05 3.85 14.85L0.275 11.275C0.175 11.175 0.104167 11.0667 0.0625 10.95C0.0208333 10.8333 0 10.7083 0 10.575C0 10.4417 0.0208333 10.3167 0.0625 10.2C0.104167 10.0833 0.175 9.975 0.275 9.875L3.875 6.275C4.075 6.075 4.30833 5.97917 4.575 5.9875C4.84167 5.99583 5.075 6.1 5.275 6.3C5.45833 6.5 5.55417 6.73333 5.5625 7C5.57083 7.26667 5.475 7.5 5.275 7.7L3.4 9.575H9.575C9.85833 9.575 10.0958 9.67083 10.2875 9.8625C10.4792 10.0542 10.575 10.2917 10.575 10.575C10.575 10.8583 10.4792 11.0958 10.2875 11.2875C10.0958 11.4792 9.85833 11.575 9.575 11.575H3.4ZM15.75 5.575H9.575C9.29167 5.575 9.05417 5.47917 8.8625 5.2875C8.67083 5.09583 8.575 4.85833 8.575 4.575C8.575 4.29167 8.67083 4.05417 8.8625 3.8625C9.05417 3.67083 9.29167 3.575 9.575 3.575H15.75L13.875 1.7C13.6917 1.51667 13.6 1.2875 13.6 1.0125C13.6 0.7375 13.6917 0.5 13.875 0.3C14.075 0.1 14.3125 0 14.5875 0C14.8625 0 15.1 0.1 15.3 0.3L18.875 3.875C18.975 3.975 19.0458 4.08333 19.0875 4.2C19.1292 4.31667 19.15 4.44167 19.15 4.575C19.15 4.70833 19.1292 4.83333 19.0875 4.95C19.0458 5.06667 18.975 5.175 18.875 5.275L15.275 8.875C15.075 9.075 14.8417 9.17083 14.575 9.1625C14.3083 9.15417 14.075 9.05 13.875 8.85C13.6917 8.65 13.5958 8.41667 13.5875 8.15C13.5792 7.88333 13.675 7.65 13.875 7.45L15.75 5.575Z"
        fill="currentColor"
      />
    </svg>
  );
}

export interface BalanceBlockProps {
  balance: string;
  ticker: string;
  dealAmount: string;
  shortfall?: string;
  onTransfer: () => void;
  onLongPressBalance?: () => void;
}

export function BalanceBlock({ balance, ticker, dealAmount, shortfall, onTransfer, onLongPressBalance }: BalanceBlockProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function startPress() {
    if (!onLongPressBalance) {
      return;
    }
    timer.current = setTimeout(onLongPressBalance, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(timer.current);
  }

  return (
    <div className={b()}>
      <div className={e('header')}>
        <span className={e('label')}>{ru.dealDetail.balanceLabel}</span>
        <button type="button" className={e('transfer')} aria-label={ru.dealDetail.transferAction} onClick={onTransfer}>
          <TransferIcon/>
        </button>
      </div>
      <div
        className={e('amount')}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
      >
        {balance}
        <span className={e('ticker')}>{ticker}</span>
      </div>
      <KeyValueRow label={ru.dealDetail.dealAmountLabel} value={<b className="balance-block__deal-amount">{dealAmount}</b>}/>
      {shortfall && <KeyValueRow label={ru.dealDetail.shortfallLabel} value={shortfall}/>}
    </div>
  );
}
