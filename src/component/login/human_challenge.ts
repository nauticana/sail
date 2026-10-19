import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, output, viewChild } from '@angular/core';
import { SAIL_GUI_CONFIG } from '../../config';
import { HumanVerifierProvider } from '../../model/auth';
import { loadScript } from '../../service/script_loader';

// Turnstile, hCaptcha and reCAPTCHA v2 share one explicit-render API shape.
interface ChallengeApi {
  ready?(cb: () => void): void;
  render(el: HTMLElement, params: Record<string, unknown>): string | number;
  reset(widgetId: string | number): void;
  remove?(widgetId: string | number): void;
}

const PROVIDERS: Record<HumanVerifierProvider, { src: string; global: string }> = {
  turnstile: { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', global: 'turnstile' },
  hcaptcha:  { src: 'https://js.hcaptcha.com/1/api.js?render=explicit', global: 'hcaptcha' },
  recaptcha: { src: 'https://www.google.com/recaptcha/api.js?render=explicit', global: 'grecaptcha' },
};

/**
 * Renders the widget named by `SailGuiConfig.humanVerifier` and emits the
 * provider token keel's register sends take as `challengeToken`. Without a
 * site key nothing renders and nothing is emitted; `failed` reports a widget
 * that could not load. The host styles the container and, because a token is
 * accepted once, calls `reset()` after a refused submit.
 */
@Component({
  selector: 'sail-human-challenge',
  template: '<div #widget></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HumanChallengeComponent {
  private readonly config = inject(SAIL_GUI_CONFIG, { optional: true })?.humanVerifier;
  private readonly widget = viewChild.required<ElementRef<HTMLElement>>('widget');
  private api?: ChallengeApi;
  private widgetId?: string | number;

  /** The provider token, or '' once it expired, failed or was reset. */
  readonly token = output<string>();
  /** The script or widget could not load; no token will follow. */
  readonly failed = output<void>();

  constructor() {
    afterNextRender(() => { if (this.config?.siteKey) this.mount(this.config.provider, this.config.siteKey); });
    inject(DestroyRef).onDestroy(() => { if (this.widgetId !== undefined) this.api?.remove?.(this.widgetId); });
  }

  reset() {
    if (this.widgetId !== undefined) this.api?.reset(this.widgetId);
    this.token.emit('');
  }

  private async mount(provider: HumanVerifierProvider, siteKey: string) {
    try {
      const { src, global } = PROVIDERS[provider];
      await loadScript(src);
      const api = (window as unknown as Record<string, ChallengeApi>)[global];
      if (api.ready) await new Promise<void>((ready) => api.ready!(ready));
      this.api = api;
      this.widgetId = api.render(this.widget().nativeElement, {
        sitekey: siteKey,
        callback: (token: string) => this.token.emit(token),
        'expired-callback': () => this.token.emit(''),
        'error-callback': () => this.token.emit(''),
      });
    } catch {
      this.failed.emit();
    }
  }
}
