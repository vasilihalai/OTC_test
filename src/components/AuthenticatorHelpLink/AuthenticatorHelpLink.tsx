import { useToastStore } from '@/store/toast.ts';
import { openExternalLink } from '@/telegram/adapter.ts';
import { ru } from '@/i18n/ru.ts';

import './AuthenticatorHelpLink.css';

/** BRD FR-10: clients reach the desk through their Telegram chat with it. */
export function AuthenticatorHelpLink() {
  function handleClick() {
    const url = import.meta.env.VITE_SUPPORT_URL;
    if (url) {
      openExternalLink(url);
    } else {
      useToastStore.getState().show(ru.authenticator.syncHelpFallback);
    }
  }

  return (
    <button type="button" className="authenticator-help-link" onClick={handleClick}>
      {ru.authenticator.syncHelpAction}
    </button>
  );
}
