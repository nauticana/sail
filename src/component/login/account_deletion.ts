import {
  ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, linkedSignal, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { BaseAsync } from '../abstract/base_async';
import { BaseAuthService } from '../../service/auth.service';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { ReauthCredentials } from '../../model/auth';

/**
 * AccountDeletionComponent — App Store / Play Store compliance surface.
 *
 * The destructive button enables once the user types `confirmationText`
 * (default "DELETE") and re-authenticates with a password or, for accounts
 * without one, a one-time code (`reauthMethod`, switchable in the form).
 * The optional reason is forwarded to DELETE /api/user/account for audit.
 * On success the session is cleared and the router goes to
 * `config.accountDeletedRoute` (default `/login/local`).
 */
@Component({
  selector: 'sail-account-deletion',
  templateUrl: './account_deletion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
})
export class AccountDeletionComponent extends BaseAsync {
  private readonly auth = inject(BaseAuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly guiConfig: SailGuiConfig =
    inject(SAIL_GUI_CONFIG, { optional: true }) ?? DEFAULT_CONFIG;

  readonly confirmationText = input('DELETE');
  readonly reauthMethod = input<'password' | 'code'>('password');
  readonly method = linkedSignal(() => this.reauthMethod());
  readonly codeSent = signal(false);

  readonly form = this.fb.nonNullable.group({
    confirm:    ['', Validators.required],
    credential: ['', Validators.required],
    reason:     [''],
  });

  private readonly confirmValue = toSignal(this.form.controls.confirm.valueChanges, { initialValue: '' });
  private readonly credentialValue = toSignal(this.form.controls.credential.valueChanges, { initialValue: '' });
  readonly canSubmit = computed(() =>
    this.confirmValue() === this.confirmationText() &&
    !!this.credentialValue() &&
    !this.loading(),
  );

  toggleMethod() {
    this.method.update((m) => m === 'password' ? 'code' : 'password');
    this.codeSent.set(false);
    this.form.controls.credential.reset();
    this.clearMessages();
  }

  sendCode() {
    this.run(this.auth.sendReauthCode(), (res) => {
      this.codeSent.set(true);
      this.successMessage.set(`A code was sent to your ${res.channel}.`);
    }, 'Failed to send a code. Please try again.');
  }

  onDelete() {
    if (!this.canSubmit()) return;
    const credential = this.form.controls.credential.value;
    const reauth: ReauthCredentials = this.method() === 'code' ? { reauthCode: credential } : { password: credential };
    const reason = this.form.controls.reason.value.trim() || undefined;
    this.run(
      this.auth.deleteAccount(reauth, reason),
      () => this.router.navigateByUrl(this.guiConfig.accountDeletedRoute ?? '/login/local'),
      'Failed to delete account. Please try again.',
    );
  }
}
