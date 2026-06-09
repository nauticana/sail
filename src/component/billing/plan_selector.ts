import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PublicPlan } from '../../model/appdata';
import { fromPriceLabel } from '../../util/money';

/**
 * Plan picker. Pure presentational component — stateless, no service calls.
 * The caller provides the plans and handles the selection event.
 *
 * The per-plan CTA copy varies by `PublicPlan.activationMode` (e.g. 'T' →
 * "Start trial", 'P' → "Subscribe"); override or extend the mapping via
 * `[ctaLabels]` (e.g. `{ S: 'Add seats' }`).
 */
@Component({
  selector: 'sail-plan-selector',
  templateUrl: './plan_selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule],
})
export class PlanSelectorComponent {
  private static readonly DEFAULT_CTA: Record<string, string> = {
    T: 'Start trial',
    F: 'Activate',
    P: 'Subscribe',
  };

  readonly plans = input<PublicPlan[]>([]);
  readonly selected = input<string | undefined>(undefined);
  readonly features = input<{[planId: string]: string[]}>({});
  /** activationMode → CTA copy; overrides/extends the built-in defaults. */
  readonly ctaLabels = input<{[activationMode: string]: string}>({});
  readonly selectionChange = output<string>();

  /** planId → CTA label, resolved from activationMode (override wins). */
  readonly ctas = computed<Record<string, string>>(() => {
    const overrides = this.ctaLabels();
    const out: Record<string, string> = {};
    for (const plan of this.plans()) {
      const mode = plan.activationMode ?? '';
      out[plan.id] = overrides[mode] ?? PlanSelectorComponent.DEFAULT_CTA[mode] ?? 'Choose';
    }
    return out;
  });

  /** planId → indicative "from" price derived from the plan's offers ('' = none). */
  readonly priceLabels = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const plan of this.plans()) out[plan.id] = fromPriceLabel(plan.prices);
    return out;
  });

  onSelect(planId: string): void {
    this.selectionChange.emit(planId);
  }

  featuresFor(planId: string): string[] {
    return this.features()[planId] ?? [];
  }
}
