import {
  ChangeDetectionStrategy, Component, computed, ElementRef, OnInit, ViewEncapsulation,
  inject, input, output, viewChild,
} from '@angular/core';
import { BaseAsync } from '../abstract/base_async';
import { BaseAuthService } from '../../service/auth.service';
import { loadScript } from '../../service/script_loader';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';
import {
  ConsentState, LoginResponseSocial, SignupConsent, SocialProvider,
} from '../../model/auth';
import { firstValueFrom } from 'rxjs';

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

  private readonly googleBtn = viewChild<ElementRef<HTMLDivElement>>('googleBtn');

  protected readonly googleEnabled = computed(() =>
    this.providers().includes('google') && !!this.guiConfig.googleClientId);
  protected readonly appleEnabled = computed(() =>
    this.providers().includes('apple') && !!this.guiConfig.appleServiceId);

  ngOnInit() {
    if (this.providers().includes('google') && !this.guiConfig.googleClientId) {
      console.warn('SocialLoginComponent: googleClientId missing from SailGuiConfig — Google button hidden');
    }
    if (this.providers().includes('apple') && !this.guiConfig.appleServiceId) {
      console.warn('SocialLoginComponent: appleServiceId missing from SailGuiConfig — Apple button hidden');
    }

    // SDK load failures (CSP, ad-blockers) must surface, not leave a blank area.
    if (this.googleEnabled()) this.initGoogle().catch((err) => this.onInitError('Google', err));
    if (this.appleEnabled())  this.initApple().catch((err) => this.onInitError('Apple', err));
  }

  private onInitError(provider: string, err: unknown) {
    console.error(`${provider} sign-in init failed:`, err);
    this.errorMessage.set(`${provider} sign-in is unavailable right now.`);
    this.loginError.emit(err instanceof Error ? err : new Error(String(err)));
  }

  private async initGoogle() {
    await loadScript(GSI_URL);
    const nonce = await firstValueFrom(this.auth.getSocialNonce());
    google.accounts.id.initialize({
      client_id: this.guiConfig.googleClientId,
      callback: (res: { credential: string }) => this.onIdToken('google', res.credential),
      ...(nonce ? { nonce } : {}),
    });
    // Render into the template anchor once the view is ready.
    queueMicrotask(() => {
      const anchor = this.googleBtn()?.nativeElement;
      if (anchor) {
        google.accounts.id.renderButton(anchor, { theme: 'outline', size: 'large' });
      }
    });
  }

  private async initApple() {
    await loadScript(APPLE_URL);
    const nonce = await firstValueFrom(this.auth.getSocialNonce());
    AppleID.auth.init({
      clientId: this.guiConfig.appleServiceId,
      scope: 'name email',
      redirectURI: this.guiConfig.appleRedirectUri ?? window.location.origin,
      usePopup: true,
      ...(nonce ? { nonce } : {}),
    });
  }

  async onAppleClick() {
    try {
      const res = await AppleID.auth.signIn();
      const token = res?.authorization?.id_token;
      if (token) this.onIdToken('apple', token);
    } catch (err: unknown) {
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
