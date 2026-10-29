import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Select } from '@/components/Select/Select.tsx';
import { AmountField } from '@/components/AmountField/AmountField.tsx';
import { SummaryCard } from '@/components/SummaryCard/SummaryCard.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { Panel } from '@/components/Panel/Panel.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import { getAssets, getWithdrawFiatOptions } from '@/api/index.ts';
import type { Asset, FiatWithdrawOptions } from '@/api/index.ts';
import type { WithdrawFiatRouteState } from '@/screens/WithdrawRequisites/WithdrawRequisites.tsx';
import { useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { formatAmount } from '@/lib/money.ts';
import { notifyError } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './WithdrawFiat.css';

function MethodIcon() {
  return (
    <div className="withdraw-fiat__method-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5 14 5H2l6-3.5Z" fill="currentColor"/>
        <rect x="2" y="6.5" width="2" height="6" fill="currentColor"/>
        <rect x="7" y="6.5" width="2" height="6" fill="currentColor"/>
        <rect x="12" y="6.5" width="2" height="6" fill="currentColor"/>
        <rect x="1.5" y="13" width="13" height="1.5" rx="0.5" fill="currentColor"/>
      </svg>
    </div>
  );
}

export function WithdrawFiat() {
  useRequireSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('asset');
  const balancesVersion = useUiStore((s) => s.balancesVersion);
  const openTransferModal = useTransferModalStore((s) => s.open);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [currency, setCurrency] = useState(preselected ?? '');
  const [options, setOptions] = useState<FiatWithdrawOptions>();
  const [paymentType, setPaymentType] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const [assetsAttempt, setAssetsAttempt] = useState(0);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [optionsAttempt, setOptionsAttempt] = useState(0);

  useEffect(() => {
    setAssetsFailed(false);
    void getAssets('fiat').then((data) => {
      setAssets(data);
      setCurrency((current) => (current && data.some((a) => a.ticker === current) ? current : (data[0]?.ticker ?? '')));
    }).catch((err: unknown) => {
      console.error('[WithdrawFiat] assets load failed', err);
      setAssetsFailed(true);
    }).finally(() => setInitialLoading(false));
  }, [balancesVersion, assetsAttempt]);

  useEffect(() => {
    if (!currency) {
      return;
    }
    setOptionsLoading(true);
    setOptionsFailed(false);
    void getWithdrawFiatOptions(currency).then((data) => {
      setOptions(data);
      setPaymentType((current) => (data.methods.some((m) => m.paymentType === current) ? current : (data.methods[0]?.paymentType ?? '')));
    }).catch((err: unknown) => {
      console.error('[WithdrawFiat] withdraw options load failed', err);
      setOptions(undefined);
      setOptionsFailed(true);
    }).finally(() => setOptionsLoading(false));
  }, [currency, optionsAttempt]);

  const asset = assets.find((a) => a.ticker === currency);
  const available = asset?.balance ?? '0';
  const method = options?.methods.find((m) => m.paymentType === paymentType);
  const feePercent = method ? Number(method.commissionPercent) : 0;
  const feeFixed = method ? Number(method.commissionFixed) : 0;

  const maxAmount = useMemo(() => {
    if (!available) {
      return '0';
    }
    const max = (Number(available) - feeFixed) / (1 + feePercent / 100);
    return max > 0 ? max.toFixed(2) : '0';
  }, [available, feePercent, feeFixed]);

  const fee = amount ? feeFixed + (Number(amount) * feePercent) / 100 : 0;
  const totalDebit = amount ? Number(amount) + fee : 0;

  function handleMax() {
    setAmount(maxAmount);
    setAmountError(undefined);
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    if (!value) {
      setAmountError(undefined);
      return;
    }
    const enteredTotal = Number(value) + feeFixed + (Number(value) * feePercent) / 100;
    setAmountError(enteredTotal > Number(available) ? ru.withdraw.errorInsufficientFunds : undefined);
  }

  function handleContinue() {
    setAmountError(undefined);
    if (method && Number(amount) < Number(method.minimalAmount)) {
      setAmountError(ru.withdraw.errorBelowMin);
      notifyError();
      return;
    }
    if (totalDebit > Number(available)) {
      setAmountError(ru.withdraw.errorAboveAvailable);
      notifyError();
      return;
    }

    const state: WithdrawFiatRouteState = { ticker: currency, paymentType, operationOption: method?.operationOption ?? '', amount };
    navigate('/withdraw/fiat/requisites', { state });
  }

  if (initialLoading) {
    return (
      <div className="withdraw-fiat">
        <Skeleton height={48} radius={12}/>
        <Skeleton height={48} radius={12}/>
        <Panel fill="surface" radius="12px">
          <Skeleton height={100} radius={8}/>
        </Panel>
      </div>
    );
  }

  if (assetsFailed) {
    return (
      <div className="withdraw-fiat">
        <LoadError
          message={ru.withdraw.assetsError}
          onRetry={() => {
            setInitialLoading(true);
            setAssetsAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="withdraw-fiat">
      <div className="withdraw-fiat__scroll">
        <h2 className="withdraw-fiat__section-title">{ru.withdraw.chooseCurrencyMethodTitle}</h2>
        <Select
          label={ru.withdraw.currencyLabel}
          layout="asset"
          options={assets.map((a) => ({
            value: a.ticker,
            label: a.ticker,
            secondary: a.name,
            icon: <CurrencyIcon ticker={a.ticker} size={24}/>,
          }))}
          value={currency}
          onChange={setCurrency}
        />
        {optionsLoading && <Skeleton height={56} radius={12}/>}
        {optionsFailed && <LoadError message={ru.withdraw.methodsError} onRetry={() => setOptionsAttempt((n) => n + 1)}/>}
        {!optionsLoading && options?.methods.length === 0 && (
          <p className="withdraw-fiat__note">{ru.withdraw.noMethods}</p>
        )}
        {!optionsLoading && options && options.methods.length > 0 && (
          <Select
            label={ru.withdraw.methodLabel}
            layout="method"
            options={options.methods.map((m) => ({ value: m.paymentType, label: m.name, secondary: `${m.commissionPercent}%`, icon: <MethodIcon/> }))}
            value={paymentType}
            onChange={setPaymentType}
          />
        )}

        <h2 className="withdraw-fiat__section-title">{ru.withdraw.amountSectionTitle}</h2>
        <AmountField
          label={ru.withdraw.sendLabel}
          availableLabel={ru.withdraw.balanceLabel}
          available={`${formatAmount(available, currency)} ${currency}`}
          value={amount}
          onChange={handleAmountChange}
          onMax={handleMax}
          maxLabel={ru.withdraw.maxAction}
          error={amountError}
          onTransfer={openTransferModal}
        />

        {method && (
          <SummaryCard
            rows={[
              { key: 'min', label: ru.withdraw.minAmountLabel, value: `${formatAmount(method.minimalAmount, currency)} ${currency}` },
              { key: 'limit', label: ru.withdraw.limitLabel, value: `${formatAmount(method.maximumAmount, currency)} ${currency}` },
              { key: 'amount', label: ru.withdraw.enteredAmountLabel, value: `${formatAmount(amount || '0', currency)} ${currency}` },
              { key: 'fee', label: ru.withdraw.feeLabel, value: `${formatAmount(String(fee), currency)} ${currency}` },
            ]}
            totalLabel={ru.withdraw.totalDebitLabel}
            totalValue={`${formatAmount(String(totalDebit), currency)} ${currency}`}
          />
        )}
      </div>

      <div className="withdraw-fiat__submit">
        <Button variant="accent" disabled={!method || !(Number(amount) > 0)} onClick={handleContinue}>{ru.withdraw.confirmAction}</Button>
      </div>
    </div>
  );
}
