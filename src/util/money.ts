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

/**
 * "From" price teaser for a plan card / dropdown — the lowest priced offer,
 * currency-formatted, prefixed "from " when the plan sells more than one priced
 * offer. Returns '' when the plan has no priced offers (free/trial), so callers
 * can omit the price line entirely. The exact offer is chosen later via
 * `<sail-price-selector>`.
 */
export function fromPriceLabel(prices: PlanPrice[] | undefined): string {
  const priced = (prices ?? []).filter((p) => p.amount > 0);
  if (priced.length === 0) return '';
  const lowest = priced.reduce((a, b) => (b.amount < a.amount ? b : a));
  const formatted = formatCurrency(lowest.amount, lowest.currency);
  return priced.length > 1 ? `from ${formatted}` : formatted;
}
