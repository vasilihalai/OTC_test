import { useEffect } from 'react';

import { useToastStore } from '@/store/toast.ts';

import './Toast.css';

const AUTO_HIDE_MS = 2000;
const NOTICE_AUTO_HIDE_MS = 4000;

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
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(hide, tone === 'notice' ? NOTICE_AUTO_HIDE_MS : AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [message, tone, hide]);

  if (!message) {
    return null;
  }

  return (
    <div className="toast" role="status">
      {tone === 'notice' && <NoticeIcon/>}
      {message}
    </div>
  );
}
