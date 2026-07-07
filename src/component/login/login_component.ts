import { ChangeDetectionStrategy, Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from '@angular/material/input';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import { LoginResponseSocial, SocialProvider } from '../../model/auth';
import { SocialLoginComponent } from './social_login';

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
  ],
})
export class LoginComponent {
  private auth = inject(BaseAuthService);
  protected fb = inject(FormBuilder);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
  protected readonly loggedOut = inject(ActivatedRoute).snapshot.queryParamMap.get('loggedOut') === 'true';
  /** OAuth session-cookie handoff failure from BaseAuthService, shown below. */
  protected readonly sessionHandoffError = this.auth.sessionHandoffError;

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

  protected readonly loading = signal(false);
  protected readonly loginError = signal('');

  login(): void {
    if (!this.loginForm.valid) return;
    const { username, password } = this.loginForm.value;
    this.loading.set(true);
    this.loginError.set('');
    this.auth.login(username!, password!).subscribe({
      next: () => this.loading.set(false),
      error: (err) => {
        this.loading.set(false);
        this.loginError.set(err?.status === 401
          ? 'Invalid username or password.'
          : 'Login failed. Please try again.');
      },
    });
  }

  /**
   * loginSocial already ran completeLogin, which owns post-login navigation
   * (route init, or the OAuth cookie handoff). Handlers must NOT navigate here —
   * doing so abandons a pending handoff before its cookie is set. Downstream
   * social-login handlers should follow the same rule.
   */
  protected onSocialSuccess(_: LoginResponseSocial): void {}

  protected onSocialError(err: Error): void {
    console.error('social login failed:', err);
  }
}
