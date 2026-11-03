import type { ReactNode } from 'react';

import { bem } from '@/css/bem.ts';

import './StatusHero.css';

const [b, e] = bem('status-hero');

export type StatusHeroIcon = 'spinner' | 'check' | 'cross' | 'hourglass';
export type StatusHeroTone = 'success' | 'danger' | 'running' | 'stale' | 'pending';

function SpinnerIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={e('spin')} aria-hidden="true">
      <path d="M24 6a18 18 0 1 0 18 18" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

/** The silver coin behind the terminal-state glyphs, as in the OTC detail frames. */
function Medallion({ id, glyph }: { id: string; glyph: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rim`} x1="8" y1="5" x2="40" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FBFBFC"/>
          <stop offset="0.38" stopColor="#B4B6BA"/>
          <stop offset="0.62" stopColor="#85878C"/>
          <stop offset="1" stopColor="#E9EAEC"/>
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="12" y1="10" x2="37" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A2A4A8"/>
          <stop offset="0.5" stopColor="#D2D3D6"/>
          <stop offset="0.72" stopColor="#F6F6F7"/>
          <stop offset="1" stopColor="#B2B4B8"/>
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${id}-rim)`}/>
      <circle cx="24" cy="24" r="18" fill={`url(#${id}-face)`} stroke="#5D5F64" strokeOpacity="0.75"/>
      <circle cx="24" cy="24" r="19.25" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="0.75"/>
      <path d={glyph} transform="translate(0 0.75)" stroke="#55575C" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={glyph} stroke="#FFFFFF" strokeWidth="3.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckIcon() {
  return <Medallion id="status-hero-check" glyph="M16 24.5l5.5 5.5L32.5 18.5"/>;
}

function CrossIcon() {
  return <Medallion id="status-hero-cross" glyph="M17.5 17.5l13 13M30.5 17.5l-13 13"/>;
}

/** The chrome hourglass of the "Курс неактуален" frame. */
function HourglassIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="status-hero-glass" x1="10" y1="0" x2="38" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F2F3F4"/>
          <stop offset="0.16" stopColor="#74767B"/>
          <stop offset="0.4" stopColor="#DADBDE"/>
          <stop offset="0.58" stopColor="#FFFFFF"/>
          <stop offset="0.82" stopColor="#6E7075"/>
          <stop offset="1" stopColor="#E4E5E7"/>
        </linearGradient>
        <linearGradient id="status-hero-cap" x1="7" y1="0" x2="41" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8D8F94"/>
          <stop offset="0.3" stopColor="#FFFFFF"/>
          <stop offset="0.68" stopColor="#B7B9BD"/>
          <stop offset="1" stopColor="#6F7176"/>
        </linearGradient>
      </defs>
      <path
        d="M12 6h24c0 8-3 12.4-7.4 15.6-1.8 1.3-1.8 3.5 0 4.8C33 29.6 36 34 36 42H12c0-8 3-12.4 7.4-15.6 1.8-1.3 1.8-3.5 0-4.8C15 18.4 12 14 12 6z"
        fill="url(#status-hero-glass)"
        stroke="#4F5156"
        strokeOpacity="0.6"
        strokeWidth="0.75"
      />
      <path d="M17 9.5h14c-.7 4.5-3 7.3-5.3 9.3-.7.6-1.1 1-1.7 1s-1-.4-1.7-1C20 16.8 17.7 14 17 9.5z" fill="#3B3D42" fillOpacity="0.55"/>
      <path d="M24 29c3.3 1.7 6.2 5.2 6.9 9.5H17.1c.7-4.3 3.6-7.8 6.9-9.5z" fill="#3B3D42" fillOpacity="0.55"/>
      <path d="M19.5 9.5c.4 3 1.5 5.2 3 6.9" stroke="#FFFFFF" strokeOpacity="0.85" strokeLinecap="round"/>
      <path d="M19.8 37c.6-2 1.7-3.6 3-5" stroke="#FFFFFF" strokeOpacity="0.85" strokeLinecap="round"/>
      <rect x="9" y="3" width="30" height="4" rx="2" fill="url(#status-hero-cap)" stroke="#55575C" strokeOpacity="0.5" strokeWidth="0.5"/>
      <rect x="9" y="41" width="30" height="4" rx="2" fill="url(#status-hero-cap)" stroke="#55575C" strokeOpacity="0.5" strokeWidth="0.5"/>
    </svg>
  );
}

const ICONS: Record<StatusHeroIcon, () => ReactNode> = {
  spinner: SpinnerIcon,
  check: CheckIcon,
  cross: CrossIcon,
  hourglass: HourglassIcon,
};

export interface StatusHeroProps {
  icon: StatusHeroIcon;
  tone: StatusHeroTone;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function StatusHero({ icon, tone, title, subtitle, action }: StatusHeroProps) {
  const Icon = ICONS[icon];
  return (
    <div className={b(tone)}>
      <Icon/>
      <h3 className={e('title')}>{title}</h3>
      {subtitle && <p className={e('subtitle')}>{subtitle}</p>}
      {action && <div className={e('action')}>{action}</div>}
    </div>
  );
}
