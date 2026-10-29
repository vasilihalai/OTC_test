const NBSP = ' ';

const FIAT_TICKERS = new Set(['KGS', 'RUB', 'USD']);

export function isFiatTicker(ticker: string): boolean {
  return FIAT_TICKERS.has(ticker);
}

function decimalsFor(ticker: string): number {
  if (ticker === 'BTC' || ticker === 'ETH') {
    return 6;
  }
  return isFiatTicker(ticker) ? 0 : 2;
}

/** Parses a fixture amount string like `44 420 000 KGS` into its numeric value and ticker. */
export function parseAmountWithTicker(raw: string): { value: number; ticker: string } {
  const match = /^([\d\s.,]+)\s+([A-Z]+)$/.exec(raw.trim());
  if (!match) {
    return { value: 0, ticker: '' };
  }
  return { value: Number(match[1].replace(/[\s,]/g, '')), ticker: match[2] };
}

/** Decimal-string formatting: non-breaking space thousands separator, no float math. */
export function formatAmount(value: string, ticker: string): string {
  const decimals = decimalsFor(ticker);
  const num = Number(value);
  const fixed = num.toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return fracPart ? `${withThousands}.${fracPart}` : withThousands;
}

/**
 * Groups a raw numeric string's integer part with the same NBSP thousands
 * separator as `formatAmount`, for showing live in an amount field as the
 * user types — unlike `formatAmount`, it never rounds or pads the decimal
 * part, so it's safe to call on every keystroke (`"1234."` stays `"1234."`,
 * not `"1234.00"`).
 */
export function formatAmountInput(raw: string): string {
  const dotIndex = raw.indexOf('.');
  const intPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? '' : raw.slice(dotIndex);
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + fracPart;
}

/**
 * Cleans up a live-typed amount field's raw input back down to a plain
 * `Number()`-parseable string: strips the NBSP thousands-separator spaces
 * `formatAmountInput` just added, treats `,` as a decimal point (common on
 * Cyrillic keyboards' numeric layout), and drops any extra dots or non-digit
 * characters typed/pasted in.
 */
export function sanitizeAmountInput(raw: string): string {
  const digitsAndDots = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const firstDot = digitsAndDots.indexOf('.');
  if (firstDot === -1) {
    return digitsAndDots;
  }
  return digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replace(/\./g, '');
}
