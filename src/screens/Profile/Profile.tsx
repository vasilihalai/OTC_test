import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Panel } from '@/components/Panel/Panel.tsx';
import { Button } from '@/components/Button/Button.tsx';
import { SettingRow } from '@/components/SettingRow/SettingRow.tsx';
import { PickerModal } from '@/components/PickerModal/PickerModal.tsx';
import { Skeleton } from '@/components/Skeleton/Skeleton.tsx';
import { USE_REAL_API, getAccountCertificate, getUser } from '@/api/index.ts';
import type { User } from '@/api/index.ts';
import { useRequireSession, useSessionStore } from '@/store/session.ts';
import { useSettingsStore } from '@/store/settings.ts';
import { useToastStore } from '@/store/toast.ts';
import { useCopy } from '@/lib/useCopy.ts';
import { groupOf4 } from '@/lib/text.ts';
import { maskEmail } from '@/lib/mask.ts';
import { SAMPLE_DOCUMENT_URL } from '@/lib/sampleDocument.ts';
import { notifyError, openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './Profile.css';

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.5 13.5H12a1.5 1.5 0 0 0 1.5-1.5V5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

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
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.16"/>
      <path
        d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.3 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.3-3.8-8.5S9.5 5.8 12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5a8.5 8.5 0 1 0 8.2 10.7c.15-.55-.45-.98-.94-.7a6 6 0 0 1-7.76-8.66c.34-.46.03-1.13-.54-1.3A8.5 8.5 0 0 0 12 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FaqIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1 .8-1 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="16.3" r="0.9" fill="currentColor"/>
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="12" cy="7.8" r="1" fill="currentColor"/>
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
  { value: 'ru' as const, label: ru.profile.languageRu },
  { value: 'en' as const, label: ru.profile.languageEn },
  { value: 'ky' as const, label: ru.profile.languageKy },
];

const THEME_OPTIONS = [
  { value: 'dark' as const, label: ru.profile.themeDark },
  { value: 'light' as const, label: ru.profile.themeLight },
];

function DetailRow({ label, value, display, copyValue }: { label: string; value: string; display?: string; copyValue?: string }) {
  const copy = useCopy();
  return (
    <div className="profile__detail-row">
      <span className="profile__detail-label">{label}</span>
      <span className="profile__detail-value">
        <span className="profile__detail-text">{display ?? value}</span>
        {copyValue && (
          <button type="button" className="profile__copy" aria-label={ru.common.copyAction} onClick={() => copy(copyValue)}>
            <CopyIcon/>
          </button>
        )}
      </span>
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
  const [user, setUser] = useState<User>();
  const [error, setError] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      return;
    }
    setError(false);
    setUser(undefined);
    try {
      setUser(await getUser(session.clientType));
    } catch {
      setError(true);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSignOut() {
    clearSession();
    navigate('/login', { replace: true });
  }

  const [certificateLoading, setCertificateLoading] = useState(false);

  // §8 — mock mode just opens the bundled sample PDF directly (nothing to
  // load, no loading/error states to simulate). Real mode fetches the
  // certificate as a file body (not a URL, question B13), turns it into a
  // blob URL, opens that, and revokes it shortly after — long enough for
  // the external browser to have started loading it.
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
      const blob = await getAccountCertificate();
      const url = URL.createObjectURL(blob);
      openExternalLink(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      notifyError();
      useToastStore.getState().show(ru.common.errorGeneric);
    } finally {
      setCertificateLoading(false);
    }
  }

  // Sign-out must never depend on the profile loading.
  const signOutRow = (
    <div className="profile__panel2">
      <SettingRow icon={<LogoutIcon/>} label={ru.profile.signOutAction} danger onClick={handleSignOut}/>
    </div>
  );

  if (error) {
    return (
      <div className="profile">
        <Panel>
          <p className="profile__error">{ru.profile.errorTitle}</p>
          <Button variant="secondary" onClick={() => void load()}>{ru.profile.retryAction}</Button>
        </Panel>
        {signOutRow}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile">
        <div className="profile__panel1">
          <Skeleton width={160} height={24}/>
          <div className="profile__details-card">
            <Skeleton height={120} radius={8}/>
          </div>
        </div>
        {signOutRow}
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile__panel1">
        <div className="profile__title-row">
          <h1 className="profile__name">{user.clientName}</h1>
          {user.verified && (
            <span className="profile__verified-badge">
              <VerifiedIcon/>
              {ru.profile.verifiedBadge}
            </span>
          )}
        </div>

        <div className="profile__details-card">
          <DetailRow label={ru.profile.emailRow} value={user.email} display={maskEmail(user.email)} copyValue={user.email}/>
          <DetailRow label={ru.profile.userIdRow} value={user.userId} display={groupOf4(user.userId)} copyValue={user.userId}/>
          <DetailRow label={ru.profile.phoneRow} value={user.phone}/>
        </div>

        <Button variant="secondary" size="compact" loading={certificateLoading} onClick={() => void handleCertificate()}>
          {ru.profile.certificateAction}
        </Button>
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
        <SettingRow icon={<FaqIcon/>} label={ru.profile.faqRow} onClick={() => openExternalLink(user.faqUrl)}/>
        <SettingRow icon={<AboutIcon/>} label={ru.profile.aboutRow} onClick={() => openExternalLink(user.aboutUrl)}/>
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
