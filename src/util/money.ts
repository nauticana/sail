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

/** PERIOD_TYPE code → months, for cross-cycle price comparison. */
const CYCLE_MONTHS: Record<string, number> = { D: 1 / 30, W: 7 / 30, M: 1, Q: 3, A: 12 };
const CYCLE_SUFFIX: Record<string, string> = { D: '/day', W: '/wk', M: '/mo', Q: '/qtr', A: '/yr' };

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
  const perMonth = (p: PlanPrice) => p.amount / (CYCLE_MONTHS[p.billingCycle] ?? 1);
  const lowest = comparable.reduce((a, b) => (perMonth(b) < perMonth(a) ? b : a));
  const formatted = formatCurrency(lowest.amount, lowest.currency) + (CYCLE_SUFFIX[lowest.billingCycle] ?? '');
  return priced.length > 1 ? `from ${formatted}` : formatted;
}
