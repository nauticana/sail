import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';

/**
 * "Trial ends in N days" banner, bound to `Subscription.trialEnd`. Renders
 * nothing when `trialEnd` is empty, unparseable, or already past, so it can be
 * left in the template unconditionally.
 */
@Component({
  selector: 'sail-trial-banner',
  templateUrl: './trial_banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TrialBannerComponent {
  /** ISO timestamp the trial ends (Subscription.trialEnd). */
  readonly trialEnd = input<string | undefined>(undefined);

  // Hourly clock tick — a computed reading Date.now() directly would freeze
  // at mount time and show a stale day count across midnight.
  private readonly now = toSignal(timer(0, 3_600_000).pipe(map(() => Date.now())), { requireSync: true });

  readonly daysLeft = computed<number>(() => {
    const raw = this.trialEnd();
    if (!raw) return 0;
    const end = Date.parse(raw);
    if (Number.isNaN(end)) return 0;
    return Math.ceil((end - this.now()) / 86_400_000);
  });

  readonly message = computed<string>(() => {
    const d = this.daysLeft();
    return d === 1 ? 'Trial ends in 1 day' : `Trial ends in ${d} days`;
  });
}
