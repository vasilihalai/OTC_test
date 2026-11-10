import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from 'react';

import { bem } from '@/css/bem.ts';

import './CodeInput.css';

const [b, e] = bem('code-input');

const LENGTH = 6;

export interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
}

export function CodeInput({ value, onChange, onComplete, error, disabled }: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (!disabled && value.length < LENGTH) {
      refs.current[value.length]?.focus({ preventScroll: true });
    }
  }, [disabled]);

  function setDigitAt(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    const nextValue = next.join('').slice(0, LENGTH);
    onChange(nextValue);
    if (nextValue.length === LENGTH) {
      onComplete(nextValue);
    }
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setDigitAt(index, digit);
    if (digit && index < LENGTH - 1) {
      refs.current[index + 1]?.focus({ preventScroll: true });
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus({ preventScroll: true });
      setDigitAt(index - 1, '');
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    onChange(pasted);
    if (pasted.length === LENGTH) {
      onComplete(pasted);
    } else {
      refs.current[pasted.length]?.focus({ preventScroll: true });
    }
  }

  return (
    <div className={b({ invalid: !!error })}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { refs.current[index] = el; }}
          className={e('cell', { filled: !!digit })}
          inputMode="numeric"
          maxLength={1}
          placeholder="_"
          value={digit}
          disabled={disabled}
          onChange={(ev) => handleChange(index, ev.target.value)}
          onKeyDown={(ev) => handleKeyDown(index, ev)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
