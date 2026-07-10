import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';

/**
 * SmsConsent — the shared 10DLC / A2P SMS opt-in disclosure.
 *
 * Presentational only: renders the carrier-required consent language (recurring
 * automated messages, frequency, rates, STOP/HELP, Terms + Privacy links) with
 * the host app's brand and message purpose. Every SMS-sending app renders the
 * same carrier-compliant copy — which must match the wording registered in its
 * 10DLC campaign sample. Consent is *captured* server-side via keel's
 * ConsentService (with the phone number); this component is only the disclosure
 * shown at the point of opt-in. Styling is the consuming app's (sail ships no CSS).
 */
@Component({
  selector: 'sail-sms-consent',
  templateUrl: './sms_consent.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class SmsConsentComponent {
  private readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, { optional: true }) ?? DEFAULT_CONFIG;

  /** Brand name in the disclosure. Defaults to config.appName. */
  readonly brand = input<string>('');
  /** What the messages are — e.g. "one-time verification codes" or "verification codes and trip updates". */
  readonly messagePurpose = input<string>('one-time verification codes');
  /** The action label the disclosure references (the opt-in button's text). */
  readonly action = input<string>('the button below');
  /** Terms URL. Defaults to config.termsUrl. */
  readonly termsUrl = input<string>('');
  /** Privacy URL. Defaults to config.privacyPolicyUrl. */
  readonly privacyUrl = input<string>('');

  protected readonly brandName = computed(() => this.brand() || this.guiConfig.appName || 'us');
  protected readonly terms = computed(() => this.termsUrl() || this.guiConfig.termsUrl || '');
  protected readonly privacy = computed(() => this.privacyUrl() || this.guiConfig.privacyPolicyUrl || '');
}
