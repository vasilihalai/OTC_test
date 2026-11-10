import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/Button/Button.tsx';
import { CopyButton } from '@/components/CopyButton/CopyButton.tsx';
import { SettingRow } from '@/components/SettingRow/SettingRow.tsx';
import { PickerModal } from '@/components/PickerModal/PickerModal.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { ApiError, USE_REAL_API, openAccountCertificate } from '@/api/index.ts';
import { useRequireSession, useSessionStore } from '@/store/session.ts';
import { useSettingsStore } from '@/store/settings.ts';
import { useToastStore } from '@/store/toast.ts';
import { useUser } from '@/lib/queries.ts';
import { groupOf4 } from '@/lib/text.ts';
import { maskEmail } from '@/lib/mask.ts';
import { SAMPLE_DOCUMENT_URL } from '@/lib/sampleDocument.ts';
import { notifyError, openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './Profile.css';

function VerifiedIcon() {
  return (
    <span className="profile__verified-icon" aria-hidden="true">
      <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
        <path
          d="M5.9935 7.13251L4.9115 6.06068C4.81917 5.96835 4.70483 5.92112 4.5685 5.91901C4.43217 5.9169 4.31228 5.96751 4.20883 6.07085C4.11228 6.16751 4.064 6.28462 4.064 6.42218C4.064 6.55973 4.11228 6.67685 4.20883 6.77351L5.57167 8.13635C5.69222 8.25679 5.83283 8.31701 5.9935 8.31701C6.15417 8.31701 6.29478 8.25679 6.41533 8.13635L9.17817 5.37351C9.27728 5.27429 9.32617 5.15823 9.32483 5.02535C9.32361 4.89246 9.27472 4.77429 9.17817 4.67085C9.07472 4.56751 8.95589 4.51412 8.82167 4.51068C8.68756 4.50723 8.56878 4.55723 8.46533 4.66068L5.9935 7.13251ZM4.3 12.544L3.37817 10.994L1.6345 10.6195C1.48494 10.5905 1.3655 10.5119 1.27617 10.3837C1.18683 10.2555 1.15117 10.1166 1.16917 9.96701L1.33967 8.17351L0.153833 6.81701C0.0512778 6.70768 0 6.57607 0 6.42218C0 6.26829 0.0512778 6.13668 0.153833 6.02735L1.33967 4.67085L1.16917 2.87735C1.15117 2.72779 1.18683 2.5889 1.27617 2.46068C1.3655 2.33246 1.48494 2.25385 1.6345 2.22485L3.37817 1.85035L4.3 0.300346C4.38033 0.16879 4.48972 0.0790673 4.62817 0.0311784C4.76661 -0.0167105 4.90722 -0.00943272 5.05 0.0530117L6.6935 0.747845L8.337 0.0530117C8.47978 -0.00943272 8.62039 -0.0167105 8.75883 0.0311784C8.89728 0.0790673 9.00667 0.16879 9.087 0.300346L10.0088 1.85035L11.7525 2.22485C11.9021 2.25385 12.0215 2.33246 12.1108 2.46068C12.2002 2.5889 12.2358 2.72779 12.2178 2.87735L12.0473 4.67085L13.2332 6.02735C13.3357 6.13668 13.387 6.26829 13.387 6.42218C13.387 6.57607 13.3357 6.70768 13.2332 6.81701L12.0473 8.17351L12.2178 9.96701C12.2358 10.1166 12.2002 10.2555 12.1108 10.3837C12.0215 10.5119 11.9021 10.5905 11.7525 10.6195L10.0088 10.994L9.087 12.544C9.00667 12.6756 8.89728 12.7653 8.75883 12.8132C8.62039 12.8611 8.47978 12.8538 8.337 12.7913L6.6935 12.0965L5.05 12.7913C4.90722 12.8538 4.76661 12.8611 4.62817 12.8132C4.48972 12.7653 4.38033 12.6756 4.3 12.544Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function GlobeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4"/>
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 12h18M4.3 7.5h15.4M4.3 16.5h15.4" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FaqIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a8.5 8.5 0 0 1 2.3 16.7c-.3.1-.5.2-.7.5l-1 1.3c-.3.4-.9.4-1.2 0l-1-1.3c-.2-.3-.4-.4-.7-.5A8.5 8.5 0 0 1 12 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M9.7 9.3a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.8-1.1 1.600" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="12" cy="15.8" r="0.9" fill="currentColor"/>
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="0.9" fill="currentColor"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M14 16l4-4-4-4M18 12H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const LANGUAGE_OPTIONS = [
  { value: 'ky' as const, label: ru.profile.languageKy },
  { value: 'ru' as const, label: ru.profile.languageRu },
  { value: 'en' as const, label: ru.profile.languageEn },
];

const THEME_OPTIONS = [
  { value: 'dark' as const, label: ru.profile.themeDark },
  { value: 'light' as const, label: ru.profile.themeLight },
];

/** A label with its value under it. `value` is `undefined` while the profile loads: the label is already there, the value is a bar. */
function DetailRow({ label, value, copyValue, placeholderWidth }: { label: string; value: string | undefined; copyValue?: string; placeholderWidth: number }) {
  return (
    <div className="profile__detail-row">
      <span className="profile__detail-label">{label}</span>
      {value === undefined ? (
        <Skeleton width={placeholderWidth} height={12} line={20} radius={6}/>
      ) : (
        <span className="profile__detail-value reveal">
          <span className="profile__detail-text">{value}</span>
          {copyValue && <CopyButton value={copyValue}/>}
        </span>
      )}
    </div>
  );
}

export function Profile() {
  const session = useRequireSession();
  const navigate = useNavigate();
  const clearSession = useSessionStore((s) => s.clearSession);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  // The profile last seen is shown at once and refreshed underneath.
  const { data: user, failed, refetch } = useUser(session?.clientType);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  function handleSignOut() {
    clearSession();
    navigate('/login', { replace: true });
  }

  const [certificateLoading, setCertificateLoading] = useState(false);

  // Mock mode just opens the bundled sample PDF. Real mode asks for a signed
  // link to the OTC account certificate (BRCE-4023 §7) and opens it.
  async function handleCertificate() {
    if (!USE_REAL_API) {
      openExternalLink(SAMPLE_DOCUMENT_URL);
      return;
    }
    if (certificateLoading) {
      return;
    }
    setCertificateLoading(true);
    try {
      await openAccountCertificate();
    } catch (err) {
      console.error('[Profile] certificate failed to open', err);
      notifyError();
      // 403: the client has no OTC access, so there is no OTC account to certify.
      const noAccess = err instanceof ApiError && err.httpStatus === 403;
      useToastStore.getState().show(noAccess ? ru.profile.certificateNoAccess : ru.common.errorGeneric);
    } finally {
      setCertificateLoading(false);
    }
  }

  // Everything that doesn't come from the server is on screen from the first frame — the settings, the
  // certificate button and sign-out, which must never depend on the profile loading. Only the name
  // and the three values wait, as bars in their own places.
  return (
    <div className="profile">
      <div className="profile__panel1">
        {failed ? (
          <div className="profile__error rise" role="alert">
            <p>{ru.profile.errorTitle}</p>
            <Button variant="secondary" onClick={() => void refetch()}>{ru.profile.retryAction}</Button>
          </div>
        ) : (
          <>
            {!user && (
              <div className="profile__title-row" aria-hidden="true">
                <Skeleton width={152} height={14} line={24} radius={6}/>
                <Skeleton width={124} height={24} radius={12}/>
              </div>
            )}
            {user && (user.clientName || user.verified) && (
              <div className="profile__title-row reveal">
                {user.clientName && <h1 className="profile__name">{user.clientName}</h1>}
                {user.verified && (
                  <span className="profile__verified-badge">
                    <VerifiedIcon/>
                    {ru.profile.verifiedBadge}
                  </span>
                )}
              </div>
            )}

            <div className="profile__details-card">
              <DetailRow label={ru.profile.emailRow} value={user && maskEmail(user.email)} copyValue={user?.email} placeholderWidth={156}/>
              <DetailRow label={ru.profile.userIdRow} value={user && groupOf4(user.userId)} copyValue={user?.userId} placeholderWidth={232}/>
              <DetailRow label={ru.profile.phoneRow} value={user?.phone} placeholderWidth={128}/>
            </div>

            <Button variant="secondary" size="compact" loading={certificateLoading} onClick={() => void handleCertificate()}>
              {ru.profile.certificateAction}
            </Button>
          </>
        )}
      </div>

      <div className="profile__panel2">
        <SettingRow
          icon={<GlobeIcon/>}
          label={ru.profile.languageRow}
          value={LANGUAGE_OPTIONS.find((o) => o.value === language)?.label}
          onClick={() => setLanguageModalOpen(true)}
        />
        <SettingRow
          icon={<ThemeIcon/>}
          label={ru.profile.themeRow}
          value={THEME_OPTIONS.find((o) => o.value === theme)?.label}
          onClick={() => setThemeModalOpen(true)}
        />
        <div className="profile__divider"/>
        <SettingRow icon={<FaqIcon/>} label={ru.profile.faqRow} onClick={() => user && openExternalLink(user.faqUrl)}/>
        <SettingRow icon={<AboutIcon/>} label={ru.profile.aboutRow} onClick={() => user && openExternalLink(user.aboutUrl)}/>
        <div className="profile__spacer"/>
        <SettingRow icon={<LogoutIcon/>} label={ru.profile.signOutAction} danger onClick={handleSignOut}/>
      </div>

      <PickerModal
        open={languageModalOpen}
        title={ru.profile.languageModalTitle}
        options={LANGUAGE_OPTIONS}
        value={language}
        onSelect={setLanguage}
        onClose={() => setLanguageModalOpen(false)}
      />
      <PickerModal
        open={themeModalOpen}
        title={ru.profile.themeModalTitle}
        options={THEME_OPTIONS}
        value={theme}
        onSelect={setTheme}
        onClose={() => setThemeModalOpen(false)}
      />
    </div>
  );
}
