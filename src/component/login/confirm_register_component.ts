import { ChangeDetectionStrategy, Component, inject, OnInit, ViewEncapsulation, ElementRef } from '@angular/core';
import { submittable } from '../../util/forms';
import { FieldError } from '../form/field_error';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
    FieldError, ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
})
export class ConfirmRegisterComponent extends BaseAsync implements OnInit {
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private auth = inject(BaseAuthService);
  private fb = inject(FormBuilder);
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
    if (!submittable(this.confirmForm, this.host)) return;

    const { email, code } = this.confirmForm.value;

    this.run(
      this.auth.confirmRegister(email!, code!),
      (resp) => {
        this.successMessage.set('Registration confirmed.');
        // confirmRegister signed the user in and owns navigation; only a paid
        // plan's checkout leaves the SPA (window.location: it is cross-origin).
        if (resp?.paymentRequired && resp.paymentUrl) {
          window.location.href = resp.paymentUrl;
        }
      },
      'Confirmation failed. Please try again.',
    );
  }
}
