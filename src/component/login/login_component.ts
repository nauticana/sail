import { ChangeDetectionStrategy, Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { BaseAsync } from '../abstract/base_async';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from '@angular/material/input';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { LoginResponseSocial, SocialProvider } from '../../model/auth';
import { SocialLoginComponent } from './social_login';
import { SsoLoginComponent } from '../sso/sso_login';

@Component({
  selector: 'sail-login',
  templateUrl: './login_component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
    SocialLoginComponent,
    SsoLoginComponent,
  ],
})
export class LoginComponent extends BaseAsync {
  protected readonly auth = inject(BaseAuthService);
  protected fb = inject(FormBuilder);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
  private readonly queryParams = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly loggedOut = this.queryParams.get('loggedOut') === 'true';
  protected readonly passwordChanged = this.queryParams.get('passwordChanged') === 'true';
  /** OAuth session hand-off failure from BaseAuthService, shown below. */
  protected readonly sessionHandoffError = this.auth.sessionHandoffError;
  protected readonly signInPrompt = this.auth.signInPrompt;

  /**
   * Auto-show the embedded SocialLoginComponent whenever at least one
   * provider is configured in SailGuiConfig. Consumers that don't set
   * googleClientId/appleServiceId see no change; consumers that do get a
   * working social-login surface inside the standard /login route — no
   * wrapper component required.
   */
  protected readonly enabledSocialProviders = computed<SocialProvider[]>(() => {
    const providers: SocialProvider[] = [];
    if (this.guiConfig.googleClientId)  providers.push('google');
    if (this.guiConfig.appleServiceId)  providers.push('apple');
    return providers;
  });
  protected readonly showSocialLogin = computed(() => this.enabledSocialProviders().length > 0);

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  login(): void {
    if (!this.loginForm.valid) return;
    const { username, password } = this.loginForm.value;
    this.run(
      this.auth.login(username!, password!),
      () => {},
      'Invalid username or password.',
    );
  }

  /**
   * loginSocial already ran completeLogin, which owns post-login navigation
   * (route init, or the OAuth session hand-off). Handlers must NOT navigate here —
   * doing so abandons a pending hand-off before it redirects. Downstream
   * social-login handlers should follow the same rule.
   */
  protected onSocialSuccess(_: LoginResponseSocial): void {}

  protected onSocialError(err: Error): void {
    console.error('social login failed:', err);
  }
}
