import type { ClientType } from '@/api/types.ts';

const KEY = 'xruby-last-client-type';

/**
 * Non-sensitive hint for which account type a silently-re-entered session
 * (via `authenticateMiniApp`, no login screen shown) belongs to. The real
 * profile response has no account-type field at all (`real/profile.ts`'s
 * own note — `clientType` is display-only, session-derived server-side),
 * and the mini-app authenticate call doesn't ask for or return one either —
 * so on a fresh binding this is set from whichever login screen variant the
 * user actually completed, and reused as a best guess on every silent
 * re-entry after that. Defaults to `UL`, matching `/login`'s own default.
 */
export function getLastClientType(): ClientType {
  return (localStorage.getItem(KEY) as ClientType | null) ?? 'UL';
}

export function setLastClientType(clientType: ClientType): void {
  localStorage.setItem(KEY, clientType);
}
