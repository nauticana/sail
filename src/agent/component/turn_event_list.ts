import { ChangeDetectionStrategy, Component, TemplateRef, computed, input } from '@angular/core';
import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TurnEvent, TurnExtensionEvent } from '../model/turn_event';
import { buildTurnTimeline } from '../util/turn_timeline';

/**
 * Renders one turn's typed events in frame order. Extension events render only through
 * `extensionTemplate`; without it, and for types it does not handle, they are ignored.
 * Ships no CSS — style the `.turn-*` hooks. Selector: <sail-turn-event-list>.
 */
@Component({
  selector: 'sail-turn-event-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, NgTemplateOutlet, MatIconModule],
  templateUrl: './turn_event_list.html',
})
export class TurnEventListComponent {
  readonly events = input.required<readonly TurnEvent[]>();
  readonly extensionTemplate = input<TemplateRef<{ $implicit: TurnExtensionEvent }>>();

  protected readonly items = computed(() => buildTurnTimeline(this.events()));
}
