/**
 * A response body's field names, one level deep, with no values — safe to log when a
 * real-backend body doesn't match what the frontend expects (no PII in the console).
 */
export function describeShape(body: unknown): Record<string, string | string[]> {
  if (body === null || typeof body !== 'object') {
    return { body: typeof body };
  }
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [
    key,
    value !== null && typeof value === 'object' ? Object.keys(value as object) : typeof value,
  ]));
}
