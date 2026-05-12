import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
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
  template: `
    <div class="payout-onboarding">
      <h2 class="payout-onboarding__title">{{ title }}</h2>

      <p class="payout-onboarding__intro">
        Bank routing details are collected by the payout provider, not
        this application. After this step the provider will run KYC and
        notify us when the account is ready for payouts.
      </p>

      @if (reusable().length > 0) {
        <mat-card class="reuse-card">
          <mat-card-header>
            <mat-card-title>Reuse an existing account</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="hint">
              You already have a payout account on
              {{ reusable().length === 1 ? 'another partner' : 'other partners' }}.
              You can reuse it here (no KYC redo) if the currency matches.
            </p>
            <mat-radio-group [value]="selectedAccountId()" (change)="selectAccount($any($event.value))">
              @for (acc of reusable(); track acc.providerAccountId) {
                <mat-radio-button [value]="acc.providerAccountId" class="reuse-option">
                  <strong>{{ acc.partnerCaption }}</strong>
                  — {{ acc.countryCode }} / {{ acc.currency }} ({{ acc.provider }})
                </mat-radio-button>
              }
            </mat-radio-group>
            <button mat-flat-button class="payout-onboarding__btn payout-onboarding__btn--primary"
                    [disabled]="!selectedAccountId() || busy()"
                    (click)="linkExisting()">
              Use this account
            </button>
          </mat-card-content>
        </mat-card>
      }

      <mat-card>
        <mat-card-header>
          <mat-card-title>Set up a new account</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="hint">
            Opens the provider's secure onboarding page. You'll be asked
            for bank routing details and government ID. The process
            usually takes a few minutes.
          </p>
          @if (errorMsg()) {
            <p class="payout-onboarding__error">{{ errorMsg() }}</p>
          }
          <button mat-flat-button class="payout-onboarding__btn payout-onboarding__btn--primary"
                  [disabled]="busy()"
                  (click)="startProviderKyc()">
            <mat-icon>open_in_new</mat-icon>
            Start onboarding
          </button>
        </mat-card-content>
      </mat-card>

      <div class="payout-onboarding__nav">
        @if (showBack) {
          <button mat-stroked-button class="payout-onboarding__btn" type="button" (click)="back.emit()">
            &lt; Back
          </button>
        }
        <button mat-stroked-button class="payout-onboarding__btn" type="button" (click)="skipped.emit()">
          {{ skipLabel }}
        </button>
      </div>
    </div>
  `,
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
  @Input() title = 'Bank Account Setup';
  /** Skip-button label — covers wizards where skipping returns to the parent flow. */
  @Input() skipLabel = "I'll do this later";
  /** When true, the back button renders alongside skip. */
  @Input() showBack = true;

  /** Emitted after a successful reuse-link operation. */
  @Output() linked = new EventEmitter<void>();
  /** Emitted when the user dismisses the step (skip). */
  @Output() skipped = new EventEmitter<void>();
  /** Emitted when the user clicks Back. */
  @Output() back = new EventEmitter<void>();
  /** Emitted after the hosted page is opened in a new tab. Consumers can route away or show a "waiting on provider" screen. */
  @Output() started = new EventEmitter<void>();

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
