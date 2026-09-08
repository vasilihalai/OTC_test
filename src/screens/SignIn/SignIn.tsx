import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { TextField } from '@/components/TextField/TextField.tsx';
import { PasswordField } from '@/components/PasswordField/PasswordField.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { Logo } from '@/components/Logo/Logo.tsx';
import { OtpConfirmModal } from '@/screens/OtpConfirmModal/OtpConfirmModal.tsx';
import {
  ApiError,
  MockSignInError,
  MockVerifyCodeError,
  USE_REAL_API,
  mapApiError,
  signInConfirmOtp,
  signInRequestOtp,
  signInSocial,
  startSocialSignIn,
} from '@/api/index.ts';
import type { AuthOtpSource, ClientType } from '@/api/index.ts';
import { useSessionStore } from '@/store/session.ts';
import { useModalStore } from '@/store/modal.ts';
import { notifyError } from '@/telegram/adapter.ts';
import { AppleIcon, GoogleIcon } from '@/components/SocialIcons/SocialIcons.tsx';
import { BuildingIcon, PersonIcon } from '@/screens/SignIn/icons.tsx';
import { ru } from '@/i18n/ru.ts';

import './SignIn.css';

export interface SignInProps {
  variant: 'personal' | 'business';
}

// Temporarily disabled — no real API contract for Google/Apple sign-in yet
// (question B3: "стенд вход через соцсети для миниаппки лучше отключить").
// Flip back to true once that's implemented; nothing else needs to change.
const SOCIAL_AUTH_ENABLED = false;

const CLIENT_TYPE: Record<SignInProps['variant'], ClientType> = {
  personal: 'FL',
  business: 'UL',
};

export function SignIn({ variant }: SignInProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useSessionStore((s) => s.setSession);
  const modalOpen = useModalStore((s) => s.isVerificationModalOpen);
  const openModal = useModalStore((s) => s.openVerificationModal);
  const closeModal = useModalStore((s) => s.closeVerificationModal);

  const prefill = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(prefill);
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple'>();
  const [otpState, setOtpState] = useState<{ transactionId: string; source: AuthOtpSource }>();

  const clientType = CLIENT_TYPE[variant];
  const canSubmit = email.trim().length > 0 && password.trim().length > 0;

  // api-integration.md §2.1 — one shape for both modes now: issue OTP,
  // `source` in that response picks which single code field OtpConfirmModal
  // shows (an account has exactly one second factor, never both), confirm
  // exchanges that code for a session.
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) {
      return;
    }
    setEmailError(undefined);
    setLoading(true);
    try {
      const tx = await signInRequestOtp(email, password, clientType);
      setOtpState(tx);
      openModal();
    } catch (err) {
      if (err instanceof MockSignInError) {
        setEmailError(ru.signIn.errorEmailInvalid);
      } else if (err instanceof ApiError) {
        setEmailError(mapApiError(err));
      }
      notifyError();
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(params: { transactionId: string; otp: string }) {
    try {
      const session = await signInConfirmOtp({ ...params, email, clientType });
      setSession(session);
    } catch (err) {
      if (err instanceof MockVerifyCodeError) {
        throw new Error(err.code === 'RATE_LIMIT' ? ru.verification.errorRateLimit : ru.verification.errorCodeInvalid);
      }
      if (err instanceof ApiError) {
        throw new Error(mapApiError(err));
      }
      throw err;
    }
  }

  async function handleOtpResend() {
    try {
      return await signInRequestOtp(email, password, clientType);
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(mapApiError(err));
      }
      throw err;
    }
  }

  function handleOtpVerified() {
    closeModal();
    navigate('/home', { replace: true });
  }

  async function handleSocial(provider: 'google' | 'apple') {
    setSocialLoading(provider);
    try {
      if (USE_REAL_API) {
        // Opens an external browser; completion (if the redirect back into
        // the mini app is captured at all) happens on relaunch — §2.2,
        // best-effort for MVP, question B3.
        await startSocialSignIn(provider, clientType);
      } else {
        const session = await signInSocial(provider, clientType);
        setSession(session);
        navigate('/home', { replace: true });
      }
    } finally {
      setSocialLoading(undefined);
    }
  }

  return (
    <>
      <form className="sign-in" onSubmit={(e) => void handleSubmit(e)}>
        <Logo/>
        <h1 className="sign-in__title">
          {variant === 'personal' ? ru.signIn.titlePersonal : ru.signIn.titleBusiness}
        </h1>

        <TextField
          label={ru.signIn.emailLabel}
          placeholder={ru.signIn.emailPlaceholder}
          type="email"
          inputMode="email"
          value={email}
          error={emailError}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label={ru.signIn.passwordLabel}
          placeholder={ru.signIn.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="button"
          className="sign-in__forgot"
          onClick={() => navigate('/forgot', { state: { email, clientType } })}
        >
          {ru.signIn.forgotPassword}
        </button>

        <Button type="submit" disabled={!canSubmit} loading={loading}>
          {ru.signIn.submitAction}
        </Button>

        {SOCIAL_AUTH_ENABLED && (
          <div className="sign-in__social">
            <Button
              type="button"
              variant="secondary"
              icon={<GoogleIcon/>}
              loading={socialLoading === 'google'}
              disabled={!!socialLoading}
              onClick={() => void handleSocial('google')}
            >
              {ru.signIn.googleAction}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<AppleIcon/>}
              loading={socialLoading === 'apple'}
              disabled={!!socialLoading}
              onClick={() => void handleSocial('apple')}
            >
              {ru.signIn.appleAction}
            </Button>
          </div>
        )}

        {variant === 'business' ? (
          <Button
            type="button"
            variant="footer-link"
            className="sign-in__switch-link"
            icon={<PersonIcon/>}
            onClick={() => navigate('/login/personal', { replace: true })}
          >
            {ru.signIn.personalAccountLink}
          </Button>
        ) : (
          <Button
            type="button"
            variant="footer-link"
            className="sign-in__switch-link"
            icon={<BuildingIcon/>}
            onClick={() => navigate('/login', { replace: true })}
          >
            {ru.signIn.businessAccountLink}
          </Button>
        )}
      </form>

      {otpState && (
        <OtpConfirmModal
          open={modalOpen}
          email={email}
          transactionId={otpState.transactionId}
          source={otpState.source}
          onClose={closeModal}
          onSubmit={handleOtpSubmit}
          onResend={handleOtpResend}
          onVerified={handleOtpVerified}
        />
      )}
    </>
  );
}
