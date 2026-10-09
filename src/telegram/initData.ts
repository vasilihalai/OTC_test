import { retrieveRawInitData } from '@tma.js/sdk-react';

/**
 * Raw `initData` exactly as Telegram signed it. Telegram issues it once per
 * launch and never refreshes it, so every read returns the same string with
 * the launch-time `auth_date` — the backend's 300 s TTL counts from opening
 * the app, and only relaunching the mini app produces a new one.
 */
export function getFreshInitData(): string | undefined {
  return retrieveRawInitData();
}
