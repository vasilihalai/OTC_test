import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { bem } from '@/css/bem.ts';

import './HintTooltip.css';

const [b, e] = bem('hint-tooltip');

const SCREEN_MARGIN = 12;

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.9" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6.3 6.2a1.7 1.7 0 1 1 2.500 1.500c-.5.3-.8.6-.8 1.200" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor"/>
    </svg>
  );
}

export interface HintTooltipProps {
  text: string;
  /** What the hint is about, for screen readers. */
  label: string;
}

export function HintTooltip({ text, label }: HintTooltipProps) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(ev: PointerEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // A long label pushes the icon toward the screen edge: the bubble slides
  // back inside while its arrow stays on the icon.
  useLayoutEffect(() => {
    if (!open || !bubbleRef.current) {
      return;
    }
    const rect = bubbleRef.current.getBoundingClientRect();
    const overRight = rect.right - (window.innerWidth - SCREEN_MARGIN);
    setShift(overRight > 0 ? -overRight : Math.max(0, SCREEN_MARGIN - rect.left));
  }, [open]);

  return (
    <span className={b()} ref={rootRef}>
      <button type="button" className={e('button')} aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <HelpIcon/>
      </button>
      {open && (
        <>
          <span className={e('arrow')} aria-hidden="true"/>
          <span className={e('bubble')} ref={bubbleRef} role="tooltip" style={{ marginLeft: shift }}>{text}</span>
        </>
      )}
    </span>
  );
}
