import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../abstract/base_async';
import { ChargeResult } from '../../model/appdata';
import { SCA_CONFIRMER } from '../../service/sca_confirmer';

/** Confirms an off-session charge through a redirect or the injected provider. */
@Component({
  selector: 'sail-sca-confirm',
  templateUrl: './sca_confirm.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule],
})
export class ScaConfirmComponent extends BaseAsync {
  private readonly confirmer = inject(SCA_CONFIRMER, { optional: true });

  readonly result = input.required<ChargeResult>();
  readonly label = input('Confirm your payment');
  readonly confirmed = output<void>();
  readonly failed = output<string>();

  readonly needsAction = computed(() => {
    const status = this.result().status;
    return status === 'requires_action' || status === 'authentication_required';
  });
  readonly declined = computed(() => this.result().status === 'failed');

  async confirm(): Promise<void> {
    if (!this.needsAction() || this.loading()) return;
    const res = this.result();
    const reconfirm = res.status === 'authentication_required';

    if (!reconfirm && res.actionUrl) {
      window.location.href = res.actionUrl;
      return;
    }

    if (!res.clientSecret) {
      this.fail('Missing client secret for SCA confirmation.');
      return;
    }
    if (reconfirm && !res.paymentMethodId) {
      this.fail('Missing payment method for re-confirmation.');
      return;
    }
    if (!this.confirmer) {
      this.fail('No SCA confirmer is configured. Provide SCA_CONFIRMER (e.g. a Stripe.js wrapper).');
      return;
    }

    this.clearMessages();
    this.loading.set(true);
    try {
      const out = reconfirm
        ? await this.confirmer.confirmWithMethod(res.clientSecret, res.paymentMethodId!)
        : await this.confirmer.confirm(res.clientSecret);
      this.loading.set(false);
      if (out.outcome === 'succeeded') {
        this.confirmed.emit();
      } else {
        this.fail(out.error ?? 'Payment confirmation was not completed.');
      }
    } catch (e: unknown) {
      this.loading.set(false);
      this.fail(e instanceof Error ? e.message : 'Payment confirmation failed.');
    }
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.failed.emit(message);
  }
}
