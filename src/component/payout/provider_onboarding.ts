import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { PayoutService } from '../../service/payout.service';
import { ReusableAccount } from '../../model/appdata';

/**
 * Payout provider onboarding step.
 *
 * Drop-in screen for any keel-backed app that uses keel/payout. Renders
 * two paths:
 *   1. Reuse an existing provider account from another partner row
 *      (zero-KYC; calls /api/v1/payout/reusable/link).
 *   2. Hand off to the provider's hosted-KYC page
 *      (/api/v1/payout/onboard/start).
 *
 * Routing is consumer-owned via the `(linked)` / `(skipped)` outputs —
 * the component itself never calls Router. Optional `title` and
 * `skipLabel` inputs cover the common UX strings.
 *
 * Ships no CSS — the consuming app styles the classes globally.
 *
 * Selector: <sail-payout-provider-onboarding>
 */
@Component({
  selector: 'sail-payout-provider-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatRadioModule],
  templateUrl: './provider_onboarding.html',
})
export class PayoutProviderOnboardingComponent implements OnInit {
  /** Step title — defaults match the most common payout-step framing. */
  readonly title = input('Bank Account Setup');
  /** Skip-button label — covers wizards where skipping returns to the parent flow. */
  readonly skipLabel = input("I'll do this later");
  /** When true, the back button renders alongside skip. */
  readonly showBack = input(true);

  /** Emitted after a successful reuse-link operation. */
  readonly linked = output<void>();
  /** Emitted when the user dismisses the step (skip). */
  readonly skipped = output<void>();
  /** Emitted when the user clicks Back. */
  readonly back = output<void>();
  /** Emitted just before handing off to the hosted-KYC page. */
  readonly started = output<void>();

  private readonly payoutService = inject(PayoutService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reusable = signal<ReusableAccount[]>([]);
  readonly selectedAccountId = signal<string>('');
  readonly busy = signal<boolean>(false);
  readonly errorMsg = signal<string>('');

  ngOnInit() {
    this.payoutService.listReusable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ accounts }) => this.reusable.set(accounts ?? []),
      error: () => {
        this.reusable.set([]);
        this.errorMsg.set('Could not check for reusable accounts.');
      },
    });
  }

  onAccountChange(event: MatRadioChange) {
    this.selectedAccountId.set(String(event.value));
  }

  linkExisting() {
    const id = this.selectedAccountId();
    if (!id) return;
    this.busy.set(true);
    this.payoutService.linkReusable(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.linked.emit();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'Failed to link existing account');
        this.busy.set(false);
      },
    });
  }

  startProviderKyc() {
    this.busy.set(true);
    this.payoutService.startOnboarding().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.started.emit();
        // Same-tab handoff: window.open from an async callback is popup-blocked
        // (always on Safari), which used to leave users on a "waiting" screen
        // with nothing open. Mobile webview wrappers intercept the navigation.
        window.location.assign(res.url);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'Failed to start onboarding');
        this.busy.set(false);
      },
    });
  }
}
