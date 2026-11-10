import type { ChangeEvent, ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { TransferIcon } from '@/components/TransferIcon/TransferIcon.tsx';
import { bem } from '@/css/bem.ts';
import { formatAmountInput, sanitizeAmountInput } from '@/lib/money.ts';

import './AmountField.css';

/** Number of digits/decimal-points that appear before the caret, ignoring thousands-separator spaces — used to keep the caret in the same logical spot across a re-grouping. */
function significantCountBefore(text: string, caret: number): number {
  return (text.slice(0, caret).match(/[\d.]/g) ?? []).length;
}

/** Inverse of `significantCountBefore` — the caret index in `text` that sits right after the nth digit/decimal-point. */
function caretAtSignificantCount(text: string, count: number): number {
  if (count <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/[\d.]/.test(text[i])) {
      seen++;
      if (seen === count) {
        return i + 1;
      }
    }
  }
  return text.length;
}

const [b, e] = bem('amount-field');

export interface AmountFieldProps {
  label: string;
  availableLabel: string;
  /** The figure with its ticker, or a placeholder while it loads. */
  available: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onMax: () => void;
  maxLabel: string;
  error?: string;
  onTransfer?: () => void;
  assetSelect?: ReactNode;
}

export function AmountField({
  label,
  availableLabel,
  available,
  value,
  onChange,
  onMax,
  maxLabel,
  error,
  onTransfer,
  assetSelect,
}: AmountFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const displayValue = formatAmountInput(value);

  function handleChange(ev: ChangeEvent<HTMLInputElement>) {
    const caret = ev.target.selectionStart ?? ev.target.value.length;
    pendingCaret.current = significantCountBefore(ev.target.value, caret);
    onChange(sanitizeAmountInput(ev.target.value));
  }

  // Grouping thousands live shifts the caret to the input's end by default
  // (the browser has no way to know the reformatted string's "same spot") —
  // this restores it to the same digit it was next to before the re-render.
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) {
      return;
    }
    const pos = caretAtSignificantCount(displayValue, pendingCaret.current);
    inputRef.current.setSelectionRange(pos, pos);
    pendingCaret.current = null;
  }, [displayValue]);

  return (
    <div className={b({ invalid: !!error })}>
      <div className={e('header')}>
        <span className={e('label')}>{label}</span>
        <span className={e('available')}>
          {availableLabel}: {available}
          {onTransfer && (
            <button type="button" className={e('transfer')} aria-label="Transfer" onClick={onTransfer}>
              <TransferIcon width={18} height={15}/>
            </button>
          )}
        </span>
      </div>
      <div className={e('box')}>
        {assetSelect && <div className={e('asset')}>{assetSelect}</div>}
        <input
          ref={inputRef}
          className={e('input')}
          inputMode="decimal"
          placeholder="0"
          value={displayValue}
          onChange={handleChange}
        />
        <button type="button" className={e('max')} onClick={onMax}>{maxLabel}</button>
      </div>
      {error && <span className={e('error')}>{error}</span>}
    </div>
  );
}
