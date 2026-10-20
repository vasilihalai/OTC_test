import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { BlockingState } from '@/components/BlockingState/BlockingState.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { getUser } from '@/api/index.ts';
import type { OtcAccessReason, User } from '@/api/index.ts';
import { useSessionStore } from '@/store/session.ts';
import { openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

export function OtcUnavailable() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  // The gate that redirected here already knows the reason — carrying it via
  // location.state avoids losing a `?otc=` dev override once the URL has
  // changed to this screen. Still fetches the user for the action's URLs.
  const locationReason = (useLocation().state as { otcAccess?: OtcAccessReason } | null)?.otcAccess;
  const [user, setUser] = useState<User>();

  useEffect(() => {
    if (session) {
      void getUser(session.clientType).then(setUser).catch((err: unknown) => {
        console.error('[OtcUnavailable] user load failed', err);
      });
    }
  }, [session]);

  if (!user) {
    return null;
  }

  const reason = locationReason ?? user.otcAccess;

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
      caption={isVerification ? ru.otcUnavailable.verificationCaption : undefined}
      action={(
        <Button
          variant="accent"
          onClick={() => openExternalLink(isVerification ? user.webCabinetUrl : user.supportUrl)}
        >
          {isVerification ? ru.otcUnavailable.verificationAction : ru.otcUnavailable.notEligibleAction}
        </Button>
      )}
    />
  );
}
