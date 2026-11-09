import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { BlockingState } from '@/components/BlockingState/BlockingState.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import { getUser } from '@/api/index.ts';
import type { OtcAccessReason, User } from '@/api/index.ts';
import { useSessionStore } from '@/store/session.ts';
import { useUiStore } from '@/store/ui.ts';
import { ru } from '@/i18n/ru.ts';

export function OtcUnavailable() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  // The gate that redirected here already knows the reason — carrying it via
  // location.state avoids losing a `?otc=` dev override once the URL has
  // changed to this screen. The user's own reason is the fallback.
  const locationReason = (useLocation().state as { otcAccess?: OtcAccessReason } | null)?.otcAccess;
  const [user, setUser] = useState<User>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Bumped when the verification level changes while this screen is open (BRCE-4023 §8).
  const userVersion = useUiStore((s) => s.userVersion);
  const [initialUserVersion] = useState(userVersion);
  const rechecked = userVersion !== initialUserVersion;

  useEffect(() => {
    if (session) {
      setFailed(false);
      void getUser(session.clientType).then(setUser).catch((err: unknown) => {
        console.error('[OtcUnavailable] user load failed', err);
        setFailed(true);
      });
    }
  }, [session, attempt, userVersion]);

  // Verification passed while the client waited here: OTC opens without a restart.
  useEffect(() => {
    if (rechecked && user?.otcAccess === 'GRANTED') {
      navigate('/home', { replace: true });
    }
  }, [rechecked, user, navigate]);

  if (!user) {
    return failed
      ? <div className="page-error"><LoadError message={ru.common.errorGeneric} onRetry={() => setAttempt((n) => n + 1)}/></div>
      : <div className="page-loader"><Spinner size={28}/></div>;
  }

  const reason = rechecked ? user.otcAccess : locationReason ?? user.otcAccess;

  // `DESK_CLOSED` (api-integration.md §7.1, question B9) has nothing
  // external to link to — there's no "come back later" URL, so its action
  // just returns to the one screen that doesn't require OTC access.
  if (reason === 'DESK_CLOSED') {
    return (
      <BlockingState
        logo={<span style={{ color: 'var(--brand-mark)', fontWeight: 700, fontSize: 20 }}>xRuby</span>}
        title={ru.otcUnavailable.deskClosedTitle}
        body={ru.otcUnavailable.deskClosedBody}
        action={<Button variant="accent" onClick={() => navigate('/home', { replace: true })}>{ru.otcUnavailable.deskClosedAction}</Button>}
      />
    );
  }

  const isVerification = reason === 'VERIFICATION_REQUIRED';

  return (
    <BlockingState
      logo={<span style={{ color: 'var(--brand-mark)', fontWeight: 700, fontSize: 20 }}>xRuby</span>}
      title={isVerification ? ru.otcUnavailable.verificationTitle : ru.otcUnavailable.notEligibleTitle}
      body={isVerification ? ru.otcUnavailable.verificationBody : ru.otcUnavailable.notEligibleBody}
    />
  );
}
