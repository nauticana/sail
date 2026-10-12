import { DestroyRef, Pipe, PipeTransform, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatMinor } from '../util/money';
import { CurrencyService } from './currency.service';

/**
 * `{{ minor | sailMoney:currency }}` formats integer minor units at the catalog exponent, '' until
 * the catalog loads; `{{ minor | sailMoney:currency:exponent }}` uses the exponent keel sent with
 * the amount and needs no catalog. Impure so it re-renders once the catalog is ready.
 */
@Pipe({ name: 'sailMoney', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly currencies = inject(CurrencyService);
  private readonly destroyRef = inject(DestroyRef);
  private requested = false;

  transform(minor: number, currency: string, exponent?: number): string {
    if (exponent !== undefined) return formatMinor(minor, currency, exponent);
    if (this.currencies.ready()) return this.currencies.format(minor, currency);
    if (this.currencies.failed()) throw new Error('sail: failed to load the currency catalog.');
    if (!this.requested) {
      this.requested = true;
      this.currencies.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
    }
    return '';
  }
}
