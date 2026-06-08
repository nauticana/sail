import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { PortalButtonComponent } from './portal_button';

/**
 * Past-due (dunning) banner. Shows only when the subscription status is the
 * past-due code 'X' (keel `SetDunningState`), prompting the partner to update
 * their card and deep-linking to the provider portal via `<sail-portal-button>`.
 * Renders nothing otherwise, so it can sit unconditionally in the template.
 */
@Component({
  selector: 'sail-dunning-banner',
  templateUrl: './dunning_banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [PortalButtonComponent],
})
export class DunningBannerComponent {
  /** Subscription.status — the banner shows when this is 'X' (past-due). */
  readonly status = input<string | undefined>(undefined);
  readonly message = input('Your payment is past due — please update your card to keep your subscription active.');

  readonly isPastDue = computed(() => this.status() === 'X');
}
