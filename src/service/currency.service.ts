import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, shareReplay, tap } from 'rxjs';
import { Currency } from '../model/geo';
import { formatMinor } from '../util/money';
import { BackendService } from './rest_service';

/**
 * keel's `currency` catalog, the only source of minor-unit exponents. Loaded once through
 * generic REST, so the caller's role needs `TABLE SELECT currency`.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly backend = inject(BackendService);
  private readonly byCode = new Map<string, Currency>();
  private pending?: Observable<void>;
  readonly ready = signal(false);
  readonly failed = signal(false);

  /** Load the catalog; completed and concurrent calls share one request, a failed one is retried. */
  load(): Observable<void> {
    if (this.ready()) return of(undefined);
    this.failed.set(false);
    this.pending ??= this.backend.list<Currency>('currency', undefined, { limit: 1000 }).pipe(
      tap({
        next: (rows) => {
          for (const row of rows) this.byCode.set(row.Code, row);
          this.ready.set(true);
        },
        error: () => {
          this.pending = undefined;
          this.failed.set(true);
        },
      }),
      map(() => undefined),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pending;
  }

  /** Minor-unit exponent of a code; an unknown code is an error, never a guess. */
  exponent(currency: string): number {
    if (!this.ready()) throw new Error('sail: the currency catalog is not loaded.');
    const row = this.byCode.get(currency);
    if (!row) throw new Error(`sail: unknown currency "${currency}".`);
    return row.Exponent;
  }

  format(minor: number, currency: string): string {
    return formatMinor(minor, currency, this.exponent(currency));
  }

  /** The exponent once the catalog is loaded, starting the load if needed; undefined meanwhile. Throws when the load failed. */
  exponentLazy(currency: string): number | undefined {
    if (this.ready()) return this.exponent(currency);
    if (this.failed()) throw new Error('sail: failed to load the currency catalog.');
    this.load().subscribe({ error: () => undefined });
    return undefined;
  }

  /** `format` once the catalog is loaded, '' meanwhile (see `exponentLazy`). */
  formatLazy(minor: number, currency: string): string {
    const exponent = this.exponentLazy(currency);
    return exponent === undefined ? '' : formatMinor(minor, currency, exponent);
  }
}
