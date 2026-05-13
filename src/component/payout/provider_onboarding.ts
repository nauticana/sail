import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { PayoutService } from '../../service/payout.service';
import { ReusableAccount } from '../../model/appdata';

/**
 * Payout provider onboarding step.
 *
 * Drop-in screen for any keel-backed app that uses keel/payout. Renders
 * two paths:
 *   1. Reuse an existing provider account from another partner row
 *      (zero-KYC; calls /api/v1/payout/reusable/link).
 *   2. Launch the provider's hosted-KYC page in a new tab
 *      (/api/v1/payout/onboard/start).
 *
 * Routing is consumer-owned via the `(linked)` / `(skipped)` outputs —
 * the component itself never calls Router. Optional `title` and
 * `skipLabel` inputs cover the common UX strings.
 *
 * Selector: <sail-payout-provider-onboarding>
 */
@Component({
  selector: 'sail-payout-provider-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatRadioModule],
  templateUrl: './provider_onboarding.html',
  styles: `
    .payout-onboarding { display: flex; flex-direction: column; gap: 16px; padding: 0 24px 32px; }
    .payout-onboarding__title { margin: 0; }
    .payout-onboarding__intro { font-size: 14px; color: var(--mat-app-on-surface-variant, #555); margin: 0; }
    .reuse-card { background: var(--mat-app-surface-variant, #f5f5f5); }
    .reuse-option { display: block; margin: 8px 0; }
    .hint { font-size: 13px; color: var(--mat-app-on-surface-variant, #555); margin: 0 0 12px; }
    .payout-onboarding__error { color: var(--mat-app-error, #b00020); font-size: 13px; margin: 0 0 12px; }
    .payout-onboarding__nav { display: flex; gap: 12px; margin-top: 8px; }
    .payout-onboarding__btn { border-radius: 24px; height: 48px; font-size: 15px; font-weight: 600; flex: 1; }
    .payout-onboarding__btn--primary { background: var(--mat-app-primary, #1976d2); color: white; }
  `,
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
  /** Emitted after the hosted page is opened in a new tab. Consumers can route away or show a "waiting on provider" screen. */
  readonly started = output<void>();

  private readonly payoutService = inject(PayoutService);

  readonly reusable = signal<ReusableAccount[]>([]);
  readonly selectedAccountId = signal<string>('');
  readonly busy = signal<boolean>(false);
  readonly errorMsg = signal<string>('');

  ngOnInit() {
    this.payoutService.listReusable().subscribe({
      next: ({ accounts }) => this.reusable.set(accounts ?? []),
      error: () => this.reusable.set([]),
    });
  }

  selectAccount(id: string) {
    this.selectedAccountId.set(id);
  }

  linkExisting() {
    const id = this.selectedAccountId();
    if (!id) return;
    this.busy.set(true);
    this.payoutService.linkReusable(id).subscribe({
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
    this.payoutService.startOnboarding().subscribe({
      next: (res) => {
        this.busy.set(false);
        // Open in the platform browser. Mobile webview wrappers
        // intercept this and pop the system browser so the provider
        // page works in its expected environment.
        window.open(res.url, '_blank');
        this.started.emit();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'Failed to start onboarding');
        this.busy.set(false);
      },
    });
  }
}
