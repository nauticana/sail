import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, effect, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Seat quantity stepper. Presentational — emits the chosen count; the caller
 * feeds it into `<sail-checkout-button [quantity]>` / checkout metadata or a
 * `BillingService.setSeats()` call. Seed `[seats]` from `Subscription.seats`.
 */
@Component({
  selector: 'sail-seat-selector',
  templateUrl: './seat_selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule],
})
export class SeatSelectorComponent {
  /** Initial / parent-bound seat count. */
  readonly seatsInput = input(1, { alias: 'seats' });
  /** Minimum selectable seats. */
  readonly min = input(1);
  /** Maximum selectable seats; unbounded when undefined. */
  readonly max = input<number | undefined>(undefined);
  readonly seatsChange = output<number>();

  /** Locally-mutated value, synced from the parent-bound input. */
  readonly seats = signal(1);

  readonly canDecrease = computed(() => this.seats() > this.min());
  readonly canIncrease = computed(() => {
    const max = this.max();
    return max === undefined || this.seats() < max;
  });

  constructor() {
    effect(() => this.seats.set(this.seatsInput()));
  }

  decrease(): void {
    this.commit(Math.max(this.min(), this.seats() - 1));
  }

  increase(): void {
    const max = this.max();
    const next = this.seats() + 1;
    this.commit(max === undefined ? next : Math.min(max, next));
  }

  private commit(value: number): void {
    if (value === this.seats()) return;
    this.seats.set(value);
    this.seatsChange.emit(value);
  }
}
