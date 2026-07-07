import { ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { BaseAsync } from '../abstract/base_async';

@Component({
  selector: 'sail-chpass',
  templateUrl: './chpass_component.html',
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
export class ChpassComponent extends BaseAsync {
  private auth = inject(BaseAuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  forgotPassword = signal(false);

  chpassForm = this.fb.group({
    username: ['', Validators.required],
    old_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(6)]],
    confirm_password: ['', Validators.required],
  });

  toggleForgotPassword(checked: boolean) {
    this.forgotPassword.set(checked);
    const oldPw = this.chpassForm.get('old_password')!;
    const newPw = this.chpassForm.get('new_password')!;
    const confirmPw = this.chpassForm.get('confirm_password')!;
    if (checked) {
      oldPw.clearValidators();
      oldPw.setValue('');
      newPw.clearValidators();
      newPw.setValue('');
      confirmPw.clearValidators();
      confirmPw.setValue('');
    } else {
      oldPw.setValidators(Validators.required);
      newPw.setValidators([Validators.required, Validators.minLength(6)]);
      confirmPw.setValidators(Validators.required);
    }
    oldPw.updateValueAndValidity();
    newPw.updateValueAndValidity();
    confirmPw.updateValueAndValidity();
  }

  changePassword(): void {
    if (this.chpassForm.invalid) return;

    const { username, old_password, new_password, confirm_password } = this.chpassForm.value;

    if (new_password !== confirm_password) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    const isForgot = this.forgotPassword();
    const request = isForgot
      ? this.auth.forgotPassword(username!)
      : this.auth.chpass(username!, new_password!, old_password!);

    this.run(
      request,
      () => {
        if (isForgot) {
          this.router.navigate(['/confirm/password'], { queryParams: { username } });
        } else {
          this.successMessage.set('Password changed successfully.');
        }
      },
      'Password change failed. Please try again.',
    );
  }
}
