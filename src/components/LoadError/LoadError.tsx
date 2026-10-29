import { Button } from '@/components/Button/Button.tsx';
import { bem } from '@/css/bem.ts';
import { ru } from '@/i18n/ru.ts';

import './LoadError.css';

const [b, e] = bem('load-error');

export interface LoadErrorProps {
  message: string;
  onRetry: () => void;
}

/** Inline "couldn't load" + retry for a block whose request failed, so it never sits on a skeleton forever. */
export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className={b()} role="alert">
      <p className={e('text')}>{message}</p>
      <Button variant="secondary" size="compact" onClick={onRetry}>{ru.common.retryAction}</Button>
    </div>
  );
}
