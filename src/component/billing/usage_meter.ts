import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { UsageMeter } from '../../model/appdata';

/** Per-row view model derived from a UsageMeter for accessible rendering. */
interface UsageRow {
  resource:  string;
  hasBar:    boolean;   // limit > 0 → determinate progress bar; else text-only
  percent:   number;    // fill width 0..100 (clamped)
  ariaMax:   number;    // limit (only meaningful when hasBar)
  ariaNow:   number;    // used, clamped to [0, limit] for a valid progressbar
  valueText: string;    // "used / limit", "used / Unlimited" (<0), or "used / 0"
}

/**
 * Presentational usage meters — one progress bar per resource (used / limit).
 * Stateless; the caller (or BillingService.listUsage) supplies the data.
 *
 * Limit semantics mirror keel's UsageItem: `limit < 0` = unlimited (keel's
 * documented sentinel), `limit === 0` = a real zero / unprovisioned cap. Only
 * `limit > 0` renders a determinate progress bar; the other two are text-only.
 */
@Component({
  selector: 'sail-usage-meter',
  templateUrl: './usage_meter.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class UsageMeterComponent {
  readonly meters = input<UsageMeter[]>([]);

  readonly rows = computed<UsageRow[]>(() =>
    this.meters().map((m) => {
      const hasBar = m.limit > 0;
      return {
        resource:  m.resource,
        hasBar,
        percent:   hasBar ? Math.min(100, Math.max(0, Math.round((m.used / m.limit) * 100))) : 0,
        ariaMax:   m.limit,
        ariaNow:   hasBar ? Math.min(Math.max(0, m.used), m.limit) : m.used,
        valueText: `${m.used} / ${m.limit < 0 ? 'Unlimited' : m.limit}`,
      };
    }),
  );
}
