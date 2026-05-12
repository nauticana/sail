import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="user-payment-methods">
      <h2 class="user-payment-methods__title">{{ title }}</h2>

      @if (showAdd) {
        <button mat-raised-button color="accent"
                class="user-payment-methods__add"
                (click)="addClicked.emit()">
          <mat-icon>add</mat-icon> {{ addLabel }}
        </button>
      }

      @if (methods().length === 0 && !loading()) {
        <p class="user-payment-methods__empty">{{ emptyLabel }}</p>
      }

      @for (m of methods(); track m.Id) {
        <mat-card class="user-payment-methods__item">
          <mat-card-content>
            <div class="user-payment-methods__row">
              <div class="user-payment-methods__info">
                <mat-icon>{{ iconFor(m) }}</mat-icon>
                <span class="user-payment-methods__brand">{{ m.Brand || m.MethodType }}</span>
                @if (m.LastFour) {
                  <span class="user-payment-methods__last4">•••• {{ m.LastFour }}</span>
                }
                @if (m.IsDefault) {
                  <span class="user-payment-methods__default">Default</span>
                }
              </div>
              <div class="user-payment-methods__actions">
                @if (!m.IsDefault) {
                  <button mat-button (click)="setDefault(m)">Set default</button>
                }
                <button mat-icon-button (click)="remove(m)" aria-label="Delete payment method">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if (errorMsg()) {
        <p class="user-payment-methods__error">{{ errorMsg() }}</p>
      }
    </div>
  `,
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
  @Input() title = 'Payment Methods';
  @Input() addLabel = 'Add Payment Method';
  @Input() emptyLabel = 'No saved payment methods yet.';
  @Input() showAdd = true;

  /** Emitted when the "Add" button is tapped. Consumer routes to its SetupIntent flow. */
  @Output() addClicked = new EventEmitter<void>();
  /** Emitted after a successful set-default flip. */
  @Output() defaultChanged = new EventEmitter<UserPaymentMethod>();
  /** Emitted after a successful delete. */
  @Output() deleted = new EventEmitter<UserPaymentMethod>();

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
