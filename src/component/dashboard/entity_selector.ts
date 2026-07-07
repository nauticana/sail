import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
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

  /**
   * Re-resolves only when the INPUTS change (a user pick via `.set()` sticks —
   * an unchanged `[selected]` binding can never snap the selection back):
   * a newly-changed valid `selected` wins, else the current pick if still
   * valid, else the first active entity, else undefined (host clears stale data).
   */
  readonly value = linkedSignal<{ opts: EntityOption[]; sel?: string }, string | undefined>({
    source: () => ({ opts: this.entities(), sel: this.selected() }),
    computation: (src, prev) => {
      const isActive = (id?: string) => !!id && src.opts.some((e) => e.id === id && e.active !== false);
      const selChanged = src.sel !== prev?.source.sel;
      if (selChanged && isActive(src.sel)) return src.sel;
      if (isActive(prev?.value)) return prev?.value;
      if (isActive(src.sel)) return src.sel;
      return src.opts.find((e) => e.active !== false)?.id;
    },
  });

  // Single emission path — signals already dedupe unchanged values.
  readonly selectionChange = outputFromObservable(toObservable(this.value));

  onChange(id: string): void {
    this.value.set(id);
  }
}
