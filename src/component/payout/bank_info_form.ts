import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BankInfoFormValue, CountryProfile } from '../../model/appdata';

/**
 * Default country profiles bundled with sail. Covers CA / US / EU; downstream
 * apps can pass a different list via the `[countryProfiles]` input.
 *
 * Codes match basis constant_header `tax_id_type` seeded by keel:
 *   S = SIN (CA), N = SSN (US), E = EIN (US business), V = VAT (EU), O = Other.
 */
export const DEFAULT_COUNTRY_PROFILES: CountryProfile[] = [
  { code: 'CA', label: 'Canada',         currency: 'CAD', taxIdType: 'S', taxIdLabel: 'SIN',        taxIdPlaceholder: '123456789',   taxIdHint: 'Social Insurance Number — shared with the tax authority for annual reporting' },
  { code: 'US', label: 'United States',  currency: 'USD', taxIdType: 'N', taxIdLabel: 'SSN or EIN', taxIdPlaceholder: '123-45-6789', taxIdHint: 'SSN for an individual recipient, EIN for an incorporated recipient' },
  { code: 'DE', label: 'Germany (EU)',   currency: 'EUR', taxIdType: 'V', taxIdLabel: 'VAT number', taxIdPlaceholder: 'DE123456789', taxIdHint: 'VAT registration number' },
];

/**
 * Payout bank-info form.
 *
 * Captures the basis `user_bank_info` fields (country, currency, account
 * holder, tax id, billing address, agreement). Emits the form value via
 * `(submitted)` — the consumer decides whether to POST directly to
 * /api/v1/user_bank_info or pipe through its own registration service.
 *
 * Ships no CSS — the consuming app styles the classes globally.
 *
 * Selector: <sail-payout-bank-info-form>
 */
@Component({
  selector: 'sail-payout-bank-info-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCheckboxModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  templateUrl: './bank_info_form.html',
})
export class PayoutBankInfoFormComponent {
  /** Step title rendered above the form. */
  readonly title = input('Payment and Tax');
  /** Optional explainer rendered below the title. */
  readonly intro = input('Tax + payout details. Bank account itself is set up with the payout provider in a separate step — only tax-reporting and dispute-correspondence fields are collected here.');
  /** Override the list of supported countries — keep the default for most apps. */
  readonly countryProfiles = input<CountryProfile[]>(DEFAULT_COUNTRY_PROFILES);
  /** Provider code persisted on user_bank_info.provider — must match the app's keel --payout_provider. */
  readonly provider = input.required<string>();
  /** Wording on the provider-agreement checkbox. Override to name the live provider. */
  readonly agreementLabel = input('I agree to the payout provider account agreement');
  /** Submit-button label — wizards usually use "Next >". */
  readonly submitLabel = input('Next >');
  /** When true, the back button renders alongside submit. */
  readonly showBack = input(true);

  /** Emitted on submit; payload maps 1:1 to basis user_bank_info columns. */
  readonly submitted = output<BankInfoFormValue>();
  /** Emitted when the user clicks Back. */
  readonly back = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    countryCode:       ['', Validators.required],
    accountHolderName: ['', Validators.required],
    taxId:             ['', Validators.required],
    billingAddress:    ['', Validators.required],
    providerAgreement: [false, Validators.requiredTrue],
  });

  // linkedSignal, not a field initializer: the bound countryProfiles input
  // isn't available yet during construction.
  private readonly selectedCountry = linkedSignal<CountryProfile | undefined>(() => this.countryProfiles()[0]);

  readonly taxIdLabel       = computed(() => this.selectedCountry()?.taxIdLabel ?? '');
  readonly taxIdPlaceholder = computed(() => this.selectedCountry()?.taxIdPlaceholder ?? '');
  readonly taxIdHint        = computed(() => this.selectedCountry()?.taxIdHint ?? '');

  constructor() {
    // Keep the form's country in the bound profile list (never a phantom default).
    effect(() => {
      const profiles = this.countryProfiles();
      const current = this.form.controls.countryCode.value;
      if (!profiles.some((c) => c.code === current)) {
        this.form.controls.countryCode.setValue(profiles[0]?.code ?? '');
      }
    });
    this.form.controls.countryCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((code) => {
        const profiles = this.countryProfiles();
        this.selectedCountry.set(profiles.find((c) => c.code === code) ?? profiles[0]);
      });
  }

  submit() {
    const country = this.selectedCountry();
    if (this.form.invalid || !country) return;
    const v = this.form.value;
    this.submitted.emit({
      countryCode:       country.code,
      currency:          country.currency,
      accountHolderName: v.accountHolderName!,
      billingAddress:    v.billingAddress!,
      taxIdType:         country.taxIdType,
      taxId:             v.taxId!,
      provider:          this.provider(),
      providerAgreement: v.providerAgreement!,
    });
  }
}
