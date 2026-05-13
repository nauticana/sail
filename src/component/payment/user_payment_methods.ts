import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { BaseAsync } from '../abstract/base_async';
import { UserPaymentMethodService } from '../../service/user_payment_method.service';
import { UserPaymentMethod } from '../../model/appdata';

/**
 * End-user saved payment methods.
 *
 * Drop-in screen that lists the caller's cards/wallets, with set-default
 * + delete actions. Inherits loading/error state from BaseAsync.
 *
 * Customise the heading and "add" CTA via inputs; emit (addClicked) so
 * the consumer routes to its own SetupIntent flow (sail does not bundle
 * a SetupIntent UI today — providers vary too much).
 *
 * Selector: <sail-user-payment-methods>
 */
@Component({
  selector: 'sail-user-payment-methods',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './user_payment_methods.html',
  styles: `
    .user-payment-methods { display: flex; flex-direction: column; gap: 12px; }
    .user-payment-methods__title { margin: 0; }
    .user-payment-methods__add { align-self: flex-start; }
    .user-payment-methods__empty { color: var(--mat-app-on-surface-variant, #555); }
    .user-payment-methods__item { background: var(--mat-app-surface, #fff); }
    .user-payment-methods__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .user-payment-methods__info { display: flex; align-items: center; gap: 8px; }
    .user-payment-methods__brand { font-weight: 600; }
    .user-payment-methods__last4 { color: var(--mat-app-on-surface-variant, #555); }
    .user-payment-methods__default { color: var(--mat-app-primary, #1976d2); margin-left: 8px; font-size: 12px; font-weight: 600; }
    .user-payment-methods__actions { display: flex; align-items: center; gap: 4px; }
    .user-payment-methods__error { color: var(--mat-app-error, #b00020); font-size: 13px; margin: 0; }
  `,
})
export class UserPaymentMethodsComponent extends BaseAsync implements OnInit {
  readonly title = input('Payment Methods');
  readonly addLabel = input('Add Payment Method');
  readonly emptyLabel = input('No saved payment methods yet.');
  readonly showAdd = input(true);

  /** Emitted when the "Add" button is tapped. Consumer routes to its SetupIntent flow. */
  readonly addClicked = output<void>();
  /** Emitted after a successful set-default flip. */
  readonly defaultChanged = output<UserPaymentMethod>();
  /** Emitted after a successful delete. */
  readonly deleted = output<UserPaymentMethod>();

  private readonly service = inject(UserPaymentMethodService);

  readonly methods = signal<UserPaymentMethod[]>([]);
  readonly errorMsg = signal<string>('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(
      this.service.list(),
      (rows) => {
        // Sort default-first locally — keel's generic CRUD doesn't
        // honour a sort hint without rest_api_header config.
        const sorted = [...(rows ?? [])].sort((a, b) =>
          Number(b.IsDefault) - Number(a.IsDefault),
        );
        this.methods.set(sorted);
      },
      'Failed to load payment methods.',
    );
  }

  setDefault(m: UserPaymentMethod): void {
    this.service.setDefault(m.Id).subscribe({
      next: () => {
        this.methods.update((list) =>
          list.map((row) => ({ ...row, IsDefault: row.Id === m.Id })),
        );
        this.defaultChanged.emit(m);
      },
      error: (err) => this.errorMsg.set(err?.error?.detail ?? 'Failed to set default'),
    });
  }

  remove(m: UserPaymentMethod): void {
    this.service.delete(m.Id).subscribe({
      next: () => {
        this.methods.update((list) => list.filter((row) => row.Id !== m.Id));
        this.deleted.emit(m);
      },
      error: (err) => this.errorMsg.set(err?.error?.detail ?? 'Failed to delete'),
    });
  }

  iconFor(m: UserPaymentMethod): string {
    switch (m.MethodType) {
      case 'card':       return 'credit_card';
      case 'bank':       return 'account_balance';
      case 'apple_pay':
      case 'google_pay':
      case 'wallet':     return 'wallet';
      default:           return 'credit_card';
    }
  }
}
