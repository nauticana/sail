import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { PlanPrice } from '../../model/appdata';
import { formatCurrency } from '../../util/money';

/** Per-offer view model for accessible, currency-formatted rendering. */
interface OfferRow {
  key:        string;   // stable id for tracking / selection (priceId or composite)
  price:      PlanPrice;
  amountText: string;   // currency-formatted major amount
  cycleText:  string;   // "Monthly" / "Annual" / …
  termText:   string;   // commitment note, '' when the term is a single cycle
}

/**
 * Offer picker for a plan's `subscription_plan_price` rows (keel v1.0.5). A plan
 * sells several offers (billing cycle × commitment term); the customer picks one
 * at checkout, then its `priceId` feeds `<sail-checkout-button [priceId]>`.
 *
 * Pure presentational — stateless. Amounts are formatted with `Intl` from each
 * offer's currency, so non-2-decimal currencies (JPY 0, BHD 3) render correctly.
 * Period codes map to copy via `[cycleLabels]` (override/extend the defaults).
 */
@Component({
  selector: 'sail-price-selector',
  templateUrl: './price_selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PriceSelectorComponent {
  private static readonly DEFAULT_CYCLE: Record<string, string> = {
    D: 'Daily',
    W: 'Weekly',
    M: 'Monthly',
    Q: 'Quarterly',
    A: 'Annual',
  };

  readonly prices = input<PlanPrice[]>([]);
  /** Selected offer key — a `priceId`, or the composite key when priceId is empty. */
  readonly selected = input<string | undefined>(undefined);
  /** PERIOD_TYPE code → label; overrides/extends the built-in defaults. */
  readonly cycleLabels = input<{[periodCode: string]: string}>({});
  readonly selectionChange = output<PlanPrice>();

  readonly offers = computed<OfferRow[]>(() => {
    const labels = this.cycleLabels();
    const cycleLabel = (code: string) =>
      labels[code] ?? PriceSelectorComponent.DEFAULT_CYCLE[code] ?? code;
    return this.prices().map((p) => {
      const singleCycle = p.termCount === 1 && p.termType === p.billingCycle;
      return {
        key:        p.priceId || `${p.billingCycle}-${p.termType}-${p.termCount}`,
        price:      p,
        amountText: formatCurrency(p.amount, p.currency),
        cycleText:  cycleLabel(p.billingCycle),
        termText:   singleCycle
          ? ''
          : `${p.termCount} ${cycleLabel(p.termType)}${p.termCount > 1 ? 's' : ''} commitment`,
      };
    });
  });

  onSelect(offer: OfferRow): void {
    this.selectionChange.emit(offer.price);
  }
}
