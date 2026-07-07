import { ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { BaseAuthService } from '../../service/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { BaseAsync } from '../abstract/base_async';

@Component({
  selector: 'sail-twofactor-verify',
  templateUrl: './twofactor_verify.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    RouterLink,
  ],
})
export class TwoFactorVerifyComponent extends BaseAsync {
  private readonly auth = inject(BaseAuthService);
  private readonly fb = inject(FormBuilder);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  readonly useBackupCode = signal(false);

  readonly verifyForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
    trustDevice: [false],
  });

  toggleBackupCode() {
    this.useBackupCode.update(v => !v);
    this.verifyForm.controls.code.reset();
    this.clearMessages();
  }

  verify() {
    if (this.verifyForm.invalid) return;
    const { code, trustDevice } = this.verifyForm.value;

    if (this.useBackupCode()) {
      // verifyBackupCode completes the login inside BaseAuthService.
      this.run(
        this.auth.verifyBackupCode(code!),
        (res) => {
          if (!res.valid || !res.token) {
            this.errorMessage.set('Invalid backup code.');
          }
        },
        'Backup code verification failed.',
      );
    } else {
      this.run(
        this.auth.verify2FALogin(code!, trustDevice ?? false, this.getDeviceName()),
        (res) => {
          if (!res.valid || !res.token) {
            this.errorMessage.set('Invalid authentication code.');
          }
        },
        'Verification failed. Please try again.',
      );
    }
  }

  private getDeviceName(): string {
    return navigator.userAgent.substring(0, 80);
  }
}
