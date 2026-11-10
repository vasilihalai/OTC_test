import { type ReactNode, useEffect, useRef, useState } from 'react';

import { CopyIcon } from '@/components/CopyIcon/CopyIcon.tsx';
import { classNames } from '@/css/classnames.ts';
import { useCopy } from '@/lib/useCopy.ts';
import { ru } from '@/i18n/ru.ts';

import './CopyButton.css';

/** How long the tick stays before the copy glyph comes back. */
const COPIED_MS = 1400;

function CopiedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path className="copy-button__tick" pathLength="1" d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export interface CopyButtonProps {
  /** What goes to the clipboard. */
  value: string;
  /** With a caption the button reads as a text link ("Скопировать все реквизиты"); without one it is the bare glyph. */
  children?: ReactNode;
  className?: string;
}

/**
 * Every copy affordance in the app: copies, shows the "Скопировано" toast (`useCopy`), and answers
 * where the finger is — the glyph turns into a tick for a moment.
 */
export function CopyButton({ value, children, className }: CopyButtonProps) {
  const copy = useCopy();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleClick() {
    copy(value);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <button
      type="button"
      className={classNames('copy-button', { 'copy-button--labelled': !!children, 'copy-button--copied': copied }, className)}
      aria-label={children ? undefined : ru.common.copyAction}
      onClick={handleClick}
    >
      <span className="copy-button__glyph">{copied ? <CopiedIcon/> : <CopyIcon/>}</span>
      {children}
    </button>
  );
}
