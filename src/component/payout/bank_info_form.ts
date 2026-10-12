import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, map } from 'rxjs';
import { BankInfoFormValue } from '../../model/appdata';
import { Country } from '../../model/geo';
import { LabelService } from '../../service/label.service';
import { BackendService } from '../../service/rest_service';

/**
 * Payout bank-info form over keel's `user_bank_info` fields. Countries come from the `country`
 * table (its default currency is the payout currency) and tax-id types from the `tax_id_type`
 * domain, so the caller's role needs `TABLE SELECT country`. Emits through `(submitted)`:
 * first-time setup posts through the app's registration service, changes through
 * `PayoutService.replaceBankInfo`, never generic CRUD. Ships no CSS.
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
  readonly title = input('Payment and Tax');
  readonly intro = input('Tax + payout details. Bank account itself is set up with the payout provider in a separate step — only tax-reporting and dispute-correspondence fields are collected here.');
  /** Provider code persisted on user_bank_info.provider — must match the app's keel --payout_provider. */
  readonly provider = input.required<string>();
  readonly agreementLabel = input('I agree to the payout provider account agreement');
  readonly submitLabel = input('Next >');
  readonly showBack = input(true);

  readonly submitted = output<BankInfoFormValue>();
  readonly back = output<void>();

  private readonly backend = inject(BackendService);
  private readonly labels = inject(LabelService);

  readonly form = inject(FormBuilder).group({
    countryCode:       ['', Validators.required],
    taxIdType:         ['', Validators.required],
    accountHolderName: ['', Validators.required],
    taxId:             ['', Validators.required],
    billingAddress:    ['', Validators.required],
    providerAgreement: [false, Validators.requiredTrue],
  });

  readonly options = toSignal(forkJoin({
    countries: this.backend.list<Country>('country', undefined, { limit: 1000, orderBy: 'caption' }),
    labels: this.labels.loadLabels('tax_id_type'),
  }).pipe(map(({ countries }) => ({ countries, taxIdTypes: this.labels.options('tax_id_type') }))));

  readonly country = toSignal(this.form.controls.countryCode.valueChanges, { initialValue: '' });
  readonly currency = computed(() => this.options()?.countries.find((c) => c.Id === this.country())?.Currency ?? '');

  submit() {
    const currency = this.currency();
    if (this.form.invalid || !currency) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      countryCode:       v.countryCode!,
      currency,
      accountHolderName: v.accountHolderName!,
      billingAddress:    v.billingAddress!,
      taxIdType:         v.taxIdType!,
      taxId:             v.taxId!,
      provider:          this.provider(),
      providerAgreement: v.providerAgreement!,
    });
  }
}
