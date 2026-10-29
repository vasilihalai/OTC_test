import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Modal } from '@/components/Modal/Modal.tsx';
import { Select } from '@/components/Select/Select.tsx';
import { AmountField } from '@/components/AmountField/AmountField.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { ApiError, getAccounts, getAssets, mapApiError, transfer } from '@/api/index.ts';
import type { Accounts, Asset, TransferAccount } from '@/api/index.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { useUiStore } from '@/store/ui.ts';
import { useToastStore } from '@/store/toast.ts';
import { notifyError, notifySuccess } from '@/telegram/adapter.ts';
import { formatAmount } from '@/lib/money.ts';
import { ru } from '@/i18n/ru.ts';

import './TransferModal.css';

function SwapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4v13M8 4L4.5 7.5M8 4l3.5 3.5M16 20V7M16 20l-3.5-3.5M16 20l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const ACCOUNT_OPTIONS = [
  { value: 'trading' as TransferAccount, label: ru.transferModal.accountTrading },
  { value: 'deposit' as TransferAccount, label: ru.transferModal.accountDeposit },
];

export function TransferModal() {
  const isOpen = useTransferModalStore((s) => s.isOpen);
  const close = useTransferModalStore((s) => s.close);
  const bumpBalancesVersion = useUiStore((s) => s.bumpBalancesVersion);
  const showToast = useToastStore((s) => s.show);

  const [from, setFrom] = useState<TransferAccount>('trading');
  const [to, setTo] = useState<TransferAccount>('deposit');
  const [ticker, setTicker] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState<Accounts>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const accountsRef = useRef<HTMLDivElement>(null);
  const fromFieldRef = useRef<HTMLDivElement>(null);
  const toFieldRef = useRef<HTMLDivElement>(null);
  const [swapTop, setSwapTop] = useState<number>();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setAmount('');
    setAccounts(undefined);
    void Promise.all([getAccounts(), getAssets('fiat'), getAssets('crypto')]).then(([accountsData, fiat, crypto]) => {
      setAccounts(accountsData);
      setAssets([...fiat, ...crypto]);
    }).catch((err: unknown) => {
      console.error('[TransferModal] balances load failed', err);
      showToast(ru.home.balancesError);
    });
  }, [isOpen, showToast]);

  // Centers the swap ring on the seam between the two *select boxes*
  // themselves, not the midpoint of the whole label+box+label+box stack —
  // that midpoint sits much closer to "С" than to "На", since only "На"
  // has a label in the way. Measured live off the actual boxes so it stays
  // correct regardless of label size, font, or locale.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    function measure() {
      const container = accountsRef.current;
      const fromBox = fromFieldRef.current?.querySelector('.select__box');
      const toBox = toFieldRef.current?.querySelector('.select__box');
      if (!container || !fromBox || !toBox) {
        return;
      }
      const containerTop = container.getBoundingClientRect().top;
      const fromBottom = fromBox.getBoundingClientRect().bottom;
      const toTop = toBox.getBoundingClientRect().top;
      setSwapTop((fromBottom + toTop) / 2 - containerTop);
    }
    measure();
    // The modal card is still mid scale-in transform (`modal-card-in`,
    // 0.2s) on the frame this effect first fires, so that initial
    // measurement can be a few px off — re-measure once it settles.
    const settleTimer = setTimeout(measure, 220);
    const ro = new ResizeObserver(measure);
    if (accountsRef.current) {
      ro.observe(accountsRef.current);
    }
    return () => {
      clearTimeout(settleTimer);
      ro.disconnect();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const available = accounts ? (accounts[from][ticker] ?? '0') : '0';
  // Not "0" while loading — that reads as an empty account.
  const availableLabel = accounts ? `${formatAmount(available, ticker)} ${ticker}` : ru.common.loading;
  const amountNum = Number(amount || '0');
  const canConfirm = amountNum > 0 && amountNum <= Number(available);
  const amountError = amount && amountNum > Number(available) ? ru.withdraw.errorInsufficientFunds : undefined;

  function handleSwap() {
    const prevFrom = from;
    setFrom(to);
    setTo(prevFrom);
  }

  function selectFrom(value: TransferAccount) {
    if (value === to) {
      setTo(from);
    }
    setFrom(value);
  }

  function selectTo(value: TransferAccount) {
    if (value === from) {
      setFrom(to);
    }
    setTo(value);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await transfer({ from, to, ticker, amount });
      notifySuccess();
      bumpBalancesVersion();
      showToast(ru.transferModal.successToast);
      close();
    } catch (err) {
      notifyError();
      showToast(err instanceof ApiError ? mapApiError(err) : ru.common.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      title={ru.transferModal.title}
      onClose={close}
      width={343}
      footer={(
        <div className="button-row transfer-modal__footer">
          <Button type="button" variant="secondary" onClick={close}>{ru.transferModal.cancelAction}</Button>
          <Button loading={submitting} disabled={!canConfirm} onClick={() => void handleConfirm()}>
            {ru.transferModal.confirmAction}
          </Button>
        </div>
      )}
    >
      <div className="transfer-modal">
        <div className="transfer-modal__accounts" ref={accountsRef}>
          <div ref={fromFieldRef}>
            <Select label={ru.transferModal.fromLabel} layout="plain" options={ACCOUNT_OPTIONS} value={from} onChange={selectFrom}/>
          </div>
          <div ref={toFieldRef}>
            <Select label={ru.transferModal.toLabel} layout="plain" options={ACCOUNT_OPTIONS} value={to} onChange={selectTo}/>
          </div>
          <div className="transfer-modal__swap-ring" style={swapTop !== undefined ? { top: swapTop } : undefined}>
            <button type="button" className="transfer-modal__swap" aria-label="Swap" onClick={handleSwap}>
              <SwapIcon/>
            </button>
          </div>
        </div>

        <AmountField
          label={ru.transferModal.amountLabel}
          availableLabel={ru.transferModal.availableLabel}
          available={availableLabel}
          value={amount}
          onChange={setAmount}
          onMax={() => setAmount(available)}
          maxLabel={ru.transferModal.maxAction}
          error={amountError}
          assetSelect={(
            <Select
              label=""
              layout="asset"
              options={assets.map((asset) => ({
                value: asset.ticker,
                label: asset.ticker,
                icon: <CurrencyIcon ticker={asset.ticker} size={24}/>,
              }))}
              value={ticker}
              onChange={setTicker}
            />
          )}
        />
      </div>
    </Modal>
  );
}
