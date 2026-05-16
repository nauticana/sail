import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, ViewEncapsulation,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * OtpInput — pure-presentational numeric OTP keypad with resend countdown.
 *
 * Owns no service layer. The parent component sends the OTP (via
 * BaseAuthService.sendOtp) and subscribes to `codeComplete` / `resend` to
 * call verifyOtp / resendOtp. See README "Phone / email OTP login".
 */
@Component({
  selector: 'sail-otp-input',
  templateUrl: './otp_input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule],
})
export class OtpInputComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly length = input(6);
  readonly contact = input('');
  // Fallback only. Consumers should pass the value returned by
  // /public/otp/send in `resendCountdownSec` on the response — that is
  // the authoritative value (sourced from the keel server's
  // --otp_token_ttl_seconds flag and matches the lifetime of the OTP
  // code itself). 300s is the legacy default, kept so existing callers
  // without the new field don't break.
  readonly resendCountdownSec = input(300);
  readonly disabled = input(false);

  readonly codeComplete = output<string>();
  readonly resend = output<void>();

  readonly digits = signal<string[]>([]);
  readonly countdown = signal(0);
  readonly canResend = signal(false);

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly currentIndex = computed(() => {
    const d = this.digits();
    const idx = d.findIndex((v) => v === '');
    return idx === -1 ? d.length - 1 : idx;
  });

  readonly keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

  constructor() {
    // Reset the digits array whenever `length` input changes.
    effect(() => { this.digits.set(Array(this.length()).fill('')); });
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  ngOnInit() {
    this.startCountdown();
  }

  onKeyPress(key: string) {
    if (this.disabled()) return;
    const d = [...this.digits()];
    const idx = d.findIndex((v) => v === '');
    if (idx === -1) return;
    d[idx] = key;
    this.digits.set(d);
    if (idx === this.length() - 1) this.codeComplete.emit(d.join(''));
  }

  onBackspace() {
    if (this.disabled()) return;
    const d = [...this.digits()];
    let idx = d.findIndex((v) => v === '');
    if (idx === -1) idx = d.length;
    if (idx > 0) {
      d[idx - 1] = '';
      this.digits.set(d);
    }
  }

  onResend() {
    this.resend.emit();
    this.digits.set(Array(this.length()).fill(''));
    this.startCountdown();
  }

  private startCountdown() {
    this.clearTimer();
    this.countdown.set(this.resendCountdownSec());
    this.canResend.set(false);
    this.countdownTimer = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) {
        this.canResend.set(true);
        this.clearTimer();
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
