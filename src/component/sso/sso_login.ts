import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ssoStartUrl } from '../../util/sso';

/**
 * Organization sign-in: sends the browser to keel's `/public/sso/start` for the
 * entered address. A top-level navigation, because keel binds the sign-in to an
 * HttpOnly cookie on the API host.
 *
 * Selector: <sail-sso-login>
 */
@Component({
  selector: 'sail-sso-login',
  templateUrl: './sso_login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class SsoLoginComponent {
  readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });

  continue(): void {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    window.location.assign(ssoStartUrl(this.email.value));
  }
}
