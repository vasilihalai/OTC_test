import { useEffect, useState } from 'react';

import { Modal } from '@/components/Modal/Modal.tsx';
import { CodeInput } from '@/components/CodeInput/CodeInput.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { CodeStatus } from '@/components/CodeStatus/CodeStatus.tsx';
import { ApiError, mapApiError } from '@/api/index.ts';
import { formatClock } from '@/lib/countdown.ts';
import { maskEmail } from '@/lib/mask.ts';
import { RateLimitedError } from '@/lib/rateLimitedError.ts';
import { useResendCountdown } from '@/lib/useResendCountdown.ts';
import { notifyError, notifySuccess } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './VerificationModal.css';

const LOCKOUT_SECONDS = 30;

export interface VerificationModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
  /** Verifies the code (and, for callers whose "verification" is really a submission, performs it atomically). Reject with an `Error` whose `message` is already display-ready to show inline. */
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onVerified: () => void;
}

export function VerificationModal({ open, email, onClose, onSubmit, onResend, onVerified }: VerificationModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const { secondsLeft, restart } = useResendCountdown(open);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCode('');
    setError(undefined);
    restart();
    setLockoutCountdown(0);
  }, [open, restart]);

  useEffect(() => {
    if (lockoutCountdown <= 0) {
      return;
    }
    const timer = setInterval(() => setLockoutCountdown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [lockoutCountdown > 0]);

  async function handleComplete(value: string) {
    setVerifying(true);
    setError(undefined);
    try {
      await onSubmit(value);
      notifySuccess();
      onVerified();
    } catch (err) {
      notifyError();
      if (err instanceof RateLimitedError) {
        setError(ru.verification.errorRateLimit);
        setLockoutCountdown(LOCKOUT_SECONDS);
      } else {
        setError(err instanceof Error ? err.message : ru.verification.errorCodeInvalid);
      }
      setCode('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await onResend();
      setCode('');
      setError(undefined);
      restart();
    } catch (err) {
      // Used to go unhandled: the button did nothing and said nothing.
      console.error('[VerificationModal] resend failed', err);
      notifyError();
      setError(err instanceof ApiError ? mapApiError(err) : ru.common.errorGeneric);
    } finally {
      setResending(false);
    }
  }

  const locked = lockoutCountdown > 0 || verifying;

  return (
    <Modal
      open={open}
      title={ru.verification.title}
      onClose={onClose}
      footer={(
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
      )}
    >
      <p className="verification-modal__sent-to">{ru.verification.sentTo}</p>
      <p className="verification-modal__email">{maskEmail(email)}</p>

      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={(value) => void handleComplete(value)}
        error={!!error}
        disabled={locked}
      />
      <CodeStatus verifying={verifying} error={error}/>
    </Modal>
  );
}
