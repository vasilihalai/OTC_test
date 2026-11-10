import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';

import './FieldSkeleton.css';

/** A form field whose choices are still loading: its label is already there, its box is a bar of the box's size. */
export function FieldSkeleton({ label }: { label: string }) {
  return (
    <div className="field-skeleton">
      <span className="field-skeleton__label">{label}</span>
      <Skeleton height={44} radius={12}/>
    </div>
  );
}
