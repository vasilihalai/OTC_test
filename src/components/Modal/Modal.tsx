import type { PropsWithChildren, ReactNode } from 'react';

import { bem } from '@/css/bem.ts';
import { useDelayedUnmount } from '@/lib/useDelayedUnmount.ts';

import './Modal.css';

const EXIT_DURATION_MS = 160;

const [, e] = bem('modal');

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

export interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  /** Card width in px — defaults to 400 (capped by `max-width: calc(100% - 32px)`). Per-instance so narrowing one modal doesn't narrow every modal. */
  width?: number;
}

export function Modal({ open, title, onClose, footer, children, width = 400 }: ModalProps) {
  const rendered = useDelayedUnmount(open, EXIT_DURATION_MS);
  if (!rendered) {
    return null;
  }

  return (
    <div className={e('scrim', { closing: !open })} onClick={onClose}>
      <div className={e('card', { closing: !open })} style={{ width }} onClick={(ev) => ev.stopPropagation()}>
        <div className={e('top')}>
          <span className={e('title')}>{title}</span>
          <button type="button" className={e('close')} aria-label="Close" onClick={onClose}>
            <CloseIcon/>
          </button>
        </div>
        <div className={e('body')}>{children}</div>
        {footer && <div className={e('bottom')}>{footer}</div>}
      </div>
    </div>
  );
}
