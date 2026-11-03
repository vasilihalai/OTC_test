import { useEffect, useState } from 'react';

import { Modal } from '@/components/Modal/Modal.tsx';
import { CodeInput } from '@/components/CodeInput/CodeInput.tsx';
import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { notifyError, notifySuccess } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './AuthenticatorModal.css';

export interface AuthenticatorModalProps {
  open: boolean;
  onClose: () => void;
  /** Verifies the code (and, for callers whose "verification" is really a submission, performs it atomically). Reject with an `Error` whose `message` is already display-ready to show inline. */
  onSubmit: (code: string) => Promise<void>;
  onVerified: () => void;
}

export function AuthenticatorModal({ open, onClose, onSubmit, onVerified }: AuthenticatorModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (open) {
      setCode('');
      setError(undefined);
      setVerifying(false);
    }
  }, [open]);

  async function handleComplete(value: string) {
    setVerifying(true);
    setError(undefined);
    try {
      await onSubmit(value);
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

  return (
    <Modal open={open} title={ru.authenticator.title} onClose={onClose}>
      <p className="authenticator-modal__body">{ru.authenticator.body}</p>
      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={(value) => void handleComplete(value)}
        error={!!error}
        disabled={verifying}
      />
      {verifying && (
        <p className="authenticator-modal__status"><Spinner size={16}/>{ru.verification.verifyingLabel}</p>
      )}
      {error && <p className="authenticator-modal__error">{error}</p>}
    </Modal>
  );
}
