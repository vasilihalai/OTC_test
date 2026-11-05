import type { ReactNode } from 'react';

import { bem } from '@/css/bem.ts';

import './BlockingState.css';

const [b, e] = bem('blocking-state');

function ShieldIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="40" fill="var(--status-awaiting-funds-fill)"/>
      <path
        d="M40 20l14.5 5.5v10c0 11-6.5 18-14.5 22.5-8-4.5-14.5-11.5-14.5-22.5v-10L40 20Z"
        stroke="var(--status-awaiting-funds-text)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M34.5 40l4 4L46 34.5" stroke="var(--status-awaiting-funds-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export interface BlockingStateProps {
  logo: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  caption?: string;
}

export function BlockingState({ logo, title, body, action, caption }: BlockingStateProps) {
  return (
    <div className={b()}>
      <div className={e('logo')}>{logo}</div>
      <div className={e('content')}>
        <ShieldIcon/>
        <h1 className={e('title')}>{title}</h1>
        <p className={e('body')}>{body}</p>
        {action && <div className={e('action')}>{action}</div>}
        {caption && <p className={e('caption')}>{caption}</p>}
      </div>
    </div>
  );
}
