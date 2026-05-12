import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
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
 * `[provider]` defaults to "AW" (Airwallex) to match keel/payout's
 * default --payout_provider flag. Override per deployment if needed.
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
  template: `
    <div class="bank-info-form">
      <h2 class="bank-info-form__title">{{ title }}</h2>

      @if (intro) {
        <p class="bank-info-form__intro">{{ intro }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Country *</mat-label>
          <mat-select formControlName="countryCode">
            @for (c of countryProfiles; track c.code) {
              <mat-option [value]="c.code">{{ c.label }} ({{ c.currency }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <p class="hint">Sets your tax ID format + payout currency</p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Account holder name *</mat-label>
          <input matInput formControlName="accountHolderName">
        </mat-form-field>
        <p class="hint">Legal name on the bank account (must match government ID)</p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ taxIdLabel() }} *</mat-label>
          <input matInput formControlName="taxId" [placeholder]="taxIdPlaceholder()">
        </mat-form-field>
        <p class="hint">{{ taxIdHint() }}</p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Billing address *</mat-label>
          <input matInput formControlName="billingAddress">
        </mat-form-field>
        <p class="hint">Business or home address — used for tax correspondence</p>

        <p class="provider-note">
          Bank routing details (account number + institution / ABA /
          IBAN) are collected by the payout provider in the next step;
          this application does not store them.
        </p>

        <mat-checkbox formControlName="providerAgreement" class="agreement">
          {{ agreementLabel }}
        </mat-checkbox>

        <div class="nav-buttons">
          @if (showBack) {
            <button mat-stroked-button class="pill-btn" type="button" (click)="back.emit()">
              &lt; Back
            </button>
          }
          <button mat-flat-button class="pill-btn primary-btn" type="submit"
                  [disabled]="form.invalid">
            {{ submitLabel }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .bank-info-form { display: flex; flex-direction: column; gap: 4px; padding: 0 24px 32px; }
    .bank-info-form__title { margin: 0 0 16px; }
    .bank-info-form__intro { font-size: 14px; color: var(--mat-app-on-surface-variant, #555); margin: 0 0 16px; }
    .full-width { width: 100%; }
    .hint { font-size: 12px; color: var(--mat-app-on-surface-variant, #555); margin: -4px 0 8px; }
    .provider-note { font-size: 13px; color: var(--mat-app-on-surface-variant, #555); background: rgba(0,0,0,0.04); padding: 12px; border-radius: 4px; margin: 12px 0; }
    .agreement { margin: 12px 0 16px; font-size: 14px; }
    .nav-buttons { display: flex; gap: 12px; margin-top: 8px; }
    .pill-btn { border-radius: 24px; height: 48px; font-size: 15px; font-weight: 600; flex: 1; }
    .primary-btn { background: var(--mat-app-primary, #1976d2); color: white; }
  `,
})
export class PayoutBankInfoFormComponent {
  /** Step title rendered above the form. */
  @Input() title = 'Payment and Tax';
  /** Optional explainer rendered below the title. */
  @Input() intro = 'Tax + payout details. Bank account itself is set up with the payout provider in a separate step — only tax-reporting and dispute-correspondence fields are collected here.';
  /** Override the list of supported countries — keep the default for most apps. */
  @Input() countryProfiles: CountryProfile[] = DEFAULT_COUNTRY_PROFILES;
  /** Provider code persisted on user_bank_info.provider. Default AW (Airwallex) matches keel's default --payout_provider. */
  @Input() provider = 'AW';
  /** Wording on the provider-agreement checkbox. Override to name the live provider. */
  @Input() agreementLabel = 'I agree to the payout provider account agreement';
  /** Submit-button label — wizards usually use "Next >". */
  @Input() submitLabel = 'Next >';
  /** When true, the back button renders alongside submit. */
  @Input() showBack = true;

  /** Emitted on submit; payload maps 1:1 to basis user_bank_info columns. */
  @Output() submitted = new EventEmitter<BankInfoFormValue>();
  /** Emitted when the user clicks Back. */
  @Output() back = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    countryCode:       ['CA', Validators.required],
    accountHolderName: ['', Validators.required],
    taxId:             ['', Validators.required],
    billingAddress:    ['', Validators.required],
    providerAgreement: [false, Validators.requiredTrue],
  });

  private readonly selectedCountry = signal<CountryProfile>(this.countryProfiles[0]);

  readonly taxIdLabel       = computed(() => this.selectedCountry().taxIdLabel);
  readonly taxIdPlaceholder = computed(() => this.selectedCountry().taxIdPlaceholder);
  readonly taxIdHint        = computed(() => this.selectedCountry().taxIdHint);

  constructor() {
    this.form.controls.countryCode.valueChanges.subscribe((code) => {
      const profile = this.countryProfiles.find((c) => c.code === code) ?? this.countryProfiles[0];
      this.selectedCountry.set(profile);
    });
  }

  submit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const country = this.selectedCountry();
    this.submitted.emit({
      countryCode:       country.code,
      currency:          country.currency,
      accountHolderName: v.accountHolderName!,
      billingAddress:    v.billingAddress!,
      taxIdType:         country.taxIdType,
      taxId:             v.taxId!,
      provider:          this.provider,
      providerAgreement: v.providerAgreement!,
    });
  }
}
