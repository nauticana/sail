import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../abstract/base_async';
import { BillingService } from '../../service/billing.service';
import { CheckoutMode } from '../../model/appdata';

/**
 * Button that opens a provider-hosted checkout session and redirects the
 * browser to the returned URL. Uses BaseAsync for loading/error state.
 *
 * The keel backend validates `priceId`, `successUrl`, and `cancelUrl`
 * against server-side allowlists. Any value outside the allowlist is
 * rejected with 400.
 */
@Component({
  selector: 'app-checkout-button',
  templateUrl: './checkout_button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule],
})
export class CheckoutButtonComponent extends BaseAsync {
  private readonly billing = inject(BillingService);

  /** Stripe price ID (or keel-internal plan id resolved server-side). */
  readonly priceId = input.required<string>();
  /** Checkout mode — 'subscription' (default), 'payment' (one-off), or 'setup' (capture method). */
  readonly mode = input<CheckoutMode>('subscription');
  /** Quantity for the priced item. */
  readonly quantity = input<number | undefined>(undefined);
  /** Pre-filled email passed to the provider. */
  readonly email = input<string | undefined>(undefined);
  /** Redirect URL after success — must match keel AllowedRedirectHosts. */
  readonly successUrl = input.required<string>();
  /** Redirect URL after cancel — must match keel AllowedRedirectHosts. */
  readonly cancelUrl = input.required<string>();
  /** Optional metadata bag forwarded to the provider session. */
  readonly metadata = input<{ [key: string]: string } | undefined>(undefined);
  /** Button label. */
  readonly label = input('Continue to payment');

  startCheckout(): void {
    this.run(
      this.billing.createCheckout({
        mode:       this.mode(),
        priceId:    this.priceId(),
        quantity:   this.quantity(),
        email:      this.email(),
        successUrl: this.successUrl(),
        cancelUrl:  this.cancelUrl(),
        metadata:   this.metadata(),
      }),
      (resp) => { window.location.href = resp.checkoutUrl; },
      'Could not start checkout. Please try again.',
    );
  }
}
