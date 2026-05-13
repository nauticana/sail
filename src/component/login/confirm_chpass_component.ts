import { ChangeDetectionStrategy, Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { BaseAsync } from '../abstract/base_async';

@Component({
  selector: 'sail-confirm-chpass',
  templateUrl: './confirm_chpass_component.html',
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
export class ConfirmChpassComponent extends BaseAsync implements OnInit {
  private auth = inject(BaseAuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  confirmForm = this.fb.group({
    username: ['', Validators.required],
    code: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(6)]],
    confirm_password: ['', Validators.required],
  });

  ngOnInit() {
    const username = this.route.snapshot.queryParamMap.get('username');
    if (username) {
      this.confirmForm.patchValue({ username });
    }
  }

  confirm(): void {
    if (this.confirmForm.invalid) return;

    const { username, code, new_password, confirm_password } = this.confirmForm.value;

    if (new_password !== confirm_password) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.run(
      this.auth.confirmChpass(username!, code!, new_password!),
      () => {
        this.successMessage.set('Password changed successfully. Redirecting to login...');
        this.router.navigate(['/login/local']);
      },
      'Confirmation failed. Please try again.',
    );
  }
}
