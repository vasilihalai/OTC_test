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
  balance: '/balance/api/v1',
  financial: '/operations/api',
};

const OVERRIDE_ENV: Record<Service, string | undefined> = {
  auth: import.meta.env.VITE_API_BASE_URL_AUTH,
  userAccount: import.meta.env.VITE_API_BASE_URL_USER_ACCOUNT,
  balance: import.meta.env.VITE_API_BASE_URL_BALANCE,
  financial: import.meta.env.VITE_API_BASE_URL_FINANCIAL,
};

export function serviceUrl(service: Service, path: string): string {
  const base = OVERRIDE_ENV[service] || import.meta.env.VITE_API_BASE_URL || '';
  return `${base}${PREFIX[service]}${path}`;
}
