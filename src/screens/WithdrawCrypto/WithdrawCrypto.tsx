import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Panel } from '@/components/Panel/Panel.tsx';
import { Select } from '@/components/Select/Select.tsx';
import { TextField } from '@/components/TextField/TextField.tsx';
import { AmountField } from '@/components/AmountField/AmountField.tsx';
import { SummaryCard } from '@/components/SummaryCard/SummaryCard.tsx';
import { CurrencyIcon } from '@/components/CurrencyIcon/CurrencyIcon.tsx';
import { WarningPanel } from '@/components/WarningPanel/WarningPanel.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import { TwoFactorGate } from '@/components/TwoFactorGate/TwoFactorGate.tsx';
import { QrScannerModal } from '@/components/QrScannerModal/QrScannerModal.tsx';
import {
  ApiError,
  confirmWithdrawOtp,
  getAssets,
  getWithdrawCryptoOptions,
  getWithdrawCryptoQuote,
  issueWithdrawOtp,
  mapApiError,
} from '@/api/index.ts';
import type { Asset, CryptoWithdrawOptions, WithdrawOtpSource, WithdrawQuote } from '@/api/index.ts';
import { useRequireSession } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { useTransferModalStore } from '@/store/transferModal.ts';
import { formatAmount } from '@/lib/money.ts';
import { extractAddressFromQr, isValidCryptoAddress } from '@/lib/cryptoAddress.ts';
import { RateLimitedError } from '@/lib/rateLimitedError.ts';
import { notifyError } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './WithdrawCrypto.css';

const QUOTE_DEBOUNCE_MS = 500;
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
  const balancesVersion = useUiStore((s) => s.balancesVersion);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const [assetsAttempt, setAssetsAttempt] = useState(0);
  const [ticker, setTicker] = useState(preselected ?? '');
  const [options, setOptions] = useState<CryptoWithdrawOptions>();
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [networkId, setNetworkId] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [addressError, setAddressError] = useState<string>();
  const [qrOpen, setQrOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [quote, setQuote] = useState<WithdrawQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSource, setOtpSource] = useState<WithdrawOtpSource>('email');

  const address = manualAddress.trim();

  useEffect(() => {
    setAssetsFailed(false);
    void getAssets('crypto').then((data) => {
      setAssets(data);
      setTicker((current) => (current && data.some((a) => a.ticker === current) ? current : (data[0]?.ticker ?? '')));
    }).catch((err: unknown) => {
      console.error('[WithdrawCrypto] assets load failed', err);
      setAssetsFailed(true);
    }).finally(() => setInitialLoading(false));
  }, [balancesVersion, assetsAttempt]);

  useEffect(() => {
    if (!ticker) {
      return;
    }
    setOptionsLoading(true);
    setOptionsFailed(false);
    // Address/amount are cleared by handleTickerChange on a user's switch — not here, or an address
    // pasted while the first network list is still loading would be wiped when it lands.
    void getWithdrawCryptoOptions(ticker).then((data) => {
      setOptions(data);
      setNetworkId(data.networks[0]?.currencyNetworkId ?? '');
      setQuote(undefined);
    }).catch((err: unknown) => {
      // Used to fail silently: no network selected, so no quote and a permanently disabled button.
      console.error('[WithdrawCrypto] withdraw options load failed', err);
      setOptions(undefined);
      setNetworkId('');
      setOptionsFailed(true);
    }).finally(() => setOptionsLoading(false));
  }, [ticker, optionsAttempt]);

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

  function handleTickerChange(value: string) {
    setTicker(value);
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
      setAmountError(err instanceof ApiError ? mapApiError(err) : ru.withdraw.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(code: string) {
    if (!quote) {
      throw new Error(ru.withdraw.errorGeneric);
    }
    try {
      await confirmWithdrawOtp(quote.transactionId, code, { address });
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
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="withdraw-crypto">
        <Panel>
          <h1 className="withdraw-crypto__success-title">{ru.withdraw.successTitle}</h1>
          <p className="withdraw-crypto__success-body">{ru.withdraw.successBody}</p>
          <Button variant="accent" onClick={() => navigate('/home', { replace: true })}>{ru.withdraw.doneAction}</Button>
        </Panel>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="withdraw-crypto">
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
      <div className="withdraw-crypto">
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
                onClick={() => setQrOpen(true)}
                aria-label={ru.withdraw.qrScannerTitle}
              >
                <QrIcon/>
              </button>
            )}
          />
        </div>
        {optionsLoading && <Skeleton height={48} radius={12}/>}
        {optionsFailed && <LoadError message={ru.withdraw.optionsError} onRetry={() => setOptionsAttempt((n) => n + 1)}/>}
        {!optionsLoading && options?.networks.length === 0 && (
          <p className="withdraw-crypto__note">{ru.withdraw.noNetworks}</p>
        )}
        {/* §5.1: hide the selector when there's exactly one network — this now falls out naturally from the real network list length, not a hardcoded BTC check. */}
        {!optionsLoading && options && options.networks.length > 1 && (
          <Select
            label={ru.withdraw.networkLabel}
            layout="plain"
            options={options.networks.map((n) => ({ value: n.currencyNetworkId, label: n.networkLabel }))}
            value={networkId}
            onChange={setNetworkId}
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
            rows={[
              { key: 'min', label: ru.withdraw.minAmountLabel, value: `${formatAmount(quote.minimalAmount, ticker)} ${ticker}` },
              ...(limit
                ? [{ key: 'limit', label: ru.withdraw.limitLabel, value: `${formatAmount(limit.availableLimit, limit.currency)} ${limit.currency}` }]
                : []),
              ...(quote.contractAddress
                ? [{
                  key: 'contract',
                  label: ru.withdraw.contractAddressLabel,
                  value: ru.withdraw.contractTailPrefixText,
                  tail: quote.contractAddress.slice(-8),
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
      <QrScannerModal open={qrOpen} onClose={() => setQrOpen(false)} onScan={handleQrScan}/>
    </div>
  );
}
