import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

import { HintTooltip } from '@/components/HintTooltip/HintTooltip.tsx';
import { bem } from '@/css/bem.ts';
import { classNames } from '@/css/classnames.ts';

import './TextField.css';

const [b, e] = bem('text-field');

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  /** Rendered inline inside the input box, right-aligned (e.g. a "Макс" button). */
  suffix?: ReactNode;
  /** The "?" next to the label. */
  hint?: string;
}

export function TextField({ label, error, suffix, hint, className, ...rest }: TextFieldProps) {
  const id = useId();

  return (
    <div className={classNames(b({ invalid: !!error }), className)}>
      <span className={e('label-row')}>
        <label className={e('label')} htmlFor={id}>
          {label}
        </label>
        {hint && <HintTooltip text={hint} label={label}/>}
      </span>
      {suffix ? (
        <div className={e('box')}>
          <input id={id} className={e('input')} autoComplete="off" {...rest} />
          <div className={e('suffix')}>{suffix}</div>
        </div>
      ) : (
        <input id={id} className={e('input')} autoComplete="off" {...rest} />
      )}
      {error && <span className={e('error')}>{error}</span>}
    </div>
  );
}
