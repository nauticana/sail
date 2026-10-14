import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../abstract/base_async';
import { BillingService } from '../../service/billing.service';
import { PublicPlan, Subscription } from '../../model/appdata';

/**
 * Scheduled plan change banner, bound to `Subscription.scheduledAt`: names the
 * ending plan, its end date and the plan that follows, with a Keep my plan
 * action that re-selects the current plan. Renders nothing when no change is scheduled.
 */
@Component({
  selector: 'sail-scheduled-change-banner',
  templateUrl: './scheduled_change_banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, MatButtonModule],
})
export class ScheduledChangeBannerComponent extends BaseAsync {
  private readonly billing = inject(BillingService);

  readonly subscription = input<Subscription | null | undefined>(undefined);
  /** Catalog plans, to caption the following plan. */
  readonly plans = input<PublicPlan[]>([]);
  /** Emits once the current plan renews again; reload the subscription. */
  readonly kept = output<void>();

  readonly next = computed(() => {
    const id = this.subscription()?.scheduledPlanId;
    return id ? (this.plans().find((p) => p.id === id)?.caption ?? id) : '';
  });

  keep(): void {
    const sub = this.subscription();
    if (!sub) return;
    this.run(this.billing.changePlan(sub.planId), () => this.kept.emit(), 'Could not keep your plan. Please try again.');
  }
}
