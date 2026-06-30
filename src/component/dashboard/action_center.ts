import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActionItem } from '../../model/dashboard';

/**
 * Prioritized next-best-action list (guided completion, FR-008). Renders each
 * action with its reason and a single CTA, sorted by descending priority;
 * completed items show a done state instead of a button. Pure presentational —
 * the host performs the action on `act`.
 */
@Component({
  selector: 'sail-action-center',
  templateUrl: './action_center.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule],
})
export class ActionCenterComponent {
  readonly actions = input<ActionItem[]>([]);
  readonly heading = input<string>('Recommended actions');
  readonly emptyMessage = input<string>("You're all caught up.");
  readonly act = output<ActionItem>();

  readonly sorted = computed<ActionItem[]>(() =>
    [...this.actions()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)));
}
