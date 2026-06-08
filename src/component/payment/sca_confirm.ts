import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../abstract/base_async';
import { ChargeResult } from '../../model/appdata';
import { SCA_CONFIRMER } from '../../service/sca_confirmer';

/**
 * Drives the SCA / 3DS confirmation for an off-session `ChargeResult`.
 *
 * Two confirmation paths, mirroring keel's `ChargeResult`:
 *  - `actionUrl` present → redirect to the provider-hosted challenge
 *    (provider-agnostic; the page navigates away).
 *  - otherwise `clientSecret` → delegate to the injected `SCA_CONFIRMER`
 *    (the app's provider SDK wrapper). No confirmer is bundled in sail.
 *
 * Renders nothing for a `succeeded` result; shows the decline message for
 * `failed`; shows a confirm button for `requires_action`. Emits `(confirmed)`
 * on success and `(failed)` with a message on any error — never silently.
 */
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

  readonly needsAction = computed(() => this.result().status === 'requires_action');
  readonly declined = computed(() => this.result().status === 'failed');

  async confirm(): Promise<void> {
    const res = this.result();

    // Provider-hosted redirect branch — provider-agnostic; navigates away.
    if (res.actionUrl) {
      window.location.href = res.actionUrl;
      return;
    }

    // Inline confirmation branch — delegates to the app's provider impl.
    if (!res.clientSecret) {
      this.fail('Missing client secret for SCA confirmation.');
      return;
    }
    if (!this.confirmer) {
      this.fail('No SCA confirmer is configured. Provide SCA_CONFIRMER (e.g. a Stripe.js wrapper).');
      return;
    }

    this.clearMessages();
    this.loading.set(true);
    try {
      const out = await this.confirmer.confirm(res.clientSecret);
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
