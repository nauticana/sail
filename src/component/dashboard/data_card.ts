import { ChangeDetectionStrategy, Component, TemplateRef, ViewEncapsulation, contentChild, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DataCardState } from '../../model/dashboard';

/**
 * Card chrome for a single data visualization. The app supplies the chart itself
 * as an <ng-template> (bring your own chart library — keel apps use ng2-charts);
 * the card instantiates it ONLY in the 'ready' state, so during
 * loading/empty/error/locked the chart never exists (no hidden canvas, no data
 * leak when locked).
 *
 * Accessibility: `description` is a required text alternative announced in place
 * of the visual chart; `tableHeaders`/`tableRows`, when supplied, render a
 * visually-hidden data table (`.sr-only`, app-styled) as the non-visual equivalent.
 */
@Component({
  selector: 'sail-data-card',
  templateUrl: './data_card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, MatButtonModule, MatProgressSpinnerModule],
})
export class DataCardComponent {
  readonly heading = input<string>('');
  readonly state = input<DataCardState>('loading');
  /** Required text alternative for screen readers — the non-visual equivalent. */
  readonly description = input.required<string>();
  readonly errorMessage = input<string>('Could not load this data.');
  readonly emptyMessage = input<string>('No data yet.');
  readonly lockedMessage = input<string>('Upgrade to unlock this insight.');
  readonly ctaLabel = input<string>('Upgrade');
  readonly tableHeaders = input<string[]>([]);
  readonly tableRows = input<(string | number)[][]>([]);
  readonly upgrade = output<void>();
  readonly retry = output<void>();

  /** The chart, provided as a single <ng-template>; instantiated only when ready. */
  readonly chart = contentChild(TemplateRef);
}
