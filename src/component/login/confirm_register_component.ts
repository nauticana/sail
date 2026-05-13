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
  selector: 'sail-confirm-register',
  templateUrl: './confirm_register_component.html',
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
export class ConfirmRegisterComponent extends BaseAsync implements OnInit {
  private auth = inject(BaseAuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;

  confirmForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    code: ['', Validators.required],
  });

  ngOnInit() {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.confirmForm.patchValue({ email });
    }
  }

  confirm(): void {
    if (this.confirmForm.invalid) return;

    const { email, code } = this.confirmForm.value;

    this.run(
      this.auth.confirmRegister(email!, code!),
      (resp) => {
        this.successMessage.set('Registration confirmed.');
        if (resp?.paymentRequired && resp.paymentUrl) {
          // Paid plan: go straight to payment. Subscription is 'P' until paid.
          // Using window.location (not router) so absolute / cross-origin
          // payment URLs also work.
          window.location.href = resp.paymentUrl;
          return;
        }
        // Free plan: land on login.
        this.router.navigate(['/login/local']);
      },
      'Confirmation failed. Please try again.',
    );
  }
}
