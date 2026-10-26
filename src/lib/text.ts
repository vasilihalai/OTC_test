export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Splits a 32-char id into groups of 4, e.g. `8f3a92c1…` → `8f3a 92c1 …`; already-grouped input comes back unchanged. */
export function groupOf4(value: string): string {
  return value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}
