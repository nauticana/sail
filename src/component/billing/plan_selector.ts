import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PublicPlan } from '../../model/appdata';

/**
 * Plan picker. Pure presentational component — stateless, no service calls.
 * The caller provides the plans and handles the selection event.
 */
@Component({
  selector: 'sail-plan-selector',
  templateUrl: './plan_selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule],
})
export class PlanSelectorComponent {
  readonly plans = input<PublicPlan[]>([]);
  readonly selected = input<string | undefined>(undefined);
  readonly features = input<{[planId: string]: string[]}>({});
  readonly selectionChange = output<string>();

  onSelect(planId: string): void {
    this.selectionChange.emit(planId);
  }

  featuresFor(planId: string): string[] {
    return this.features()[planId] ?? [];
  }
}
