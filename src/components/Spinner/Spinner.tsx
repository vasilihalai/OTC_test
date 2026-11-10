import { classNames } from '@/css/classnames.ts';

import './Spinner.css';

export interface SpinnerProps {
  size?: number;
  className?: string;
}

/** A faint ring with an arc running round it, in the colour of the text it sits in. */
export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <svg
      className={classNames('spinner', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="spinner__track" cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5"/>
      <circle
        className="spinner__arc"
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="30 70"
      />
    </svg>
  );
}
