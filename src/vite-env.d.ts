/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_BASE_URL_AUTH?: string;
  readonly VITE_API_BASE_URL_USER_ACCOUNT?: string;
  readonly VITE_API_BASE_URL_BALANCE?: string;
  readonly VITE_API_BASE_URL_FINANCIAL?: string;
  readonly VITE_AUTH_BASIC?: string;
  readonly VITE_TELEGRAM_MINI_APP_CLIENT_ID?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_USE_REAL_API?: string;
  readonly VITE_FORCE_INAPP_HEADER?: string;
}
