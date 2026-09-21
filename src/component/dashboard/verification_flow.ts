import {
  ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation,
  inject, input, output, signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VerificationStep } from '../../model/dashboard';

/**
 * Self-service verification flow — a sibling to the 2FA verify component, but
 * backend-agnostic: it owns the request → enter-code → confirmed UI and emits
 * `requestVerification` / `confirmCode`, while the host wires the actual endpoints
 * and feeds `step` + `errorMessage` back (daxoom wires business verify/confirm).
 */
@Component({
  selector: 'sail-verification-flow',
  templateUrl: './verification_flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class VerificationFlowComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly step = input<VerificationStep>('idle');
  readonly errorMessage = input<string>('');
  /** The email/phone/identifier being verified, shown in the copy. */
  readonly target = input<string>('');
  /** Seconds before `Resend code` re-enables; 0 leaves it always enabled. */
  readonly resendAfterSeconds = input(0);
  /** Seconds the issued code stays valid; 0 shows no expiry and never blocks confirm. */
  readonly codeExpiresInSeconds = input(0);
  /** Prevent interaction while the host is processing a request. */
  readonly disabled = input(false);

  readonly requestVerification = output<void>();
  readonly confirmCode = output<string>();

  readonly code = signal('');
  readonly resendIn = signal(0);
  readonly expiresIn = signal(0);
  readonly expired = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  submit(): void {
    const c = this.code().trim();
    if (c && !this.expired() && !this.disabled()) {
      this.confirmCode.emit(c);
    }
  }

  /** Both the first request and a resend restart the countdowns, as the OTP input does. */
  request(): void {
    if (this.disabled()) return;
    this.requestVerification.emit();
    this.startCountdowns();
  }

  private startCountdowns(): void {
    this.clearTimer();
    this.code.set('');
    this.expired.set(false);
    this.resendIn.set(this.resendAfterSeconds());
    this.expiresIn.set(this.codeExpiresInSeconds());
    if (this.resendIn() > 0 || this.expiresIn() > 0) {
      this.timer = setInterval(() => this.tick(), 1000);
    }
  }

  private tick(): void {
    if (this.resendIn() > 0) this.resendIn.update((s) => s - 1);
    if (this.expiresIn() > 0) {
      this.expiresIn.update((s) => s - 1);
      if (this.expiresIn() === 0) this.expired.set(true);
    }
    if (this.resendIn() === 0 && this.expiresIn() === 0) this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
