import {
  ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, ViewEncapsulation,
  inject, input, output,
} from '@angular/core';
import { BaseAsync } from '../abstract/base_async';
import { BaseAuthService } from '../../service/auth.service';
import { loadScript } from '../../service/script_loader';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import {
  ConsentState, LoginResponseSocial, SignupConsent, SocialProvider,
} from '../../model/auth';

declare const google: any;
declare const AppleID: any;

const GSI_URL   = 'https://accounts.google.com/gsi/client';
const APPLE_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/**
 * SocialLoginComponent — renders "Sign in with Google" / "Sign in with Apple"
 * buttons using each provider's official SDK.
 *
 * Flow: click → SDK returns ID token → BaseAuthService.loginSocial(provider,
 * idToken, signupConsent) → emits loginSuccess / loginError.
 *
 * Requires `googleClientId` / `appleServiceId` in SailGuiConfig; providers
 * without config are hidden (with a console.warn for diagnostics).
 */
@Component({
  selector: 'sail-social-login',
  templateUrl: './social_login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
})
export class SocialLoginComponent extends BaseAsync implements OnInit {
  private readonly auth = inject(BaseAuthService);
  protected readonly guiConfig: SailGuiConfig =
    inject(SAIL_GUI_CONFIG, { optional: true }) ?? DEFAULT_CONFIG;

  readonly providers = input<SocialProvider[]>(['google']);
  readonly consent = input<ConsentState | undefined>(undefined);

  readonly loginSuccess = output<LoginResponseSocial>();
  readonly loginError = output<Error>();

  @ViewChild('googleBtn', { static: false }) googleBtn?: ElementRef<HTMLDivElement>;

  protected googleEnabled = false;
  protected appleEnabled = false;

  ngOnInit() {
    this.googleEnabled = this.providers().includes('google') && !!this.guiConfig.googleClientId;
    this.appleEnabled  = this.providers().includes('apple')  && !!this.guiConfig.appleServiceId;

    if (this.providers().includes('google') && !this.guiConfig.googleClientId) {
      console.warn('SocialLoginComponent: googleClientId missing from SailGuiConfig — Google button hidden');
    }
    if (this.providers().includes('apple') && !this.guiConfig.appleServiceId) {
      console.warn('SocialLoginComponent: appleServiceId missing from SailGuiConfig — Apple button hidden');
    }

    if (this.googleEnabled) this.initGoogle();
    if (this.appleEnabled)  this.initApple();
  }

  private async initGoogle() {
    await loadScript(GSI_URL);
    google.accounts.id.initialize({
      client_id: this.guiConfig.googleClientId,
      callback: (res: { credential: string }) => this.onIdToken('google', res.credential),
    });
    // Render into the template anchor once the view is ready.
    queueMicrotask(() => {
      if (this.googleBtn?.nativeElement) {
        google.accounts.id.renderButton(this.googleBtn.nativeElement, { theme: 'outline', size: 'large' });
      }
    });
  }

  private async initApple() {
    await loadScript(APPLE_URL);
    AppleID.auth.init({
      clientId: this.guiConfig.appleServiceId,
      scope: 'name email',
      redirectURI: this.guiConfig.appleRedirectUri ?? window.location.origin,
      usePopup: true,
    });
  }

  async onAppleClick() {
    try {
      const res = await AppleID.auth.signIn();
      const token = res?.authorization?.id_token;
      if (token) this.onIdToken('apple', token);
    } catch (err: any) {
      this.loginError.emit(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private onIdToken(provider: SocialProvider, idToken: string) {
    const fallback = `Sign-in with ${provider} failed.`;
    this.run(
      this.auth.loginSocial(provider, idToken, this.buildSignupConsent()),
      (resp) => this.loginSuccess.emit(resp),
      fallback,
      (err) => this.loginError.emit(this.toError(err, fallback)),
    );
  }

  private toError(err: unknown, fallback: string): Error {
    if (err instanceof Error) return err;
    const e = err as { error?: { detail?: string; message?: string } };
    return new Error(e?.error?.detail ?? e?.error?.message ?? fallback);
  }

  private buildSignupConsent(): SignupConsent | undefined {
    const c = this.consent();
    if (!c) return undefined;
    return {
      policyVersion:  c.policyVersion,
      policyLanguage: c.policyLanguage,
      consents:       c.consents,
    };
  }
}
