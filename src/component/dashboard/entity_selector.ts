import { ChangeDetectionStrategy, Component, ViewEncapsulation, effect, input, output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { EntityOption } from '../../model/dashboard';

/**
 * Scope selector for the active entity (e.g. business). Resolves the selection
 * from `selected` when valid, else the first active option, and emits it — so the
 * host's dependent data loads for a sensible default without extra wiring.
 */
@Component({
  selector: 'sail-entity-selector',
  templateUrl: './entity_selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatFormFieldModule, MatSelectModule],
})
export class EntitySelectorComponent {
  readonly entities = input<EntityOption[]>([]);
  readonly selected = input<string | undefined>(undefined);
  readonly label = input<string>('Business');
  readonly selectionChange = output<string | undefined>();

  readonly value = signal<string | undefined>(undefined);

  constructor() {
    // Explicit selection wins; else keep the current pick if still valid; else the
    // first active entity. "Valid" means present AND active, so a scope that goes
    // inactive (or vanishes) is dropped. Emit on every change, including a clear
    // (undefined) when no active option remains, so the host stops showing stale data.
    effect(() => {
      const opts = this.entities();
      const isActive = (id?: string) => !!id && opts.some((e) => e.id === id && e.active !== false);
      const cur = this.value();
      const resolved =
        isActive(this.selected()) ? this.selected()
          : isActive(cur) ? cur
            : opts.find((e) => e.active !== false)?.id;
      if (resolved !== cur) {
        this.value.set(resolved);
        this.selectionChange.emit(resolved);
      }
    });
  }

  onChange(id: string): void {
    this.value.set(id);
    this.selectionChange.emit(id);
  }
}
