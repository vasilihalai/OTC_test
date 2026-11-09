/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_BASE_URL_AUTH?: string;
  readonly VITE_API_BASE_URL_USER_ACCOUNT?: string;
  readonly VITE_API_BASE_URL_BALANCE?: string;
  readonly VITE_API_BASE_URL_FINANCIAL?: string;
  /** Full SockJS endpoint for STOMP; defaults to `${VITE_API_BASE_URL}/ws`. */
  readonly VITE_WS_URL?: string;
  readonly VITE_AUTH_BASIC?: string;
  readonly VITE_AUTH_MERCHANT_ID?: string;
  readonly VITE_TELEGRAM_MINI_APP_CLIENT_ID?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_USE_REAL_API?: string;
  readonly VITE_FORCE_INAPP_HEADER?: string;
}

// The prebuilt browser bundle: the package's CommonJS entry reads Node's `global`, which Vite doesn't define.
declare module 'sockjs-client/dist/sockjs.min.js' {
  import SockJS from 'sockjs-client';

  export default SockJS;
}
