import type { ReactNode } from 'react';

import { bem } from '@/css/bem.ts';

import './SettingRow.css';

const [b, e] = bem('setting-row');

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 6l4.5 4.5L12.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export interface SettingRowProps {
  icon: ReactNode;
  label: string;
  value?: string;
  danger?: boolean;
  onClick?: () => void;
}

export function SettingRow({ icon, label, value, danger, onClick }: SettingRowProps) {
  return (
    <button type="button" className={b({ danger: !!danger })} onClick={onClick}>
      <span className={e('icon')}>{icon}</span>
      <span className={e('label')}>{label}</span>
      {value && (
        <span className={e('value-group')}>
          <span className={e('value')}>{value}</span>
          <ChevronIcon/>
        </span>
      )}
    </button>
  );
}
