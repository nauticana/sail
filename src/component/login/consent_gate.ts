import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, ViewEncapsulation,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ConsentOption, ConsentState, ConsentType } from '../../model/auth';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../../config';

/**
 * ConsentGate — generic signup / privacy-settings checkboxes.
 *
 * Always renders two required consents:
 *   - privacy_policy (links to config.privacyPolicyUrl)
 *   - cross_border   (cross-border data processing acknowledgement)
 *
 * Additional checkboxes are declared by the consumer via `optionalConsents`.
 * Emits `consentStateChange` on every change with a `Record<string, boolean>`
 * map keyed by ConsentType values — mirrors keel's user.SignupConsent.Consents.
 *
 * See keel/README.md → "Consent Capture" for the backend-side contract.
 */
@Component({
  selector: 'sail-consent-gate',
  templateUrl: './consent_gate.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, MatCheckboxModule],
})
export class ConsentGateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly guiConfig: SailGuiConfig =
    inject(SAIL_GUI_CONFIG, { optional: true }) ?? DEFAULT_CONFIG;

  /** Content hash of the currently-deployed policy. Required. */
  readonly policyVersion = input<string>();
  /** ISO 639-1 policy language code. */
  readonly policyLanguage = input<string>('en');
  /** ISO country code of the policy variant. */
  readonly policyRegion = input<string | undefined>(undefined);
  /** Public URL of the privacy policy text. Falls back to config.privacyPolicyUrl. */
  readonly privacyUrl = input<string | undefined>(undefined);
  /** Optional extra checkboxes (e.g. video_opt_in, marketing). */
  readonly optionalConsents = input<ConsentOption[]>([]);

  readonly consentStateChange = output<ConsentState>();

  // Plain (untyped) FormGroup because optionalConsents add/remove controls dynamically;
  // a strongly-typed group would reject those calls.
  readonly form: FormGroup = new FormGroup({
    [ConsentType.PRIVACY_POLICY]: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
    [ConsentType.CROSS_BORDER]:   new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  });

  private readonly formValue = signal<Record<string, boolean>>({});
  private readonly formValid = signal(false);

  readonly effectivePolicyVersion = computed(() =>
    this.policyVersion() ?? this.guiConfig.defaultPolicyVersion ?? '',
  );
  readonly effectivePolicyLanguage = computed(() =>
    this.policyLanguage() ?? this.guiConfig.defaultPolicyLanguage ?? 'en',
  );
  readonly effectivePrivacyUrl = computed(() =>
    this.privacyUrl() ?? this.guiConfig.privacyPolicyUrl ?? '/privacy-policy',
  );

  readonly state = computed<ConsentState>(() => ({
    consents:       this.formValue(),
    policyVersion:  this.effectivePolicyVersion(),
    policyLanguage: this.effectivePolicyLanguage(),
    valid:          this.formValid(),
  }));

  constructor() {
    // Register optional consent controls when the input changes. add/removeControl
    // fire valueChanges, so the subscriptions below emit — never emit from an
    // effect: its microtask scheduling is unreliable for outputs in AOT builds.
    effect(() => {
      const options = this.optionalConsents();
      for (const opt of options) {
        if (!this.form.contains(opt.id)) {
          this.form.addControl(
            opt.id,
            new FormControl(false, { nonNullable: true, validators: opt.required ? Validators.requiredTrue : [] }),
          );
        }
      }
      for (const key of Object.keys(this.form.controls)) {
        if (key === ConsentType.PRIVACY_POLICY || key === ConsentType.CROSS_BORDER) continue;
        if (!options.some((o) => o.id === key)) this.form.removeControl(key);
      }
    });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncAndEmit());
    this.form.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncAndEmit());
  }

  ngOnInit() {
    this.syncAndEmit();
  }

  private syncAndEmit() {
    this.formValue.set(this.form.getRawValue());
    this.formValid.set(this.form.valid);
    this.consentStateChange.emit(this.state());
  }

  protected readonly ConsentType = ConsentType;
}
