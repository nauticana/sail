import { PlanPrice } from '../model/appdata';
import { Int64, isInt64, toSafeInteger } from './integer';

/**
 * Format integer minor units at the currency's exponent from keel's `currency` table.
 * `Intl` supplies only the symbol and grouping; it never decides the decimals.
 */
export function formatMinor(minor: Int64 | number, currency: string, exponent: Int64 | number): string {
  const text = typeof minor === 'number' ? String(toSafeInteger(minor)) : minor;
  if (!isInt64(text)) throw new Error(`sail: money must be an integer (${minor}).`);
  const amount = BigInt(text);
  const decimals = requireExponent(exponent, currency);
  const code = currency.trim().toUpperCase();
  if (!code) throw new Error('sail: currency is required.');
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = amount < 0n ? -(amount % scale) : amount % scale;
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: code, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
  if (!decimals) return formatter.format(amount);
  // Format the whole units exactly, then splice in the fraction digits; -0 keeps the sign of "-0.50".
  const digits = new Intl.NumberFormat(undefined, { useGrouping: false, minimumIntegerDigits: decimals }).format(fraction);
  return formatter.formatToParts(whole === 0n && amount < 0n ? -0 : whole)
    .map((part) => (part.type === 'fraction' ? digits : part.value)).join('');
}

/** Decimal text of minor units for an input ("12.50" at exponent 2), `.` as the point; the inverse of `parseMinor`. */
export function minorToDecimal(minor: Int64 | number, exponent: Int64 | number): string {
  const text = typeof minor === 'number' ? String(toSafeInteger(minor)) : minor;
  if (!isInt64(text)) throw new Error(`sail: money must be an integer (${minor}).`);
  const decimals = requireExponent(exponent);
  const negative = text.startsWith('-');
  const digits = (negative ? text.slice(1) : text).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  return (negative ? '-' : '') + whole + (decimals ? '.' + digits.slice(-decimals) : '');
}

/**
 * Parse a typed decimal amount ("12.5", "-0.75") into minor units with exact integer
 * arithmetic. null for anything else, including more fraction digits than `exponent`
 * or an amount outside the 64-bit range.
 */
export function parseMinor(text: string, exponent: Int64 | number): Int64 | null {
  const decimals = requireExponent(exponent);
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match || !(match[2] || match[3]) || (match[3]?.length ?? 0) > decimals) return null;
  const digits = ((match[2] || '0') + (match[3] ?? '').padEnd(decimals, '0')).replace(/^0+(?=\d)/, '');
  if (digits.length > 19) return null;
  const minor = BigInt(digits);
  const value = String(match[1] === '-' ? -minor : minor);
  return isInt64(value) ? value : null;
}

function requireExponent(exponent: Int64 | number, currency?: string): number {
  const n = typeof exponent === 'number' ? exponent : /^\d$/.test(exponent) ? Number(exponent) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 6) {
    throw new Error(`sail: ${currency ? `currency "${currency}"` : 'money'} has no valid exponent (${exponent}).`);
  }
  return n;
}

/** PERIOD_TYPE code vocabulary — the single source for cycle labels/durations. */
export const PERIOD_TYPE_INFO: Record<string, { label: string; noun: string; suffix: string; months: number }> = {
  D: { label: 'Daily',     noun: 'day',     suffix: '/day', months: 1 / 30 },
  W: { label: 'Weekly',    noun: 'week',    suffix: '/wk',  months: 7 / 30 },
  M: { label: 'Monthly',   noun: 'month',   suffix: '/mo',  months: 1 },
  Q: { label: 'Quarterly', noun: 'quarter', suffix: '/qtr', months: 3 },
  A: { label: 'Annual',    noun: 'year',    suffix: '/yr',  months: 12 },
};

/**
 * "From" price teaser for a plan card: the cheapest offer per month within the first
 * offer's currency, rendered with its cycle ("from $30.00/mo"); '' when nothing is priced.
 */
export function fromPriceLabel(prices: readonly PlanPrice[] | null | undefined): string {
  const priced = (prices ?? []).filter((p) => BigInt(p.amountMinor) > 0n);
  if (priced.length === 0) return '';
  const comparable = priced.filter((p) => p.currency === priced[0].currency);
  // Compare per-month prices exactly: amount / days, cross-multiplied, with PERIOD_TYPE_INFO's 30-day month.
  const days = (p: PlanPrice) => BigInt(Math.round((PERIOD_TYPE_INFO[p.billingCycle]?.months ?? 1) * 30));
  const lowest = comparable.reduce((a, b) => (BigInt(b.amountMinor) * days(a) < BigInt(a.amountMinor) * days(b) ? b : a));
  const formatted = formatMinor(lowest.amountMinor, lowest.currency, lowest.exponent) + (PERIOD_TYPE_INFO[lowest.billingCycle]?.suffix ?? '');
  return comparable.length > 1 ? `from ${formatted}` : formatted;
}
