import { DestroyRef, Pipe, PipeTransform, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LabelService } from './label.service';

/**
 * `{{ code | sailCaption:'constant_id' }}` — the backend caption of a constant code, the code
 * itself until its domain loads or when the domain lacks it. Impure so it re-renders on load.
 */
@Pipe({ name: 'sailCaption', pure: false })
export class CaptionPipe implements PipeTransform {
  private readonly labels = inject(LabelService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requested = new Set<string>();
  private readonly loaded = signal(0);

  transform(code: string | null | undefined, constantId: string): string {
    if (!code) return '';
    this.loaded();
    if (!this.requested.has(constantId)) {
      this.requested.add(constantId);
      // A cached domain emits synchronously: its caption is already current, and a signal
      // write during render would throw NG0600.
      let rendering = true;
      this.labels.loadLabels(constantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { if (!rendering) this.loaded.update((n) => n + 1); },
        error: () => this.requested.delete(constantId),
      });
      rendering = false;
    }
    return this.labels.getLabel(constantId, code);
  }
}
