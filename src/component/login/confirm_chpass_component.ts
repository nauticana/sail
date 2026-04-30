import { ChangeDetectionStrategy, Component, inject, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';

@Component({
  selector: 'app-confirm-chpass',
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
export class ConfirmChpassComponent implements OnInit {
  private auth = inject(BaseAuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  errorMessage = signal('');
  successMessage = signal('');

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
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.confirmForm.invalid) return;

    const { username, code, new_password, confirm_password } = this.confirmForm.value;

    if (new_password !== confirm_password) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.auth.confirmChpass(username!, code!, new_password!).subscribe({
      next: () => {
        this.successMessage.set('Password changed successfully. Redirecting to login...');
        this.router.navigate(['/login/local']);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message ?? 'Confirmation failed. Please try again.');
      },
    });
  }
}
