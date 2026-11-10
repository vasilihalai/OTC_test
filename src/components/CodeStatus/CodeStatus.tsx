import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { ru } from '@/i18n/ru.ts';

import './CodeStatus.css';

export interface CodeStatusProps {
  verifying: boolean;
  error?: string;
}

/** The line under a code field, the same in every code modal: "Проверяем код…" while it is checked, the reason when it is refused. */
export function CodeStatus({ verifying, error }: CodeStatusProps) {
  if (verifying) {
    return <p className="code-status" role="status"><Spinner size={16}/>{ru.verification.verifyingLabel}</p>;
  }
  if (error) {
    return <p className="code-status code-status--error" role="alert">{error}</p>;
  }
  return null;
}
