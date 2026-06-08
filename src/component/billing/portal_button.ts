import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../abstract/base_async';
import { BillingService } from '../../service/billing.service';

/**
 * Button that opens a provider customer-portal session and redirects the
 * browser to the returned URL — the partner manages their payment method /
 * subscription on the provider's hosted page. Mirrors CheckoutButtonComponent;
 * uses BaseAsync for loading/error state.
 */
@Component({
  selector: 'sail-portal-button',
  templateUrl: './portal_button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule],
})
export class PortalButtonComponent extends BaseAsync {
  private readonly billing = inject(BillingService);

  readonly label = input('Manage billing');

  openPortal(): void {
    this.run(
      this.billing.createPortalSession(),
      (resp) => { window.location.href = resp.portalUrl; },
      'Could not open the billing portal. Please try again.',
    );
  }
}
