import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/**
 * Responsive card-grid dashboard shell. Pure layout: an optional heading row with
 * a projected actions slot ([dashboardActions]), then a grid of projected cards.
 * Ships no CSS — the app styles `.dashboard-shell` / `.dashboard-header` /
 * `.dashboard-grid`.
 */
@Component({
  selector: 'sail-dashboard-shell',
  templateUrl: './dashboard_shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DashboardShellComponent {
  readonly heading = input<string>('');
}
