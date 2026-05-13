import { ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { BaseAuthService } from '../../service/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseAsync } from '../abstract/base_async';

@Component({
  selector: 'sail-twofactor-setup',
  templateUrl: './twofactor_setup.html',
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
export class TwoFactorSetupComponent extends BaseAsync {
  private readonly auth = inject(BaseAuthService);
  private readonly fb = inject(FormBuilder);

  readonly step = signal<'init' | 'qr' | 'verify' | 'done'>('init');
  readonly qrUri = signal('');
  readonly secret = signal('');
  readonly backupCodes = signal<string[]>([]);

  // setup2FA requires the user's current password (or current TOTP code
  // if 2FA already enabled — pass twoFactorCode instead). Disable additionally
  // requires both.
  readonly initForm = this.fb.group({
    password: ['', Validators.required],
  });

  readonly verifyForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  readonly disableForm = this.fb.group({
    password: ['', Validators.required],
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  startSetup() {
    if (this.initForm.invalid) return;
    const password = this.initForm.value.password!;
    this.run(
      this.auth.setup2FA({ password }),
      (res) => {
        this.qrUri.set(res.qrUri);
        this.secret.set(res.secret);
        this.backupCodes.set(res.backupCodes);
        this.step.set('qr');
        this.initForm.reset();
      },
      '2FA setup failed.',
    );
  }

  proceedToVerify() {
    this.step.set('verify');
  }

  confirmSetup() {
    if (this.verifyForm.invalid) return;
    const { code } = this.verifyForm.value;
    this.run(
      this.auth.verify2FA({ code: code! }),
      (res) => {
        if (res.valid) {
          this.successMessage.set('Two-factor authentication enabled.');
          this.step.set('done');
        } else {
          this.errorMessage.set('Invalid code. Please try again.');
        }
      },
      'Verification failed.',
    );
  }

  disable2FA() {
    if (this.disableForm.invalid) return;
    const { password, code } = this.disableForm.value;
    this.run(
      this.auth.disable2FA(password!, code!),
      () => {
        this.successMessage.set('Two-factor authentication disabled.');
        this.step.set('init');
        this.disableForm.reset();
      },
      'Failed to disable 2FA.',
    );
  }
}
