/**
 * The four backend services this app talks to, per api-integration.md §1.1 —
 * one gateway origin (`VITE_API_BASE_URL`), then a per-service path prefix.
 * The gateway routes by the leading segment (backend-confirmed; the bare
 * `/api/...` prefixes 404 on dev).
 */
export type Service = 'auth' | 'userAccount' | 'balance' | 'financial';

const PREFIX: Record<Service, string> = {
  auth: '/auth/api/v1',
  userAccount: '/users/api/v1',
  // Version lives in the call path — balances use v2 (backend-confirmed), like the financial service.
  balance: '/balance/api',
  financial: '/operations/api',
};

const OVERRIDE_ENV: Record<Service, string | undefined> = {
  auth: import.meta.env.VITE_API_BASE_URL_AUTH,
  userAccount: import.meta.env.VITE_API_BASE_URL_USER_ACCOUNT,
  balance: import.meta.env.VITE_API_BASE_URL_BALANCE,
  financial: import.meta.env.VITE_API_BASE_URL_FINANCIAL,
};

/**
 * The path to pass to `apiFetch`/`apiFetchBlob` for a link the backend returned,
 * when that link is a bare gateway URL and so needs the session token. Relative
 * links are resolved against the gateway, never the mini app's own origin.
 * `undefined` means open it as is: a foreign host or a query string means a
 * signed link, and the token must never be sent to another origin.
 */
export function gatewayPath(service: Service, href: string): string | undefined {
  const gateway = new URL(OVERRIDE_ENV[service] || import.meta.env.VITE_API_BASE_URL || window.location.origin);
  const url = new URL(href, gateway);
  const isAbsolute = /^https?:/i.test(href);
  if (url.origin !== gateway.origin || (isAbsolute && url.search)) {
    return undefined;
  }
  const path = url.pathname.startsWith(`${PREFIX[service]}/`) ? url.pathname.slice(PREFIX[service].length) : url.pathname;
  return path.replace(/^\/api(?=\/)/, '') + url.search;
}

export function serviceUrl(service: Service, path: string): string {
  const base = OVERRIDE_ENV[service] || import.meta.env.VITE_API_BASE_URL || '';
  return `${base}${PREFIX[service]}${path}`;
}
