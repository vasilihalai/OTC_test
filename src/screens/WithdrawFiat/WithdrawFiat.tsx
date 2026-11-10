import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Select } from '@/components/Select/Select.tsx';
import { AmountField } from '@/components/AmountField/AmountField.tsx';
import { SummaryCard, SummaryCardSkeleton } from '@/components/SummaryCard/SummaryCard.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { FieldSkeleton } from '@/components/Skeleton/FieldSkeleton.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import type { Asset } from '@/api/index.ts';
import { FIAT_SUMMARY_LABELS, WithdrawFiatSkeleton } from '@/screens/WithdrawFiat/WithdrawFiatSkeleton.tsx';
import type { WithdrawFiatRouteState } from '@/screens/WithdrawRequisites/WithdrawRequisites.tsx';
import { useRequireSession } from '@/store/session.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { formatAmount } from '@/lib/money.ts';
import { useAssets, useWithdrawFiatOptions } from '@/lib/queries.ts';
import { notifyError } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './WithdrawFiat.css';

const NO_ASSETS: Asset[] = [];

/** Bakai Bank has its mark in the frames; every other bank gets the generic building. */
function MethodIcon({ paymentType }: { paymentType: string }) {
  return (
    <div className="withdraw-fiat__method-icon" aria-hidden="true">
      {paymentType.startsWith('BAKAI') ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="#1F6FC4" strokeWidth="2.2"/>
          <rect x="5.6" y="5.6" width="4.8" height="4.8" rx="1" fill="#14365F"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5 14 5H2l6-3.5Z" fill="currentColor"/>
          <rect x="3" y="6.5" width="1.8" height="5.5" fill="currentColor"/>
          <rect x="7.1" y="6.5" width="1.8" height="5.5" fill="currentColor"/>
          <rect x="11.2" y="6.5" width="1.8" height="5.5" fill="currentColor"/>
          <rect x="1.5" y="13" width="13" height="1.5" rx="0.5" fill="currentColor"/>
        </svg>
      )}
    </div>
  );
}

export function WithdrawFiat() {
  useRequireSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('asset');
  const openTransferModal = useTransferModalStore((s) => s.open);

  // Coming from Home, the currencies are already in memory and the form opens complete; a transfer
  // re-reads them on its own (`balancesChanged`).
  const balances = useAssets();
  const assets = balances.data?.fiat ?? NO_ASSETS;
  const [chosenCurrency, setCurrency] = useState(preselected ?? '');
  // The currency asked for is kept while the list loads (its methods load alongside) and whenever the
  // account has it; otherwise the first one.
  const currency = !balances.data || assets.some((a) => a.ticker === chosenCurrency) ? chosenCurrency : (assets[0]?.ticker ?? '');
  const methods = useWithdrawFiatOptions(currency);
  const options = methods.data;
  const [chosenPaymentType, setPaymentType] = useState('');
  // The first method until the client picks another one of this currency's.
  const paymentType = options?.methods.some((m) => m.paymentType === chosenPaymentType)
    ? chosenPaymentType
    : (options?.methods[0]?.paymentType ?? '');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string>();

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

  if (balances.failed) {
    return (
      <div className="withdraw-fiat">
        <div className="withdraw-fiat__scroll">
          <LoadError message={ru.withdraw.assetsError} onRetry={() => void balances.refetch()}/>
        </div>
      </div>
    );
  }

  if (!balances.data) {
    return <WithdrawFiatSkeleton/>;
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
        {methods.loading && <FieldSkeleton label={ru.withdraw.methodLabel}/>}
        {methods.failed && <LoadError message={ru.withdraw.methodsError} onRetry={() => void methods.refetch()}/>}
        {options?.methods.length === 0 && (
          <p className="withdraw-fiat__note rise">{ru.withdraw.noMethods}</p>
        )}
        {options && options.methods.length > 0 && (
          <Select
            label={ru.withdraw.methodLabel}
            layout="method"
            options={options.methods.map((m) => ({ value: m.paymentType, label: m.name, secondary: `${m.commissionPercent}%`, icon: <MethodIcon paymentType={m.paymentType}/> }))}
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

        {methods.loading && <SummaryCardSkeleton labels={FIAT_SUMMARY_LABELS} totalLabel={ru.withdraw.totalDebitLabel}/>}
        {method && (
          <SummaryCard
            rows={[
              { key: 'min', label: ru.withdraw.minAmountLabel, value: `${ru.withdraw.minAmountPrefix} ${formatAmount(method.minimalAmount, currency)} ${currency}` },
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
