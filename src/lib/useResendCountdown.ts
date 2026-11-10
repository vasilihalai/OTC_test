import { useCallback, useEffect, useState } from 'react';

/** How long a new code can't be asked for after the previous one was sent. */
export const RESEND_SECONDS = 59;

/**
 * The seconds left until "Отправить ещё раз" unlocks, shared by the code modals. Counts only while
 * `active` (the modal is open and the code came by email); `restart` begins a new wait.
 */
export function useResendCountdown(active: boolean): { secondsLeft: number; restart: () => void } {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const ticking = active && secondsLeft > 0;

  useEffect(() => {
    if (!ticking) {
      return;
    }
    const timer = setInterval(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  const restart = useCallback(() => setSecondsLeft(RESEND_SECONDS), []);
  return { secondsLeft, restart };
}
