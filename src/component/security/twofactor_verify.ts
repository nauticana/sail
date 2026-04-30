import { ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { BaseAuthService } from '../../service/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';

@Component({
  selector: 'app-twofactor-verify',
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
export class TwoFactorVerifyComponent {
  private readonly auth = inject(BaseAuthService);
  private readonly fb = inject(FormBuilder);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  readonly useBackupCode = signal(false);
  readonly errorMessage = signal('');

  readonly verifyForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
    trustDevice: [false],
  });

  toggleBackupCode() {
    this.useBackupCode.update(v => !v);
    this.verifyForm.controls.code.reset();
    this.errorMessage.set('');
  }

  verify() {
    if (this.verifyForm.invalid) return;
    this.errorMessage.set('');

    const { code, trustDevice } = this.verifyForm.value;

    if (this.useBackupCode()) {
      this.auth.verifyBackupCode(code!).subscribe({
        next: (res) => {
          if (res.valid && res.token) {
            localStorage.removeItem('loginToken');
            this.auth.token = res.token;
            this.auth.isLoggedIn.set(true);
            localStorage.setItem('jwt', res.token);
            this.auth.loadAppData();
            this.auth.initRoutes();
          } else {
            this.errorMessage.set('Invalid backup code.');
          }
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message ?? 'Backup code verification failed.');
        },
      });
    } else {
      this.auth.verify2FALogin(
        code!,
        trustDevice ?? false,
        this.getDeviceFingerprint(),
        this.getDeviceName(),
      );
    }
  }

  private getDeviceFingerprint(): string {
    let fp = localStorage.getItem('deviceFingerprint');
    if (!fp) {
      fp = crypto.randomUUID();
      localStorage.setItem('deviceFingerprint', fp);
    }
    return fp;
  }

  private getDeviceName(): string {
    return navigator.userAgent.substring(0, 80);
  }
}
