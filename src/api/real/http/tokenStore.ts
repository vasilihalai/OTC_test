/**
 * Token lifecycle for the mini app's own access token, obtained from
 * `authenticateMiniApp()` (`real/miniAppAuth.ts`) — never from `/oauth2/*`
 * directly any more. That endpoint's own contract is explicit: **no refresh
 * token for this client**. So unlike the standard OAuth `refresh_token`
 * grant this store used before, "refreshing" here means calling
 * `authenticateMiniApp(freshInitData)` again — the persisted Telegram↔
 * platform binding on the backend is the durable credential, not anything
 * stored locally. Access token lives in memory + `sessionStorage` only
 * (survives a same-tab reload, not a fresh relaunch — a fresh relaunch just
 * re-authenticates silently instead, see `index.tsx`).
 */

const ACCESS_KEY = 'xruby-access-token';
const EXPIRES_KEY = 'xruby-token-expires-at';

export interface TokenSet {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

function toTokenSet(res: AccessTokenResponse): TokenSet {
  return {
    accessToken: res.accessToken,
    expiresAt: Date.now() + res.expiresIn * 1000,
  };
}

let current: TokenSet | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | undefined;
let refreshPromise: Promise<TokenSet> | null = null;

/**
 * Set once at boot (`index.tsx`, real mode only) to how a lapsed access
 * token gets replaced — always `() => authenticateMiniApp(getFreshInitData())`
 * in practice, injected rather than imported directly so this module stays
 * free of any Telegram/mini-app-specific concern.
 */
let reauthenticate: (() => Promise<AccessTokenResponse>) | null = null;

export function setReauthenticator(fn: () => Promise<AccessTokenResponse>): void {
  reauthenticate = fn;
}

function scheduleProactiveRefresh(): void {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
  }
  if (!current) {
    return;
  }
  const delay = Math.max(0, current.expiresAt - Date.now() - 60_000);
  proactiveTimer = setTimeout(() => void refreshTokens().catch(() => {}), delay);
}

/** Call once at boot (real mode only) to restore whatever survived a same-tab reload, before deciding whether a network re-authenticate is even needed. */
export function hydrateTokensFromStorage(): TokenSet | null {
  const accessToken = sessionStorage.getItem(ACCESS_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) ?? '0');
  if (!accessToken || !expiresAt) {
    return null;
  }
  current = { accessToken, expiresAt };
  if (expiresAt > Date.now()) {
    scheduleProactiveRefresh();
  }
  return current;
}

export function saveAccessToken(res: AccessTokenResponse): TokenSet {
  const tokens = toTokenSet(res);
  current = tokens;
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  sessionStorage.setItem(EXPIRES_KEY, String(tokens.expiresAt));
  scheduleProactiveRefresh();
  return tokens;
}

export function clearTokens(): void {
  current = null;
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
  }
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

export function getAccessToken(): string | null {
  return current?.accessToken || null;
}

/** Serialised — a proactive timer firing at the same moment as a reactive 401 share this one promise. */
export async function refreshTokens(): Promise<TokenSet> {
  if (refreshPromise) {
    return refreshPromise;
  }
  if (!reauthenticate) {
    throw new Error('No reauthenticator configured');
  }
  const reauth = reauthenticate;
  refreshPromise = (async () => {
    const res = await reauth();
    return saveAccessToken(res);
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/** Ensures the access token is valid for at least the next minute, re-authenticating first if not. Returns `null` if there's nothing to refresh with (never authenticated this boot, or re-authentication just failed). */
export async function ensureFreshAccessToken(): Promise<string | null> {
  if (!current) {
    return null;
  }
  if (current.accessToken && current.expiresAt - Date.now() > 60_000) {
    return current.accessToken;
  }
  try {
    const refreshed = await refreshTokens();
    return refreshed.accessToken;
  } catch {
    return null;
  }
}
