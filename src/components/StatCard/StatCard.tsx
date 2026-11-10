import { bem } from '@/css/bem.ts';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';

import './StatCard.css';

const [b, e] = bem('stat-card');

export interface StatCardProps {
  value: string;
  unit?: string;
  label: string;
}

export function StatCard({ value, unit, label }: StatCardProps) {
  return (
    <div className={b()}>
      <div className={e('value')}>
        {value}
        {unit && <span className={e('unit')}> {unit}</span>}
      </div>
      <div className={e('label')}>{label}</div>
    </div>
  );
}

/** The label is known before the number is, so it is already there; only the number waits. */
export function StatCardSkeleton({ label }: { label: string }) {
  return (
    <div className={b()}>
      <div className={e('value', 'loading')} aria-hidden="true">
        <Skeleton width="58%" height={20} line={32} radius={7}/>
      </div>
      <div className={e('label')}>{label}</div>
    </div>
  );
}
