import { useEffect, useRef } from 'react';

import { useToastStore } from '@/store/toast.ts';
import { useDelayedUnmount } from '@/lib/useDelayedUnmount.ts';

import './Toast.css';

const AUTO_HIDE_MS = 2000;
const NOTICE_AUTO_HIDE_MS = 4000;
/** Keep in sync with `toast-out` in Toast.css. */
const EXIT_MS = 180;

function NoticeIcon() {
  return (
    <span className="toast__icon" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#93370D"/>
        <circle cx="12" cy="12" r="7" stroke="#F38744" strokeWidth="1.3"/>
        <path d="M12 8.5v4" stroke="#F38744" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="15.3" r="0.9" fill="#F38744"/>
      </svg>
    </span>
  );
}

export function Toast() {
  const message = useToastStore((s) => s.message);
  const tone = useToastStore((s) => s.tone);
  const shown = useToastStore((s) => s.shown);
  const hide = useToastStore((s) => s.hide);
  const rendered = useDelayedUnmount(!!message, EXIT_MS);
  // What to keep drawing while the toast leaves: by then the store has already dropped the text.
  const last = useRef({ message, tone });
  if (message) {
    last.current = { message, tone };
  }

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(hide, tone === 'notice' ? NOTICE_AUTO_HIDE_MS : AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [message, tone, shown, hide]);

  if (!rendered) {
    return null;
  }

  return (
    // Keyed by the show count: a toast that replaces another one arrives anew instead of swapping text.
    <div key={shown} className={message ? 'toast' : 'toast toast--leaving'} role="status" onClick={hide}>
      {last.current.tone === 'notice' && <NoticeIcon/>}
      {last.current.message}
    </div>
  );
}
