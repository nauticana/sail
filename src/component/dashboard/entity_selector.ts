import { ChangeDetectionStrategy, Component, ViewEncapsulation, effect, input, linkedSignal, output } from '@angular/core';
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

  private lastEmitted: string | undefined;

  constructor() {
    // Emits input-driven re-resolutions; user picks already emitted in onChange.
    effect(() => {
      const v = this.value();
      if (v !== this.lastEmitted) {
        this.lastEmitted = v;
        this.selectionChange.emit(v);
      }
    });
  }

  onChange(id: string): void {
    this.lastEmitted = id;
    this.value.set(id);
    this.selectionChange.emit(id);
  }
}
