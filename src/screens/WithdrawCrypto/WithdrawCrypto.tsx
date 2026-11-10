import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { HintTooltip } from '@/components/HintTooltip/HintTooltip.tsx';
import { Select } from '@/components/Select/Select.tsx';
import { TextField } from '@/components/TextField/TextField.tsx';
import { AmountField } from '@/components/AmountField/AmountField.tsx';
import { SummaryCard } from '@/components/SummaryCard/SummaryCard.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { WarningPanel } from '@/components/WarningPanel/WarningPanel.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { FieldSkeleton } from '@/components/Skeleton/FieldSkeleton.tsx';
import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import { TwoFactorGate } from '@/components/TwoFactorGate/TwoFactorGate.tsx';
import { type ExtraCheck, ExtraCheckDialog } from '@/components/ExtraCheckDialog/ExtraCheckDialog.tsx';
import {
  ApiError,
  confirmWithdrawOtp,
  getWithdrawCryptoQuote,
  issueWithdrawOtp,
  mapApiError,
} from '@/api/index.ts';
import type { Asset, WithdrawOtpSource, WithdrawQuote } from '@/api/index.ts';
import { WithdrawCryptoSkeleton } from '@/screens/WithdrawCrypto/WithdrawCryptoSkeleton.tsx';
import { useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { formatAmount } from '@/lib/money.ts';
import { extractAddressFromQr, isValidCryptoAddress } from '@/lib/cryptoAddress.ts';
import { useAssets, useWithdrawCryptoOptions } from '@/lib/queries.ts';
import { RateLimitedError } from '@/lib/rateLimitedError.ts';
import { notifyError } from '@/telegram/adapter.ts';
import { showWithdrawalAccepted } from '@/lib/withdrawalToast.ts';
import { ru } from '@/i18n/ru.ts';

import './WithdrawCrypto.css';

// The scanner brings a QR decoder several times the size of this screen, and most withdrawals never
// open it: it is fetched when the client reaches for the camera button.
const loadQrScanner = () => import('@/components/QrScannerModal/QrScannerModal.tsx');
const QrScannerModal = lazy(() => loadQrScanner().then((module) => ({ default: module.QrScannerModal })));

const NO_ASSETS: Asset[] = [];

const QUOTE_DEBOUNCE_MS = 400;
// A typed address is judged once the user pauses, not on every keystroke.
const ADDRESS_CHECK_DELAY_MS = 700;

function QrIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 12h2.5v2.5H12zM16 12h1.5v1.5M16 16h1.5v1.5M12 16h1.5v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

/** §5.2: "Show the smallest availableLimit across the returned periods ... render its currency." Not guaranteed which periods exist. */
function smallestLimit(quote: WithdrawQuote | undefined): { availableLimit: string; currency: string } | undefined {
  const entries = Object.values(quote?.limits ?? {});
  if (entries.length === 0) {
    return undefined;
  }
  return entries.reduce((min, entry) => (Number(entry.availableLimit) < Number(min.availableLimit) ? entry : min));
}

export function WithdrawCrypto() {
  const session = useRequireSession();
  const navigate = useNavigate();
  const openTransferModal = useTransferModalStore((s) => s.open);
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('asset');
  const bumpBalancesVersion = useUiStore((s) => s.bumpBalancesVersion);

  // Coming from Home, the assets are already in memory and the form opens complete; a transfer or a
  // withdrawal re-reads them on its own (`balancesChanged`).
  const balances = useAssets();
  const assets = balances.data?.crypto ?? NO_ASSETS;
  const [chosenTicker, setChosenTicker] = useState(preselected ?? '');
  // The asset asked for is kept while the list loads (its networks load alongside) and whenever the
  // account has it; otherwise the first one.
  const ticker = !balances.data || assets.some((a) => a.ticker === chosenTicker) ? chosenTicker : (assets[0]?.ticker ?? '');
  const networks = useWithdrawCryptoOptions(ticker);
  const options = networks.data;
  const [chosenNetworkId, setChosenNetworkId] = useState('');
  // The first network until the client picks another one of this asset's.
  const networkId = options?.networks.some((n) => n.currencyNetworkId === chosenNetworkId)
    ? chosenNetworkId
    : (options?.networks[0]?.currencyNetworkId ?? '');
  const [manualAddress, setManualAddress] = useState('');
  const [addressError, setAddressError] = useState<string>();
  const [qrOpen, setQrOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [quote, setQuote] = useState<WithdrawQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const withdrawalId = useRef<string>();
  // A withdrawal stopped by a check that only the web cabinet can show (see ExtraCheckDialog).
  const waitsForCheck = useRef(false);
  const [extraCheck, setExtraCheck] = useState<ExtraCheck>();
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSource, setOtpSource] = useState<WithdrawOtpSource>('email');

  const address = manualAddress.trim();

  const asset = assets.find((a) => a.ticker === ticker);
  const available = asset?.balance ?? '0';
  const selectedNetwork = options?.networks.find((n) => n.currencyNetworkId === networkId);
  const addressValid = !!selectedNetwork && isValidCryptoAddress(address, selectedNetwork);
  const invalidAddressMessage = selectedNetwork?.networkLabel
    ? `${ru.withdraw.errorAddressInvalidForNetwork} ${selectedNetwork.networkLabel}`
    : ru.withdraw.errorAddressInvalid;

  useEffect(() => {
    if (!address || !selectedNetwork) {
      return;
    }
    if (addressValid) {
      setAddressError(undefined);
      return;
    }
    const timer = setTimeout(() => setAddressError(invalidAddressMessage), ADDRESS_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [address, selectedNetwork, addressValid, invalidAddressMessage]);

  // §5.2 — a fresh quote whenever what would change its numbers changes. Debounced so typing an
  // amount doesn't fire a request per keystroke; never for an address that fails validation.
  useEffect(() => {
    if (!ticker || !networkId || !addressValid || !amount || Number(amount) <= 0) {
      setQuote(undefined);
      return;
    }
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      void getWithdrawCryptoQuote({ currency: ticker, currencyNetworkId: networkId, amount, address })
        .then(setQuote)
        .catch((err) => {
          setQuote(undefined);
          setAmountError(err instanceof ApiError ? mapApiError(err) : ru.withdraw.errorGeneric);
        })
        .finally(() => setQuoteLoading(false));
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      setQuoteLoading(false);
    };
  }, [ticker, networkId, address, addressValid, amount]);

  // §5.2: "expiredAt means the quote goes stale. Re-request withdraw/info if
  // the user sits on the screen past it, and disable submit in the meantime."
  useEffect(() => {
    if (!quote?.expiredAt) {
      return;
    }
    const msLeft = new Date(quote.expiredAt).getTime() - Date.now();
    if (msLeft <= 0) {
      setQuote(undefined);
      return;
    }
    const timer = setTimeout(() => setQuote(undefined), msLeft);
    return () => clearTimeout(timer);
  }, [quote?.expiredAt]);

  function handleMax() {
    setAmount(available);
    setAmountError(undefined);
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    setAmountError(value && Number(value) > Number(available) ? ru.withdraw.errorInsufficientFunds : undefined);
  }

  function handleAddressChange(value: string) {
    setManualAddress(value);
    setAddressError(undefined);
  }

  function handleAddressBlur() {
    if (address && selectedNetwork && !addressValid) {
      setAddressError(invalidAddressMessage);
    }
  }

  // The address and the amount belong to the asset they were entered for. (Not cleared when the
  // networks arrive: an address pasted while they load must stay.)
  function handleTickerChange(value: string) {
    setChosenTicker(value);
    setManualAddress('');
    setAmount('');
  }

  function handleQrScan(scanned: string) {
    const scannedAddress = extractAddressFromQr(scanned);
    setManualAddress(scannedAddress);
    setAddressError(selectedNetwork && !isValidCryptoAddress(scannedAddress, selectedNetwork) ? invalidAddressMessage : undefined);
    setQrOpen(false);
  }

  const canConfirm = !!quote && !quoteLoading && addressValid;

  async function handleConfirm() {
    setAddressError(undefined);
    setAmountError(undefined);
    if (!address) {
      setAddressError(ru.withdraw.errorAddressRequired);
      notifyError();
      return;
    }
    if (!addressValid) {
      setAddressError(invalidAddressMessage);
      notifyError();
      return;
    }
    if (!quote) {
      notifyError();
      return;
    }
    if (Number(amount) < Number(quote.minimalAmount)) {
      setAmountError(ru.withdraw.errorBelowMin);
      notifyError();
      return;
    }
    if (Number(amount) > Number(available)) {
      setAmountError(ru.withdraw.errorAboveAvailable);
      notifyError();
      return;
    }

    // §5.2: "options.confirmation2FA/confirmationEmail tell you which second
    // factor this specific operation needs — prefer them over the account-
    // level twoFA when present." The authoritative answer is issue-otp's own
    // `source`, requested right before opening the modal.
    setSubmitting(true);
    try {
      const otp = await issueWithdrawOtp(quote.transactionId, session!.clientType);
      setOtpSource(otp.source);
      setOtpOpen(true);
    } catch (err) {
      notifyError();
      if (err instanceof ApiError && err.code === 'EXTRA_CHECK_REQUIRED') {
        // Not an error of the form: the code is held back until the client does the tasks.
        setExtraCheck('before');
      } else {
        setAmountError(err instanceof ApiError ? mapApiError(err) : ru.withdraw.errorGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(code: string) {
    if (!quote) {
      throw new Error(ru.withdraw.errorGeneric);
    }
    try {
      const withdrawal = await confirmWithdrawOtp(quote.transactionId, code, { address });
      withdrawalId.current = withdrawal.id;
      waitsForCheck.current = !!withdrawal.pendingCheck;
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
    if (waitsForCheck.current) {
      // Created, but waiting for the client: say so here; Home follows when the dialog is closed.
      setExtraCheck('paused');
      return;
    }
    showWithdrawalAccepted(withdrawalId.current);
    navigate('/home', { replace: true });
  }

  function closeExtraCheck() {
    const wasPaused = extraCheck === 'paused';
    setExtraCheck(undefined);
    if (wasPaused) {
      navigate('/home', { replace: true });
    }
  }

  if (balances.failed) {
    return (
      <div className="withdraw-crypto">
        <div className="withdraw-crypto__scroll">
          <LoadError message={ru.withdraw.assetsError} onRetry={() => void balances.refetch()}/>
        </div>
      </div>
    );
  }

  if (!balances.data) {
    return <WithdrawCryptoSkeleton/>;
  }

  const limit = smallestLimit(quote);

  return (
    <div className="withdraw-crypto">
      <div className="withdraw-crypto__scroll">
        <h2 className="withdraw-crypto__section-title">{ru.withdraw.chooseAssetTitle}</h2>
        <Select
          label={ru.withdraw.assetLabel}
          layout="asset"
          options={assets.map((a) => ({
            value: a.ticker,
            label: a.ticker,
            secondary: a.name,
            icon: <CurrencyIcon ticker={a.ticker} size={24}/>,
          }))}
          value={ticker}
          onChange={handleTickerChange}
        />

        <h2 className="withdraw-crypto__section-title">
          {ru.withdraw.chooseAddressNetworkTitle}
        </h2>
        <div className="withdraw-crypto__address-label">
          <span>{ru.withdraw.addressLabel}</span>
          <HintTooltip text={ru.withdraw.addressHint} label={ru.withdraw.addressLabel}/>
        </div>
        <div className="withdraw-crypto__address-manual">
          <TextField
            label=""
            placeholder={ru.withdraw.addressPlaceholder}
            value={manualAddress}
            error={addressError}
            onChange={(ev) => handleAddressChange(ev.target.value)}
            onBlur={handleAddressBlur}
            suffix={(
              <button
                type="button"
                className="withdraw-crypto__qr-button"
                // The finger is down on the camera button: start fetching the scanner before the tap ends.
                onPointerDown={() => void loadQrScanner().catch(() => undefined)}
                onClick={() => setQrOpen(true)}
                aria-label={ru.withdraw.qrScannerTitle}
              >
                <QrIcon/>
              </button>
            )}
          />
        </div>
        {networks.loading && <FieldSkeleton label={ru.withdraw.networkLabel}/>}
        {networks.failed && <LoadError message={ru.withdraw.optionsError} onRetry={() => void networks.refetch()}/>}
        {options?.networks.length === 0 && (
          <p className="withdraw-crypto__note rise">{ru.withdraw.noNetworks}</p>
        )}
        {/* §5.1: hide the selector when there's exactly one network — this now falls out naturally from the real network list length, not a hardcoded BTC check. */}
        {options && options.networks.length > 1 && (
          <Select
            label={ru.withdraw.networkLabel}
            layout="plain"
            options={options.networks.map((n) => ({ value: n.currencyNetworkId, label: n.networkLabel }))}
            value={networkId}
            onChange={setChosenNetworkId}
          />
        )}

        <h2 className="withdraw-crypto__section-title">{ru.withdraw.amountSectionTitle}</h2>
        <AmountField
          label={ru.withdraw.sendLabel}
          availableLabel={ru.withdraw.balanceLabel}
          available={`${formatAmount(available, ticker)} ${ticker}`}
          value={amount}
          onChange={handleAmountChange}
          onMax={handleMax}
          maxLabel={ru.withdraw.maxAction}
          error={amountError}
          onTransfer={openTransferModal}
        />

        {quote && (
          <SummaryCard
            className="rise"
            rows={[
              { key: 'min', label: ru.withdraw.minAmountLabel, value: `${ru.withdraw.minAmountPrefix} ${formatAmount(quote.minimalAmount, ticker)} ${ticker}` },
              ...(limit
                ? [{ key: 'limit', label: ru.withdraw.limitLabel, value: `${formatAmount(limit.availableLimit, limit.currency)} ${limit.currency}` }]
                : []),
              ...(quote.contractAddress
                ? [{
                  key: 'contract',
                  label: ru.withdraw.contractAddressLabel,
                  value: `…${quote.contractAddress.slice(-8)}`,
                }]
                : []),
              { key: 'fee', label: ru.withdraw.feeLabel, value: `${formatAmount(quote.commission, ticker)} ${ticker}` },
            ]}
            totalLabel={ru.withdraw.payoutLabel}
            totalValue={`${formatAmount(quote.finalAmount, ticker)} ${ticker}`}
            caption={ru.withdraw.payoutCaption}
          />
        )}

        <WarningPanel body={ru.withdraw.cryptoWarning}/>
      </div>

      <div className="withdraw-crypto__submit">
        <Button variant="accent" loading={submitting || quoteLoading} disabled={!canConfirm} onClick={() => void handleConfirm()}>
          {ru.withdraw.confirmAction}
        </Button>
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
      <ExtraCheckDialog check={extraCheck} onClose={closeExtraCheck}/>
      {qrOpen && (
        <Suspense fallback={<div className="withdraw-crypto__scanner-wait"><Spinner size={28}/></div>}>
          <QrScannerModal open onClose={() => setQrOpen(false)} onScan={handleQrScan}/>
        </Suspense>
      )}
    </div>
  );
}
