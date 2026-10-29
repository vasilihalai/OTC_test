import { useEffect, useRef } from 'react';

import { bem } from '@/css/bem.ts';
import { isRealTelegram } from '@/telegram/environment.ts';
import { ru } from '@/i18n/ru.ts';

import './AppHeader.css';

const [b, e] = bem('app-header');

const FORCE_IN_APP = import.meta.env.VITE_FORCE_INAPP_HEADER === 'true';

// How far below the pill's own bottom edge content should start.
const CONTENT_GAP = 2;
// Falls back to this when there's no header to measure (variant "none").
const DEFAULT_CLEARANCE = 48;

/**
 * Ties `.app-content`'s top clearance to the pill's actual rendered height
 * instead of a formula guessed from the safe-area CSS vars — those vars'
 * real composition has proven inconsistent across devices/Telegram
 * versions, so a computed guess kept over- or under-shooting the real gap.
 * Measuring live is correct by construction on every device.
 */
function useHeaderClearance(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) {
      if (isRealTelegram) {
        // No pill of ours inside Telegram: outside fullscreen its own header
        // sits above the webview, so there's nothing to clear; in fullscreen
        // its controls float over the content. index.css picks between the
        // two off `body.is-fullscreen` and reads Telegram's safe-area vars
        // live — this effect runs once, so it must not bake a value in (that
        // used to snapshot insets Telegram hadn't reported yet).
        document.documentElement.style.removeProperty('--header-clearance');
        return;
      }
      document.documentElement.style.setProperty('--header-clearance', `${DEFAULT_CLEARANCE}px`);
      return;
    }

    function measure() {
      if (el) {
        document.documentElement.style.setProperty('--header-clearance', `${Math.ceil(el.getBoundingClientRect().height) + CONTENT_GAP}px`);
      }
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  return ref;
}

function ChevronIcon() {
  return (
    <svg width="11" height="18" viewBox="0 0 11 18" fill="none">
      <path d="M9.5 1.5L1.5 9L9.5 16.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export interface AppHeaderProps {
  variant: 'close' | 'back' | 'home' | 'none';
  onBack: () => void;
}

export function AppHeader({ variant, onBack }: AppHeaderProps) {
  const rendersOwnHeader = variant !== 'none' && !(isRealTelegram && !FORCE_IN_APP);
  const ref = useHeaderClearance(rendersOwnHeader);

  if (!rendersOwnHeader) {
    return null;
  }

  if (variant === 'home') {
    return (
      <div className={b()} ref={ref}>
        <span className={e('brand')}>
          <span className={e('mark')} aria-hidden="true"/>
          XRuby
        </span>
      </div>
    );
  }

  return (
    <div className={b()} ref={ref}>
      <button type="button" className={e('pill')} onClick={onBack}>
        {variant === 'close' ? <CloseIcon/> : <ChevronIcon/>}
        {variant === 'close' ? ru.header.close : ru.header.back}
      </button>
    </div>
  );
}
