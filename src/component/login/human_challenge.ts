import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { SAIL_GUI_CONFIG } from '../../config';
import { HumanVerifierProvider } from '../../model/auth';
import { loadScript } from '../../service/script_loader';

// Turnstile, hCaptcha and reCAPTCHA share one explicit-render API shape; v3 scores through execute.
interface ChallengeApi {
  ready(cb: () => void): void;
  render(el: HTMLElement, params: Record<string, unknown>): string | number;
  reset(widgetId: string | number): void;
  remove?(widgetId: string | number): void;
  execute(siteKey: string, params: { action: string }): Promise<string>;
}

// `ready` waits for grecaptcha's deferred bundle; Turnstile refuses ready() after an async load.
const PROVIDERS: Record<HumanVerifierProvider, { src: string; global: string; ready?: true }> = {
  turnstile:    { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', global: 'turnstile' },
  hcaptcha:     { src: 'https://js.hcaptcha.com/1/api.js?render=explicit', global: 'hcaptcha' },
  recaptcha:    { src: 'https://www.google.com/recaptcha/api.js?render=explicit', global: 'grecaptcha', ready: true },
  recaptcha_v3: { src: 'https://www.google.com/recaptcha/api.js?render={siteKey}', global: 'grecaptcha', ready: true },
};

/**
 * Renders the widget named by `SailGuiConfig.humanVerifier` and emits the
 * provider token keel's register sends take as `challengeToken`; reCAPTCHA v3
 * renders nothing and scores at `fetchToken()`. Without a site key nothing
 * renders and nothing is emitted; `failed` reports a provider that could not
 * load, after which `awaitsToken` is false and `fetchToken()` retries the load.
 * The host styles the container and, because a token is accepted once, calls
 * `reset()` after a refused submit.
 */
@Component({
  selector: 'sail-human-challenge',
  template: '<div #widget></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HumanChallengeComponent {
  private readonly config = inject(SAIL_GUI_CONFIG, { optional: true })?.humanVerifier;
  private readonly widget = viewChild.required<ElementRef<HTMLElement>>('widget');
  private readonly scored = this.config?.provider === 'recaptcha_v3';
  private loading?: Promise<ChallengeApi>;
  private readonly loadFailed = signal(false);
  private api?: ChallengeApi;
  private widgetId?: string | number;
  private current = '';

  /** True while a widget must be passed before submit; false for v3 and after a failed load. */
  readonly awaitsToken = computed(() => !!this.config?.siteKey && !this.scored && !this.loadFailed());
  /** The provider token, or '' once it expired, failed or was reset. */
  readonly token = output<string>();
  /** The script or widget could not load; the next `fetchToken()` retries. */
  readonly failed = output<void>();

  constructor() {
    afterNextRender(() => {
      if (!this.config?.siteKey) return;
      this.load().catch(() => {});
    });
    inject(DestroyRef).onDestroy(() => { if (this.widgetId !== undefined) this.api?.remove?.(this.widgetId); });
  }

  /** The token to send: the widget's current token, or a fresh v3 token for the configured action. Rejects when the provider cannot load. */
  async fetchToken(): Promise<string> {
    if (!this.config?.siteKey) return '';
    const api = await this.load();
    return this.scored ? api.execute(this.config!.siteKey, { action: this.config!.action ?? 'signup' }) : this.current;
  }

  private load(): Promise<ChallengeApi> {
    if (!this.loading) {
      this.loadFailed.set(false);
      this.loading = this.mount(this.config!.provider, this.config!.siteKey).catch((error) => {
        this.loading = undefined;
        this.loadFailed.set(true);
        this.failed.emit();
        throw error;
      });
    }
    return this.loading;
  }

  reset() {
    if (this.widgetId !== undefined) this.api?.reset(this.widgetId);
    this.emit('');
  }

  private emit(token: string) {
    this.current = token;
    this.token.emit(token);
  }

  private async mount(provider: HumanVerifierProvider, siteKey: string): Promise<ChallengeApi> {
    const { src, global, ready } = PROVIDERS[provider];
    await loadScript(src.replace('{siteKey}', siteKey));
    const api = (window as unknown as Record<string, ChallengeApi>)[global];
    if (ready) await new Promise<void>((done) => api.ready(done));
    this.api = api;
    if (!this.scored) {
      this.widgetId = api.render(this.widget().nativeElement, {
        sitekey: siteKey,
        callback: (token: string) => this.emit(token),
        'expired-callback': () => this.emit(''),
        'error-callback': () => this.emit(''),
      });
    }
    return api;
  }
}
