import { useEffect, useRef, useState } from 'react';

import { KeyValueRow } from '@/components/KeyValueRow/KeyValueRow.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { TransferIcon } from '@/components/TransferIcon/TransferIcon.tsx';
import { bem } from '@/css/bem.ts';
import { ru } from '@/i18n/ru.ts';

import './BalanceBlock.css';

const [b, e] = bem('balance-block');

const LONG_PRESS_MS = 600;

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
  // Counts the changes of the figure after the block appeared: each one lights the balance up for a
  // moment, so a client waiting for a transfer to land sees it happen.
  const [updates, setUpdates] = useState(0);
  const shownBalance = useRef(balance);
  useEffect(() => {
    if (shownBalance.current !== balance) {
      shownBalance.current = balance;
      setUpdates((count) => count + 1);
    }
  }, [balance]);

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
        <span key={updates} className={e('figure', { updated: updates > 0 })}>{balance}</span>
        <span className={e('ticker')}>{ticker}</span>
      </div>
      <KeyValueRow label={ru.dealDetail.dealAmountLabel} value={<b className="balance-block__deal-amount">{dealAmount}</b>}/>
      {shortfall && <KeyValueRow label={ru.dealDetail.shortfallLabel} value={shortfall}/>}
    </div>
  );
}

/** The block's own rows with bars for the figures: the balance is the one thing here that has to be read from the server. */
export function BalanceBlockSkeleton({ dealAmount }: { dealAmount: string }) {
  return (
    <div className={b()}>
      <div className={e('header')}>
        <span className={e('label')}>{ru.dealDetail.balanceLabel}</span>
        <span className={e('transfer')} aria-hidden="true"/>
      </div>
      <div className={e('amount')} aria-hidden="true">
        <Skeleton width={188} height={24} line={36} radius={8}/>
      </div>
      <KeyValueRow label={ru.dealDetail.dealAmountLabel} value={<b className="balance-block__deal-amount">{dealAmount}</b>}/>
    </div>
  );
}
