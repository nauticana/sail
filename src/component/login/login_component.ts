import { ChangeDetectionStrategy, Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseAuthService } from '../../service/auth.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  private router = inject(Router);
  protected fb = inject(FormBuilder);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
  protected readonly loggedOut = inject(ActivatedRoute).snapshot.queryParamMap.get('loggedOut') === 'true';

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
    if (this.loginForm.valid) {
      const { username, password } = this.loginForm.value;
      this.auth.login(username!, password!);
    }
  }

  /**
   * SocialLoginComponent emits the response after BaseAuthService.loginSocial
   * persists the JWT internally. Mirror the same post-login navigation that
   * password-login uses (root route by default; consumers override via
   * BaseAuthService.navigateToRoleHome when role-aware routing lands).
   */
  protected onSocialSuccess(_: LoginResponseSocial): void {
    this.router.navigateByUrl('/');
  }

  protected onSocialError(err: Error): void {
    console.error('social login failed:', err);
  }
}
