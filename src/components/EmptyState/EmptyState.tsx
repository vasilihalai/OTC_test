import { bem } from '@/css/bem.ts';

import './EmptyState.css';

const [b, e] = bem('empty-state');

/** The silver folder of the "Нет данных" frame. */
function FolderIcon() {
  return (
    <svg width="52" height="46" viewBox="0 0 52 46" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="empty-state-back" x1="26" y1="1" x2="26" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4F5F6"/>
          <stop offset="1" stopColor="#9EA1A7"/>
        </linearGradient>
        <linearGradient id="empty-state-front" x1="26" y1="9" x2="26" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E6E7E9"/>
          <stop offset="0.45" stopColor="#A4A7AC"/>
          <stop offset="0.8" stopColor="#6E7176"/>
          <stop offset="1" stopColor="#9A9DA3"/>
        </linearGradient>
      </defs>
      <path d="M1 5a4 4 0 0 1 4-4h11.3a4 4 0 0 1 2.9 1.2l2.6 2.6A4 4 0 0 0 24.7 6H47a4 4 0 0 1 4 4v8H1V5z" fill="url(#empty-state-back)"/>
      <rect x="1" y="9" width="50" height="36" rx="4" fill="url(#empty-state-front)"/>
      <rect x="1.5" y="9.5" width="49" height="35" rx="3.5" stroke="#FFFFFF" strokeOpacity="0.6"/>
      <path d="M4 43.8h44" stroke="#A9C7E8" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export interface EmptyStateProps {
  caption: string;
}

export function EmptyState({ caption }: EmptyStateProps) {
  return (
    <div className={b()}>
      <FolderIcon/>
      <p className={e('caption')}>{caption}</p>
    </div>
  );
}
