import {
  ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * OtpInput — numeric OTP entry with resend countdown. A real (styleable)
 * input drives the digit boxes, so typing, paste, and one-time-code
 * autofill all work; the keypad is a touch-friendly supplement.
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
export class OtpInputComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly length = input(6);
  readonly contact = input('');
  // Fallback only. Consumers should pass the value returned by
  // /public/otp/send in `resendCountdownSec` — the authoritative TTL from
  // keel's --otp_token_ttl_seconds. The countdown restarts when it changes.
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

  readonly code = computed(() => this.digits().join(''));

  readonly keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

  constructor() {
    effect(() => { this.digits.set(Array(this.length()).fill('')); });
    // Restarts when the parent binds the authoritative TTL (arrives async).
    effect(() => {
      const ttl = this.resendCountdownSec();
      this.startCountdown(ttl);
    });
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  onCodeInput(event: Event) {
    if (this.disabled()) return;
    const target = event.target as HTMLInputElement;
    const raw = target.value.replace(/\D/g, '').slice(0, this.length());
    target.value = raw;
    this.setCode(raw);
  }

  private setCode(raw: string) {
    const d = Array<string>(this.length()).fill('');
    for (let i = 0; i < raw.length; i++) d[i] = raw[i];
    this.digits.set(d);
    if (raw.length === this.length()) this.codeComplete.emit(raw);
  }

  onKeyPress(key: string) {
    if (this.disabled()) return;
    const current = this.code();
    if (current.length >= this.length()) return;
    this.setCode(current + key);
  }

  onBackspace() {
    if (this.disabled()) return;
    this.setCode(this.code().slice(0, -1));
  }

  onResend() {
    this.resend.emit();
    this.digits.set(Array(this.length()).fill(''));
    this.startCountdown(this.resendCountdownSec());
  }

  private startCountdown(seconds: number) {
    this.clearTimer();
    this.countdown.set(seconds);
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
