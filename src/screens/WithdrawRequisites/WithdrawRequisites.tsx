import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Select } from '@/components/Select/Select.tsx';
import { TextField } from '@/components/TextField/TextField.tsx';
import { Checkbox } from '@/components/Checkbox/Checkbox.tsx';
import { SummaryCard, SummaryCardSkeleton } from '@/components/SummaryCard/SummaryCard.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { TwoFactorGate } from '@/components/TwoFactorGate/TwoFactorGate.tsx';
import {
  ApiError,
  confirmWithdrawOtp,
  getWithdrawFiatQuote,
  issueWithdrawOtp,
  mapApiError,
} from '@/api/index.ts';
import type { RequisitesPayload, SavedRequisite, WithdrawOtpSource, WithdrawQuote } from '@/api/index.ts';
import { FIAT_SUMMARY_LABELS } from '@/screens/WithdrawFiat/WithdrawFiatSkeleton.tsx';
import { useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { formatAmount } from '@/lib/money.ts';
import { useSavedRequisites, useWithdrawFiatOptions } from '@/lib/queries.ts';
import { RateLimitedError } from '@/lib/rateLimitedError.ts';
import { notifyError } from '@/telegram/adapter.ts';
import { showWithdrawalAccepted } from '@/lib/withdrawalToast.ts';
import { ru } from '@/i18n/ru.ts';

import './WithdrawRequisites.css';

export interface WithdrawFiatRouteState {
  ticker: string;
  paymentType: string;
  operationOption: string;
  amount: string;
}

const NEW_OPTION = '__new__';

const NO_SAVED: SavedRequisite[] = [];

export function WithdrawRequisites() {
  const session = useRequireSession();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as WithdrawFiatRouteState | null;
  const bumpBalancesVersion = useUiStore((s) => s.bumpBalancesVersion);

  // Saved requisites are a convenience; without them the form is still fully usable. The methods are
  // the very ones the previous screen has just shown, so they are in memory already.
  const saved = useSavedRequisites().data ?? NO_SAVED;
  const methods = useWithdrawFiatOptions(routeState?.ticker ?? '');
  const options = methods.data;
  const [choice, setChoice] = useState<string>(NEW_OPTION);
  const [account, setAccount] = useState('');
  const [bic, setBic] = useState('');
  const [kpp, setKpp] = useState('');
  const [bankName, setBankName] = useState('');
  const [inn, setInn] = useState('');
  const [corrAccount, setCorrAccount] = useState('');
  const [saveForLater, setSaveForLater] = useState(false);
  const [accountError, setAccountError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const withdrawalId = useRef<string>();
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSource, setOtpSource] = useState<WithdrawOtpSource>('email');
  const [quote, setQuote] = useState<WithdrawQuote>();
  const [requisitesPayload, setRequisitesPayload] = useState<RequisitesPayload>();

  useEffect(() => {
    if (!routeState) {
      navigate('/withdraw/fiat', { replace: true });
    }
  }, [routeState, navigate]);

  // The requisites field set is decided by the withdrawal method chosen on
  // the previous screen — it's not a separate choice made here.
  const method = options?.methods.find((m) => m.paymentType === routeState?.paymentType);
  const transferType = method?.transferType ?? 'internal';
  // Only requisites saved for this same field set make sense to offer —
  // picking one that doesn't match would populate fields the current
  // method doesn't even show.
  const compatibleSaved = saved.filter((r) => r.transferType === transferType);
  const isNew = choice === NEW_OPTION;
  const selected = compatibleSaved.find((r) => r.id === choice);

  // Fields never disappear — picking a saved requisite fills them in
  // (read-only) instead of hiding the form; picking "new" clears them for
  // manual entry.
  useEffect(() => {
    if (selected) {
      setAccount(selected.account);
      setBankName(selected.bankName ?? '');
      setInn(selected.inn ?? '');
      setCorrAccount(selected.correspondentAccount ?? '');
      setBic(selected.bic ?? '');
      setKpp(selected.kpp ?? '');
      setSaveForLater(false);
    } else {
      setAccount('');
      setBankName('');
      setInn('');
      setCorrAccount('');
      setBic('');
      setKpp('');
    }
    setAccountError(undefined);
  }, [choice, selected]);

  if (!routeState) {
    return null;
  }

  const { ticker, amount, paymentType, operationOption } = routeState;
  const feePercent = method ? Number(method.commissionPercent) : 0;
  const feeFixed = method ? Number(method.commissionFixed) : 0;
  const fee = quote ? Number(quote.commission) : feeFixed + (Number(amount) * feePercent) / 100;
  const totalDebit = quote ? Number(quote.amountToWithdraw) : Number(amount) + fee;

  function buildRequisites(): RequisitesPayload {
    return {
      transferType,
      account,
      bankName: transferType !== 'internal' ? bankName : undefined,
      bic: transferType !== 'internal' ? bic : undefined,
      kpp: transferType === 'ru' ? kpp : undefined,
      inn: transferType !== 'internal' ? inn : undefined,
      correspondentAccount: transferType === 'ru' ? corrAccount : undefined,
      saveForLater: isNew && saveForLater,
    };
  }

  // §5.2/§5.4: the quote is fetched here, at confirm time, not per-keystroke
  // — a bank-requisites form has too many fields for a debounced live quote
  // to make sense the way the crypto address field does. `isRequisiteSave`
  // rides along on the same call (§5.4), so a new "sohranit'" requisite is
  // created inline with the withdrawal rather than a separate round trip.
  async function handleConfirm() {
    setAccountError(undefined);
    if (!account.trim()) {
      setAccountError(ru.withdraw.errorAccountRequired);
      notifyError();
      return;
    }

    const requisites = buildRequisites();
    setSubmitting(true);
    try {
      const nextQuote = await getWithdrawFiatQuote({ currency: ticker, paymentType, operationOption, amount, requisites });
      setQuote(nextQuote);
      setRequisitesPayload(requisites);
      const otp = await issueWithdrawOtp(nextQuote.transactionId, session!.clientType);
      setOtpSource(otp.source);
      setOtpOpen(true);
    } catch (err) {
      notifyError();
      setAccountError(err instanceof ApiError ? mapApiError(err) : ru.withdraw.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(code: string) {
    if (!quote) {
      throw new Error(ru.withdraw.errorGeneric);
    }
    try {
      withdrawalId.current = (await confirmWithdrawOtp(quote.transactionId, code, requisitesPayload)).id;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.httpStatus === 429) {
          throw new RateLimitedError();
        }
        throw new Error(mapApiError(err));
      }
      throw err;
    }
  }

  async function handleOtpResend() {
    if (!quote) {
      return;
    }
    const otp = await issueWithdrawOtp(quote.transactionId, session!.clientType);
    setOtpSource(otp.source);
  }

  function handleOtpVerified() {
    setOtpOpen(false);
    bumpBalancesVersion();
    showWithdrawalAccepted(withdrawalId.current);
    navigate('/home', { replace: true });
  }

  return (
    <div className="withdraw-requisites">
      <div className="withdraw-requisites__scroll">
      <h1 className="withdraw-requisites__title">{ru.withdraw.requisitesTitle}</h1>

      {compatibleSaved.length > 0 && (
        <Select
          label={ru.withdraw.savedRequisiteLabel}
          layout="plain"
          options={[
            ...compatibleSaved.map((r) => ({ value: r.id, label: r.label })),
            { value: NEW_OPTION, label: ru.withdraw.newRequisiteOption, placeholder: true },
          ]}
          value={choice}
          onChange={setChoice}
        />
      )}

      {transferType !== 'internal' && (
        <TextField label={ru.withdraw.innLabel} hint={ru.withdraw.innHint} placeholder={ru.withdraw.innPlaceholder} value={inn} disabled={!isNew} onChange={(e) => setInn(e.target.value)}/>
      )}
      {transferType === 'ru' && (
        <TextField label={ru.withdraw.kppLabel} hint={ru.withdraw.kppHint} placeholder={ru.withdraw.kppPlaceholder} value={kpp} disabled={!isNew} onChange={(e) => setKpp(e.target.value)}/>
      )}
      {transferType !== 'internal' && (
        <TextField label={ru.withdraw.bankNameLabel} hint={ru.withdraw.bankNameHint} placeholder={ru.withdraw.bankNamePlaceholder} value={bankName} disabled={!isNew} onChange={(e) => setBankName(e.target.value)}/>
      )}
      {transferType !== 'internal' && (
        <TextField label={ru.withdraw.bicLabel} hint={ru.withdraw.bicHint} placeholder={ru.withdraw.bicPlaceholder} value={bic} disabled={!isNew} onChange={(e) => setBic(e.target.value)}/>
      )}
      {transferType === 'ru' && (
        <TextField label={ru.withdraw.correspondentAccountLabel} hint={ru.withdraw.correspondentAccountHint} placeholder={ru.withdraw.correspondentAccountPlaceholder} value={corrAccount} disabled={!isNew} onChange={(e) => setCorrAccount(e.target.value)}/>
      )}
      <TextField
        label={ru.withdraw.recipientAccountLabel}
        hint={ru.withdraw.recipientAccountHint}
        placeholder={ru.withdraw.recipientAccountPlaceholder}
        value={account}
        error={accountError}
        disabled={!isNew}
        onChange={(e) => setAccount(e.target.value)}
      />

      {isNew && (
        <Checkbox checked={saveForLater} onChange={setSaveForLater} label={ru.withdraw.saveRequisiteLabel}/>
      )}

      {methods.loading && <SummaryCardSkeleton labels={FIAT_SUMMARY_LABELS} totalLabel={ru.withdraw.totalDebitLabel}/>}
      {method && (
        <SummaryCard
          rows={[
            { key: 'min', label: ru.withdraw.minAmountLabel, value: `${ru.withdraw.minAmountPrefix} ${formatAmount(method.minimalAmount, ticker)} ${ticker}` },
            { key: 'limit', label: ru.withdraw.limitLabel, value: `${formatAmount(method.maximumAmount, ticker)} ${ticker}` },
            { key: 'amount', label: ru.withdraw.enteredAmountLabel, value: `${formatAmount(amount, ticker)} ${ticker}` },
            { key: 'fee', label: ru.withdraw.feeLabel, value: `${formatAmount(String(fee), ticker)} ${ticker}` },
          ]}
          totalLabel={ru.withdraw.totalDebitLabel}
          totalValue={`${formatAmount(String(totalDebit), ticker)} ${ticker}`}
        />
      )}
      </div>

      <div className="withdraw-requisites__submit button-row">
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>{ru.withdraw.cancelAction}</Button>
        <Button loading={submitting} disabled={!account.trim()} onClick={() => void handleConfirm()}>{ru.withdraw.confirmAction}</Button>
      </div>

      <TwoFactorGate
        open={otpOpen}
        authenticatorEnabled={otpSource === 'authenticator'}
        email={session?.email ?? ''}
        onClose={() => setOtpOpen(false)}
        onSubmit={handleOtpSubmit}
        onResend={handleOtpResend}
        onVerified={handleOtpVerified}
      />
    </div>
  );
}
