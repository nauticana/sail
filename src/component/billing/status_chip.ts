import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BaseAuthService } from '../../service/auth.service';

/**
 * Status chip/label that resolves a code to its caption from the client cache
 * `constant_value` dictionary — no per-app `@switch`. Defaults to the
 * `SUBSCRIPTION_STATUS` domain (A active / T trialing / X past-due / …) but
 * works for any constant domain via `[domain]`.
 *
 * The caption is backend-authoritative (read from the dictionary); when the
 * domain row is absent the raw code is shown rather than a fabricated label.
 * `[attr.data-status]` carries the code so the consuming app can colour the
 * chip per status (the library ships no CSS).
 */
@Component({
  selector: 'sail-status-chip',
  templateUrl: './status_chip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StatusChipComponent {
  private readonly auth = inject(BaseAuthService);

  /** The code to resolve (e.g. a Subscription.status value). */
  readonly value = input<string>('');
  /** Constant-value domain to look the caption up in. */
  readonly domain = input<string>('SUBSCRIPTION_STATUS');

  // Recompute when the cache (app data) loads or the inputs change.
  private readonly appData = toSignal(this.auth.getAppData());

  readonly caption = computed<string>(() => {
    this.appData(); // dependency: re-read the dictionary once the cache is hydrated
    const code = this.value();
    const match = this.auth.getDomainValues(this.domain())?.find((v) => v.Value === code);
    return match?.Caption ?? code;
  });
}
