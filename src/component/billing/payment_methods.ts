import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BaseAsync } from '../abstract/base_async';
import { BillingService } from '../../service/billing.service';
import { PaymentMethod } from '../../model/appdata';

/**
 * Lists the partner's saved payment methods. Inherits loading/error state
 * from BaseAsync. Pair with `<sail-portal-button>` for provider-side management.
 */
@Component({
  selector: 'sail-payment-methods',
  templateUrl: './payment_methods.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule],
})
export class PaymentMethodsComponent extends BaseAsync implements OnInit {
  private readonly billing = inject(BillingService);

  readonly methods = signal<PaymentMethod[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(
      this.billing.listPaymentMethods(),
      (list) => this.methods.set(list ?? []),
      'Failed to load payment methods.',
    );
  }
}
