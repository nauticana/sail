import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecisionCategoryGroup, DecisionRecord } from '../model/decision';

/**
 * Read-only decision chain of one request, oldest first and grouped by category. Records are
 * shown exactly as supplied — never de-duplicated. Selector: <sail-decision-timeline>.
 */
@Component({
  selector: 'sail-decision-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decision_timeline.html',
})
export class DecisionTimelineComponent {
  readonly records = input.required<readonly DecisionRecord[]>();

  protected readonly groups = computed<DecisionCategoryGroup[]>(() => {
    const chronological = [...this.records()].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const groups = new Map<string, DecisionRecord[]>();
    for (const record of chronological) {
      const group = groups.get(record.category);
      if (group) group.push(record);
      else groups.set(record.category, [record]);
    }
    return [...groups].map(([category, records]) => ({ category, records }));
  });
}
