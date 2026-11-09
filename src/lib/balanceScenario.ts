import type { BalanceScenario } from '@/api/index.ts';

export const BALANCE_SCENARIOS: BalanceScenario[] = ['sufficient', 'short1', 'short', 'belowmin'];

/** Validates a `?scenario=` search-param value, e.g. `#/deals/OTC-1052?scenario=short`. */
export function isBalanceScenario(value: string | null): value is BalanceScenario {
  return !!value && (BALANCE_SCENARIOS as string[]).includes(value);
}

export function parseAmountValue(raw: string): number {
  return Number(raw.replace(/[^\d.]/g, '')) || 0;
}

/** A plain decimal string for a number, without float noise or exponent notation. */
export function decimalString(value: number): string {
  return value.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 15 });
}

const SCALE = 18;

/**
 * Fixed-point units, so a shortfall of exactly 1% is never lost to float rounding. Anything that isn't a
 * plain non-negative decimal (a JSON number in exponent form, a negative, garbage) is read as a number
 * and floored at zero rather than thrown on: this runs while rendering the hold screen.
 */
function units(value: string | number): bigint {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(String(value).trim());
  if (!match || (!match[1] && !match[2])) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? units(numeric.toFixed(8)) : 0n;
  }
  const [, whole, fraction = ''] = match;
  return BigInt((whole || '0') + fraction.padEnd(SCALE, '0').slice(0, SCALE));
}

function fromUnits(value: bigint): string {
  const digits = value.toString().padStart(SCALE + 1, '0');
  const whole = digits.slice(0, -SCALE);
  const fraction = digits.slice(-SCALE).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * The server's CONFIRM_HOLD rule (BRCE-4023 §5), given the available balance, the deal amount and the
 * deal's minimum, all in the deal's asset:
 * - `sufficient` — nothing missing, the whole amount is frozen;
 * - `short1` — up to 1% missing (1% itself included) with a balance above zero: the deal is recalculated
 *   to the balance at the same rate and frozen;
 * - `short` — more than 1% missing, the balance above the minimum: what there is gets frozen and the
 *   deal waits for the operator;
 * - `belowmin` — more than 1% missing and the balance not above the minimum: the server freezes nothing
 *   and answers 200 without a status change, so the button is blocked here.
 */
export function holdBranch(balance: string, amount: string, minAmount: string): BalanceScenario {
  const available = units(balance);
  const deal = units(amount);
  if (available >= deal) {
    return 'sufficient';
  }
  const shortfall = deal - available;
  if (available > 0n && shortfall * 100n <= deal) {
    return 'short1';
  }
  return available > units(minAmount) ? 'short' : 'belowmin';
}

/** `amount − balance`, never below zero. */
export function shortfallOf(balance: string, amount: string): string {
  const difference = units(amount) - units(balance);
  return fromUnits(difference > 0n ? difference : 0n);
}

/** Dev-only deposit balance for the deal's source asset, so every callout branch is reachable in mock mode. */
export function computeScenarioBalance(dealAmount: number, minAmount: number, scenario: BalanceScenario): number {
  switch (scenario) {
    case 'sufficient':
      return dealAmount * 1.2;
    case 'short1':
      return dealAmount * 0.995;
    case 'short':
      return Math.max(dealAmount * 0.6, minAmount * 1.1);
    case 'belowmin':
      return minAmount * 0.5;
    default:
      return dealAmount * 1.2;
  }
}
