import { useId } from 'react';

import { bem } from '@/css/bem.ts';
import { hapticSelection } from '@/telegram/adapter.ts';

import './Checkbox.css';

const [b, e] = bem('checkbox');

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function Checkbox({ checked, onChange, label, description }: CheckboxProps) {
  const id = useId();

  return (
    <label className={b()} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className={e('input')}
        checked={checked}
        onChange={(ev) => {
          hapticSelection();
          onChange(ev.target.checked);
        }}
      />
      <span className={e('box', { checked })} aria-hidden="true">
        {/* Always there, so the tick can be drawn in and wiped out instead of popping. */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path className={e('tick')} pathLength="1" d="M2 6l2.5 2.5L10 3" stroke="var(--text-on-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className={e('text')}>
        <span className={e('label')}>{label}</span>
        {description && <span className={e('description')}>{description}</span>}
      </span>
    </label>
  );
}
