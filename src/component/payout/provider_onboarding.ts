import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { BaseAsync } from '../abstract/base_async';
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
 *   2. Start provider onboarding (/api/v1/payout/onboard/start), then
 *      either hand off to a hosted-KYC page or emit `pending` when the
 *      provider continues asynchronously without a hosted URL.
 *
 * Routing is consumer-owned via the `(linked)`, `(pending)`, and
 * `(skipped)` outputs — the component itself never calls Router.
 * Optional `title` and `skipLabel` inputs cover the common UX strings.
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
export class PayoutProviderOnboardingComponent extends BaseAsync implements OnInit {
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
  /**
   * Emitted when onboarding started but there is no hosted page to open
   * (Wise email recipients: the account is linked and awaits the
   * recipient's email confirmation). Consumers show a "linked, awaiting
   * confirmation" state instead of navigating.
   */
  readonly pending = output<void>();

  private readonly payoutService = inject(PayoutService);

  readonly reusable = signal<ReusableAccount[]>([]);
  readonly selectedAccountId = signal<string>('');

  ngOnInit() {
    this.run(
      this.payoutService.listReusable(),
      ({ accounts }) => this.reusable.set(accounts ?? []),
      'Could not check for reusable accounts.',
    );
  }

  onAccountChange(event: MatRadioChange) {
    this.selectedAccountId.set(String(event.value));
  }

  linkExisting() {
    const id = this.selectedAccountId();
    if (!id) return;
    this.run(
      this.payoutService.linkReusable(id),
      () => this.linked.emit(),
      'Failed to link existing account',
    );
  }

  startProviderKyc() {
    this.run(
      this.payoutService.startOnboarding(),
      (res) => {
        if (!res.url) {
          this.pending.emit();
          return;
        }
        this.started.emit();
        // Same-tab handoff: window.open from an async callback is popup-blocked
        // (always on Safari), which used to leave users on a "waiting" screen
        // with nothing open. Mobile webview wrappers intercept the navigation.
        window.location.assign(res.url);
      },
      'Failed to start onboarding',
    );
  }
}
