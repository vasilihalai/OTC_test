import type { OtcAccessReason } from '@/api/index.ts';

/** Reads a `?key=` param from the hash query string, e.g. `#/home?otc=verification`. */
export function readHashParam(name: string): string | null {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }
  return new URLSearchParams(hash.slice(queryIndex + 1)).get(name);
}

/** Dev-only override so every OTC-unavailable reason is reachable without editing fixtures. */
export function otcAccessOverride(): OtcAccessReason | undefined {
  const value = readHashParam('otc');
  if (value === 'verification') {
    return 'VERIFICATION_REQUIRED';
  }
  if (value === 'not_eligible') {
    return 'NOT_ELIGIBLE';
  }
  if (value === 'desk_closed') {
    return 'DESK_CLOSED';
  }
  if (value === 'granted') {
    return 'GRANTED';
  }
  return undefined;
}

/** `?scenario=quote_expiring` — the quote and new-terms timers start at ~10s instead of 5 minutes. */
export function isQuoteExpiringScenario(): boolean {
  return readHashParam('scenario') === 'quote_expiring';
}

/** `?requisites=error` — deposit requisites fail to load, for the retry state on the top-up screen. */
export function isRequisitesErrorScenario(): boolean {
  return readHashParam('requisites') === 'error';
}

/** `?scenario=empty_deals` — deals list loads empty, for the empty-state screens. */
export function isEmptyDealsScenario(): boolean {
  return readHashParam('scenario') === 'empty_deals';
}

let withdrawCheck: 'tasks' | 'questionnaire' | undefined;

/**
 * `?withdraw=tasks` — the mock refuses to send the withdrawal code until "tasks are done";
 * `?withdraw=questionnaire` — it takes the code and leaves the withdrawal waiting for a questionnaire.
 * Remembered until the page reloads (the fiat flow changes screens on the way); `?withdraw=off` clears it.
 */
export function withdrawCheckScenario(): 'tasks' | 'questionnaire' | undefined {
  const value = readHashParam('withdraw');
  if (value === 'tasks' || value === 'questionnaire') {
    withdrawCheck = value;
  } else if (value !== null) {
    withdrawCheck = undefined;
  }
  return withdrawCheck;
}

const LATENCY_KEY = 'xruby-mock-latency';

/**
 * `?latency=2000` — every mock call takes that many milliseconds, for looking at skeletons and loaders.
 * Kept for the tab's session, since the parameter leaves the address with the first navigation;
 * `?latency=0` switches it off.
 */
export function mockLatencyOverride(): number | undefined {
  try {
    const fromUrl = readHashParam('latency');
    if (fromUrl !== null) {
      const ms = Number(fromUrl);
      if (Number.isFinite(ms) && ms > 0) {
        sessionStorage.setItem(LATENCY_KEY, String(Math.min(ms, 15_000)));
      } else {
        sessionStorage.removeItem(LATENCY_KEY);
      }
    }
    const stored = Number(sessionStorage.getItem(LATENCY_KEY));
    return stored > 0 ? stored : undefined;
  } catch {
    return undefined;
  }
}
