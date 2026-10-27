import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatMinor } from '../util/money';
import { CurrencyService } from './currency.service';
import { Int64 } from '../util/integer';

/**
 * `{{ minor | sailMoney:currency }}` formats integer minor units at the catalog exponent, '' until
 * the catalog loads; `{{ minor | sailMoney:currency:exponent }}` uses the exponent keel sent with
 * the amount and needs no catalog. Impure so it re-renders once the catalog is ready.
 */
@Pipe({ name: 'sailMoney', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly currencies = inject(CurrencyService);

  transform(minor: Int64 | number, currency: string, exponent?: Int64 | number): string {
    return exponent === undefined ? this.currencies.formatLazy(minor, currency) : formatMinor(minor, currency, exponent);
  }
}
