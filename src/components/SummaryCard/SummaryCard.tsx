import type { ReactNode } from 'react';

import { bem } from '@/css/bem.ts';
import { classNames } from '@/css/classnames.ts';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';

import './SummaryCard.css';

const [b, e] = bem('summary-card');

export interface SummaryRow {
  key: string;
  label: string;
  value: ReactNode;
}

export interface SummaryCardProps {
  rows: SummaryRow[];
  totalLabel: string;
  totalValue: ReactNode;
  caption?: string;
  className?: string;
}

export function SummaryCard({ rows, totalLabel, totalValue, caption, className }: SummaryCardProps) {
  return (
    <div className={classNames(b(), className)}>
      {rows.map((row) => (
        <div key={row.key} className={e('row')}>
          <span className={e('label')}>{row.label}</span>
          <span className={e('value')}>{row.value}</span>
        </div>
      ))}
      <div className={e('row', 'total')}>
        <span className={e('label', 'total')}>{totalLabel}</span>
        <span className={e('value', 'total')}>{totalValue}</span>
      </div>
      {caption && <p className={e('caption')}>{caption}</p>}
    </div>
  );
}

/** The card's own rows, their labels already in place and bars for the figures. */
export function SummaryCardSkeleton({ labels, totalLabel }: { labels: string[]; totalLabel: string }) {
  return (
    <div className={b()}>
      {labels.map((label, index) => (
        <div key={label} className={e('row')}>
          <span className={e('label')}>{label}</span>
          <Skeleton width={index % 2 ? 84 : 108} height={12} line={20} radius={6}/>
        </div>
      ))}
      <div className={e('row', 'total')}>
        <span className={e('label', 'total')}>{totalLabel}</span>
        <Skeleton width={118} height={14} line={24} radius={6}/>
      </div>
    </div>
  );
}
