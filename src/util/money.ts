import { PlanPrice } from '../model/appdata';

/**
 * Format a major-unit amount in its currency, honouring the currency exponent
 * (JPY 0 decimals, BHD 3, …) via `Intl`. Falls back to "<amount> <currency>"
 * for an unknown currency code rather than throwing.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
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
 * "From" price teaser for a plan card / dropdown — the cheapest offer once
 * normalized per month (a $2 daily offer must not undercut a $30 monthly one),
 * compared within one currency, rendered with its cycle ("from $30.00/mo").
 * Returns '' when the plan has no priced offers (free/trial). The exact offer
 * is chosen later via `<sail-price-selector>`.
 */
export function fromPriceLabel(prices: PlanPrice[] | undefined): string {
  const priced = (prices ?? []).filter((p) => p.amount > 0);
  if (priced.length === 0) return '';
  const currency = priced[0].currency;
  const comparable = priced.filter((p) => p.currency === currency);
  const perMonth = (p: PlanPrice) => p.amount / (PERIOD_TYPE_INFO[p.billingCycle]?.months ?? 1);
  const lowest = comparable.reduce((a, b) => (perMonth(b) < perMonth(a) ? b : a));
  const formatted = formatCurrency(lowest.amount, lowest.currency) + (PERIOD_TYPE_INFO[lowest.billingCycle]?.suffix ?? '');
  return priced.length > 1 ? `from ${formatted}` : formatted;
}
