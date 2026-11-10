import type { ReactNode } from 'react';

import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { bem } from '@/css/bem.ts';

import './KeyValueRow.css';

const [b, e] = bem('key-value-row');

export interface KeyValueRowProps {
  label: string;
  value?: ReactNode;
  /** The value isn't known yet: a placeholder bar in its place. */
  loading?: boolean;
  onClick?: () => void;
}

export function KeyValueRow({ label, value, loading, onClick }: KeyValueRowProps) {
  const clickable = !!onClick;

  return (
    <div
      className={b({ clickable })}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <span className={e('label')}>{label}</span>
      {loading ? <Skeleton width={96} height={12} line={20} radius={6}/> : <span className={e('value')}>{value}</span>}
    </div>
  );
}
