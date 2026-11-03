import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { bem } from '@/css/bem.ts';
import { FeeBadge } from '@/components/FeeBadge/FeeBadge.tsx';

import './Select.css';

const [b, e] = bem('select');

export type SelectLayout = 'asset' | 'method' | 'plain';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** `asset` layout: full name on the right. `method` layout: fee text, e.g. `1.0%`. */
  secondary?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Stands for "nothing chosen yet": dimmed in the closed box. */
  placeholder?: boolean;
}

export interface SelectProps<T extends string> {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layout?: SelectLayout;
  /** Shown instead of the box when `options` is empty. */
  emptyState?: ReactNode;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="8"
      viewBox="0 0 12 8"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0, transition: 'transform 0.15s ease' }}
    >
      <path d="M1 1.5L6 6.5L11 1.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Row<T extends string>({ option, layout }: { option: SelectOption<T>; layout: SelectLayout }) {
  if (layout === 'asset') {
    return (
      <span className={e('row', 'asset')}>
        <span className={e('row-left')}>
          {option.icon}
          <span className={e('row-ticker')}>{option.label}</span>
        </span>
        {option.secondary && <span className={e('row-secondary')}>{option.secondary}</span>}
      </span>
    );
  }
  if (layout === 'method') {
    return (
      <span className={e('row', 'method')}>
        <span className={e('row-left')}>
          {option.icon}
          <span className={e('row-name')}>{option.label}</span>
          {option.secondary && <FeeBadge>{option.secondary}</FeeBadge>}
        </span>
      </span>
    );
  }
  return <span className={e('row-plain', { placeholder: !!option.placeholder })}>{option.label}</span>;
}

export function Select<T extends string>({ label, options, value, onChange, layout = 'plain', emptyState }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const readOnly = options.length <= 1;

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(ev: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={b()} ref={rootRef}>
      <span className={e('label')}>{label}</span>
      {options.length === 0 && emptyState ? (
        emptyState
      ) : (
        <div className={e('wrap')}>
          <button
            type="button"
            className={e('box', { readonly: readOnly, open })}
            disabled={readOnly}
            onClick={() => setOpen((v) => !v)}
          >
            {selected ? <Row option={selected} layout={layout}/> : <span className={e('row-plain')}>—</span>}
            {!readOnly && <ChevronIcon open={open}/>}
          </button>

          {open && !readOnly && (
            <div className={e('dropdown')}>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={e('option', { disabled: !!option.disabled })}
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Row option={{ ...option, placeholder: false }} layout={layout}/>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
