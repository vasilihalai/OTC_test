import type { ApiError } from '@/api/real/http/apiError.ts';

/**
 * User-facing Russian copy for backend error codes — api-integration.md §1.5:
 * "Never render a backend `message` directly — those strings are not written
 * for end users and some leak internals." None of the three services'
 * concrete `code` values are enumerated anywhere in the eight Swagger files
 * per the spec doc, so this starts as a small known set (the cases the spec
 * text calls out explicitly, e.g. the 3-wrong-codes transaction expiry) plus
 * a generic fallback — extend this map as real codes are seen in practice.
 * This is the one place that changes when that happens; screens never
 * construct their own copy from a code.
 */
const KNOWN: Record<string, string> = {
  TRANSACTION_EXPIRED: 'Слишком много попыток, запросите код заново',
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  INVALID_OTP: 'Неверный код',
  TOO_MANY_ATTEMPTS: 'Слишком много попыток, подождите немного',
  // Seen on dev: /oauth2/otp answers this for any email/password/accountType mismatch,
  // deliberately not distinguishing an unknown email from a wrong password.
  ER_ATH0003: 'Неверный email или пароль',
  // Backend-confirmed: /authenticate with a missing/invalid platform token or no binding.
  ER_SYS0006: 'Не удалось войти через Telegram. Попробуйте ещё раз',
};

// Test plan §1/§9.8: "показывать на экране ошибки короткий код запроса ...
// без него баг 'не сработало' невозможно найти в логах" — every message
// this returns carries it, not just the unmapped fallback, so a tester (or
// support) can always read it straight off the screen.
export function mapApiError(err: ApiError): string {
  const message = KNOWN[err.code] ?? 'Что-то пошло не так. Попробуйте позже';
  return `${message} (${err.requestId.slice(0, 8)})`;
}
