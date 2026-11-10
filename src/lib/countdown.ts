/** Milliseconds until an ISO timestamp, clamped to 0 — never negative. */
export function msUntil(isoTimestamp: string | undefined): number {
  if (!isoTimestamp) {
    return 0;
  }
  return Math.max(0, new Date(isoTimestamp).getTime() - Date.now());
}

/** `m:ss`, e.g. 286000ms → `4:46`. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** `mm:ss`, e.g. 59 → `00:59` — the "send the code again" timers. */
export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}
