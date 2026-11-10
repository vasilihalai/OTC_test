import { useEffect, useState } from 'react';

import { Modal } from '@/components/Modal/Modal.tsx';
import { CodeInput } from '@/components/CodeInput/CodeInput.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { CodeStatus } from '@/components/CodeStatus/CodeStatus.tsx';
import type { AuthOtpSource } from '@/api/index.ts';
import { formatClock } from '@/lib/countdown.ts';
import { useResendCountdown } from '@/lib/useResendCountdown.ts';
import { notifyError, notifySuccess } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './OtpConfirmModal.css';

export interface OtpConfirmSubmitParams {
  transactionId: string;
  otp: string;
}

export interface OtpConfirmModalProps {
  open: boolean;
  email: string;
  transactionId: string;
  /** From the OTP-issue step's response — which single second factor this account has, never both at once. */
  source: AuthOtpSource;
  onClose: () => void;
  /** Verifies the code. Reject with an `Error` whose `message` is already display-ready (via `errorMap.ts`) to show inline; resolve on success. */
  onSubmit: (params: OtpConfirmSubmitParams) => Promise<void>;
  /** Re-issues the code; only called for `source: 'email'` — an authenticator code isn't "sent" anywhere to resend. Returns the (possibly new) transactionId/source — api-integration.md §2.3 explicitly returns a fresh transactionId on confirm. */
  onResend: () => Promise<{ transactionId: string; source: AuthOtpSource }>;
  onVerified: () => void;
}

/**
 * Generic OTP-confirm step shared by sign-in (api-integration.md §2.1) and
 * password recovery (§2.3). An account has exactly one second factor
 * configured — this shows a single code field, picked by `source`, the same
 * way the withdrawal-confirmation `TwoFactorGate` trio picks one of
 * `VerificationModal`/`AuthenticatorModal` — rather than always asking for
 * an email code plus an authenticator code on top.
 */
export function OtpConfirmModal({
  open, email, transactionId, source, onClose, onSubmit, onResend, onVerified,
}: OtpConfirmModalProps) {
  const [txId, setTxId] = useState(transactionId);
  const [currentSource, setCurrentSource] = useState(source);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const { secondsLeft, restart } = useResendCountdown(open && currentSource === 'email');

  useEffect(() => {
    if (!open) {
      return;
    }
    setTxId(transactionId);
    setCurrentSource(source);
    setCode('');
    setError(undefined);
    restart();
  }, [open, transactionId, source, restart]);

  async function attemptConfirm(value: string) {
    setVerifying(true);
    setError(undefined);
    try {
      await onSubmit({ transactionId: txId, otp: value });
      notifySuccess();
      onVerified();
    } catch (err) {
      notifyError();
      setError(err instanceof Error ? err.message : ru.verification.errorCodeInvalid);
      setCode('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(undefined);
    setResending(true);
    try {
      const next = await onResend();
      setTxId(next.transactionId);
      setCurrentSource(next.source);
      setCode('');
      restart();
    } catch (err) {
      notifyError();
      setError(err instanceof Error ? err.message : ru.verification.errorCodeInvalid);
    } finally {
      setResending(false);
    }
  }

  const isEmail = currentSource === 'email';

  return (
    <Modal
      open={open}
      title={isEmail ? ru.verification.title : ru.authenticator.title}
      onClose={onClose}
      footer={isEmail ? (
        <Button
          type="button"
          variant="secondary"
          disabled={secondsLeft > 0}
          loading={resending}
          onClick={() => void handleResend()}
        >
          {secondsLeft > 0
            ? `${ru.verification.resendAction} ${formatClock(secondsLeft)}`
            : ru.verification.resendAction}
        </Button>
      ) : undefined}
    >
      {isEmail ? (
        <>
          <p className="otp-confirm-modal__sent-to">{ru.verification.sentTo}</p>
          <p className="otp-confirm-modal__email">{email}</p>
        </>
      ) : (
        <p className="otp-confirm-modal__sent-to">{ru.authenticator.body}</p>
      )}

      <CodeInput value={code} onChange={setCode} onComplete={(value) => void attemptConfirm(value)} error={!!error} disabled={verifying}/>

      <CodeStatus verifying={verifying} error={error}/>
    </Modal>
  );
}
