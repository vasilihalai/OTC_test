import { copyTextToClipboard, hapticFeedback, miniApp, openLink, retrieveLaunchParams } from '@tma.js/sdk-react';

import { isRealTelegram } from '@/telegram/environment.ts';

// Keep in sync with theme/tokens.css.
const DARK_PALETTE = {
  bg: '#0D0E10',
  headerBg: '#0D0E10',
  bottomBarBg: '#0D0E10',
} as const;

/** xRuby always renders dark, regardless of the user's Telegram theme. */
export function applyDarkTheme(): void {
  miniApp.setBgColor.ifAvailable(DARK_PALETTE.bg);
  miniApp.setHeaderColor.ifAvailable(DARK_PALETTE.headerBg);
  miniApp.setBottomBarColor.ifAvailable(DARK_PALETTE.bottomBarBg);
}

export function notifySuccess(): void {
  hapticFeedback.notificationOccurred.ifAvailable('success');
}

export function notifyError(): void {
  hapticFeedback.notificationOccurred.ifAvailable('error');
}

export function openExternalLink(url: string): void {
  // Outside real Telegram, ensureTelegramEnvironment() mocks the bridge so
  // openLink.ifAvailable() reports "available" without actually opening
  // anything — go straight to window.open there instead of no-op'ing.
  if (isRealTelegram) {
    try {
      const result = openLink.ifAvailable(url);
      if (result.ok) {
        return;
      }
    } catch {
      // fall through to window.open
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Whether `window.open` gives a real browser tab here: native Telegram clients have no tabs to put a blob: URL in. */
function hasBrowserTabs(): boolean {
  if (!isRealTelegram) {
    return true;
  }
  try {
    return retrieveLaunchParams().tgWebAppPlatform.startsWith('web');
  } catch {
    return false;
  }
}

/**
 * Opens something that has to be fetched first: a link, or a PDF that needs the session token and so
 * can't be handed to the external browser as a link. Where the app runs in a browser, a popup opened
 * after an await is blocked, so the tab is opened before the fetch and pointed at the result after.
 * Native Telegram clients open a link through the bridge, but have nowhere to show a fetched file.
 * Must be called from the tap handler.
 */
export async function openWhenReady(load: () => Promise<string | Blob>): Promise<void> {
  const tab = hasBrowserTabs() ? window.open('', '_blank') : null;
  try {
    const loaded = await load();
    if (typeof loaded === 'string') {
      if (tab) {
        tab.location.href = loaded;
      } else {
        openExternalLink(loaded);
      }
      return;
    }
    if (await loaded.slice(0, 4).text() !== '%PDF') {
      throw new Error(`Expected a PDF, got ${loaded.type || 'an untyped response'}`);
    }
    const url = URL.createObjectURL(loaded.slice(0, loaded.size, 'application/pdf'));
    if (tab) {
      tab.location.href = url;
    } else if (!window.open(url, '_blank')) {
      throw new Error('This client cannot open a downloaded file, the backend must return a signed link');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await copyTextToClipboard(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}
