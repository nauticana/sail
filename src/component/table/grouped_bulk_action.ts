import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, TemplateRef, ViewEncapsulation, computed, contentChild, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { finalize, Observable } from 'rxjs';

export type BulkGroupKey = string | number;

export interface BulkActionGroup<T> {
  key: BulkGroupKey;
  rows: readonly T[];
  sample: readonly T[];
  count: number;
}

/** Generic outcome used to detect and report partial completion. */
export interface BulkActionResult {
  attempted: number;
  succeeded: number;
}

export interface BulkActionCompletion<T> {
  group: BulkActionGroup<T>;
  result: BulkActionResult;
}

interface OutcomeMessage {
  text: string;
  kind: 'partial' | 'error';
}

/** The projected template receives each sample row as `$implicit` and its group as `group`. */
@Component({
  selector: 'sail-grouped-bulk-action',
  templateUrl: './grouped_bulk_action.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, MatButtonModule],
})
export class GroupedBulkActionComponent<T> {
  readonly rows = input.required<readonly T[]>();
  readonly groupBy = input.required<(row: T) => BulkGroupKey | null | undefined>();
  readonly eligible = input<(row: T) => boolean>(() => true);
  readonly sampleSize = input.required<number>();
  readonly minimumGroupSize = input<number>(2);
  readonly execute = input.required<(group: BulkActionGroup<T>) => Observable<BulkActionResult>>();

  readonly heading = input.required<(group: BulkActionGroup<T>) => string>();
  readonly headingLevel = input<number>(3);
  readonly description = input<(group: BulkActionGroup<T>) => string>(() => '');
  readonly actionLabel = input.required<(group: BulkActionGroup<T>, busy: boolean) => string>();
  readonly remainderLabel = input.required<(remaining: number, group: BulkActionGroup<T>) => string>();
  readonly partialSuccessMessage = input.required<(result: BulkActionResult, group: BulkActionGroup<T>) => string>();
  readonly failureMessage = input.required<(error: unknown, group: BulkActionGroup<T>) => string>();
  readonly sortGroups = input<(left: BulkActionGroup<T>, right: BulkActionGroup<T>) => number>(() => 0);

  readonly finished = output<BulkActionCompletion<T>>();
  readonly failed = output<{ group: BulkActionGroup<T>; error: unknown }>();

  readonly busyKey = signal<BulkGroupKey | null>(null);
  /** Held outside the groups: a refresh after the action usually removes the group it concerns. */
  readonly message = signal<OutcomeMessage | null>(null);
  readonly sampleTemplate = contentChild<TemplateRef<unknown>>(TemplateRef);
  readonly groups = computed(() => this.buildGroups());

  private readonly destroyRef = inject(DestroyRef);

  run(group: BulkActionGroup<T>): void {
    if (this.busyKey() !== null) return;
    this.busyKey.set(group.key);
    this.message.set(null);
    let request: Observable<BulkActionResult>;
    try {
      request = this.execute()(group);
    } catch (error) {
      this.handleFailure(group, error);
      return;
    }
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busyKey.set(null)),
    ).subscribe({
      next: (result) => {
        if (result.succeeded < result.attempted) {
          this.message.set({ text: this.partialSuccessMessage()(result, group), kind: 'partial' });
        }
        this.finished.emit({ group, result });
      },
      error: (error: unknown) => this.handleFailure(group, error),
    });
  }

  private buildGroups(): BulkActionGroup<T>[] {
    const grouped = new Map<BulkGroupKey, T[]>();
    for (const row of this.rows()) {
      if (!this.eligible()(row)) continue;
      const key = this.groupBy()(row);
      if (key === null || key === undefined || key === '') continue;
      const groupRows = grouped.get(key) ?? [];
      groupRows.push(row);
      grouped.set(key, groupRows);
    }
    const sampleSize = Math.max(0, this.sampleSize());
    return [...grouped.entries()]
      .filter(([, groupRows]) => groupRows.length >= this.minimumGroupSize())
      .map(([key, groupRows]) => ({
        key,
        rows: groupRows,
        sample: groupRows.slice(0, sampleSize),
        count: groupRows.length,
      }))
      .sort(this.sortGroups());
  }

  private handleFailure(group: BulkActionGroup<T>, error: unknown): void {
    this.busyKey.set(null);
    this.message.set({ text: this.failureMessage()(error, group), kind: 'error' });
    this.failed.emit({ group, error });
  }
}
