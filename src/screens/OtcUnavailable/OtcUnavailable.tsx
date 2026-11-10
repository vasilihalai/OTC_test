import { useLocation, useNavigate } from 'react-router-dom';

import { BlockingState } from '@/components/BlockingState/BlockingState.tsx';
import { BrandLoader } from '@/components/BrandLoader/BrandLoader.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { LoadError } from '@/components/LoadError/LoadError.tsx';
import type { OtcAccessReason } from '@/api/index.ts';
import { useSessionStore } from '@/store/session.ts';
import { useUser } from '@/lib/queries.ts';
import { ru } from '@/i18n/ru.ts';

export function OtcUnavailable() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  // The gate that redirected here already knows the reason — carrying it via
  // location.state avoids losing a `?otc=` dev override once the URL has
  // changed to this screen. The user's own reason is the fallback.
  const locationReason = (useLocation().state as { otcAccess?: OtcAccessReason } | null)?.otcAccess;
  // The gate that sent the client here has just read this very user, so it is normally there at once.
  const { data: user, failed, refetch } = useUser(session?.clientType);

  if (!user) {
    return failed
      ? <div className="page-error"><LoadError message={ru.common.errorGeneric} onRetry={() => void refetch()}/></div>
      : <BrandLoader/>;
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
    />
  );
}
