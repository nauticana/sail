import {
  ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { BaseAsync } from '../abstract/base_async';
import { BaseAuthService } from '../../service/auth.service';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';

/**
 * AccountDeletionComponent — App Store / Play Store compliance surface.
 *
 * Typed-confirmation UX (standard anti-fat-finger pattern): user must type
 * the literal `confirmationText` (default "DELETE") before the destructive
 * button enables. Optional `reason` textarea forwarded to the backend's
 * DELETE /api/user/account for the audit trail.
 *
 * On success: local session cleared by BaseAuthService.deleteAccount; this
 * component then navigates to `config.accountDeletedRoute` (default
 * `/login/local`).
 */
@Component({
  selector: 'app-account-deletion',
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

  readonly form = this.fb.nonNullable.group({
    confirm:  ['', Validators.required],
    password: ['', Validators.required],   // re-auth gate required by keel
    reason:   [''],
  });

  readonly typedValue = signal('');
  readonly canSubmit = computed(() =>
    this.typedValue() === this.confirmationText() &&
    !!this.form.controls.password.value &&
    !this.loading(),
  );

  constructor() {
    super();
    this.form.controls.confirm.valueChanges.subscribe((v) => this.typedValue.set(v ?? ''));
  }

  onDelete() {
    if (!this.canSubmit()) return;
    const password = this.form.controls.password.value;
    const reason = this.form.controls.reason.value?.trim() || undefined;
    this.run(
      this.auth.deleteAccount({ password }, reason),
      () => {
        this.successMessage.set('Account deleted.');
        const route = this.guiConfig.accountDeletedRoute ?? '/login/local';
        this.router.navigateByUrl(route);
      },
      'Failed to delete account. Please try again.',
    );
  }
}
