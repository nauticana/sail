import { PlanPrice } from '../model/appdata';

/**
 * Format integer minor units at the currency's exponent from keel's `currency` table.
 * `Intl` supplies only the symbol and grouping; it never decides the decimals.
 */
export function formatMinor(minor: number, currency: string, exponent: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error(`sail: money must be a safe integer (${minor}).`);
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
    throw new Error(`sail: currency "${currency}" has no valid exponent (${exponent}).`);
  }
  const code = currency.trim().toUpperCase();
  if (!code) throw new Error('sail: currency is required.');
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: code, minimumFractionDigits: exponent, maximumFractionDigits: exponent,
  }).format(minor / 10 ** exponent);
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
  const priced = (prices ?? []).filter((p) => p.amountMinor > 0);
  if (priced.length === 0) return '';
  const comparable = priced.filter((p) => p.currency === priced[0].currency);
  const perMonth = (p: PlanPrice) => p.amountMinor / (PERIOD_TYPE_INFO[p.billingCycle]?.months ?? 1);
  const lowest = comparable.reduce((a, b) => (perMonth(b) < perMonth(a) ? b : a));
  const formatted = formatMinor(lowest.amountMinor, lowest.currency, lowest.exponent) + (PERIOD_TYPE_INFO[lowest.billingCycle]?.suffix ?? '');
  return comparable.length > 1 ? `from ${formatted}` : formatted;
}
