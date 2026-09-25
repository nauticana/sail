import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';

/**
 * One dashboard number with an optional target, progress, delta and trend.
 * Values arrive preformatted: the caller knows whether a number is money, a
 * percentage or a count.
 */
@Component({
  selector: 'sail-stat-tile',
  templateUrl: './stat_tile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly target = input<string>('');
  /** 0..1; clamped. */
  readonly progress = input<number | null>(null);
  readonly delta = input<string>('');
  /** true / false colours the delta as an improvement / regression; null leaves it neutral. */
  readonly deltaGood = input<boolean | null>(null);
  readonly trend = input<number[]>([]);

  readonly progressPercent = computed(() => {
    const p = this.progress();
    return p == null || isNaN(p) ? null : Math.round(Math.min(1, Math.max(0, p)) * 100);
  });

  readonly valueText = computed(() => this.target() ? `${this.value()} of ${this.target()}` : this.value());

  /** SVG polyline points in a 100×24 box; '' under two points. */
  readonly sparkline = computed(() => {
    const points = this.trend().filter((n) => Number.isFinite(n));
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const range = Math.max(...points) - min;
    return points
      .map((n, i) => {
        const x = (i / (points.length - 1)) * 100;
        const y = range === 0 ? 12 : 22 - ((n - min) / range) * 20;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  });
}
