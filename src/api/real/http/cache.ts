import { getAccessToken } from '@/api/real/http/tokenStore.ts';

export interface TokenCache<T> {
  get: () => Promise<T>;
  invalidate: () => void;
}

/**
 * Shares one in-flight or recent result between callers — several screens/hooks ask for the same
 * data on one navigation, and each dev-stand round trip takes seconds. Keyed by access token, so a
 * new sign-in never sees the previous account's data; a failure is never cached.
 */
export function cacheByToken<T>(load: () => Promise<T>, ttlMs: number): TokenCache<T> {
  let entry: { token: string | null; at: number; promise: Promise<T> } | undefined;
  return {
    get() {
      const token = getAccessToken();
      if (entry && entry.token === token && Date.now() - entry.at < ttlMs) {
        return entry.promise;
      }
      const current = { token, at: Date.now(), promise: load() };
      entry = current;
      current.promise.then(() => {
        // Asked before the boot's silent sign-in had finished: the request waited for the token and
        // was made with it, so that is the token this answer belongs to.
        if (entry === current && current.token === null) {
          current.token = getAccessToken();
        }
      }, () => {
        if (entry === current) {
          entry = undefined;
        }
      });
      return current.promise;
    },
    invalidate() {
      entry = undefined;
    },
  };
}
