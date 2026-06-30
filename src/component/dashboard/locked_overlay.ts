import { ChangeDetectionStrategy, Component, TemplateRef, ViewEncapsulation, contentChild, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

/**
 * Entitlement gate that renders an upgrade prompt over a feature. The protected
 * content is supplied as an <ng-template> and is instantiated ONLY when unlocked —
 * so when locked there is nothing behind it: no DOM nodes, no chart canvas, no
 * data binding, no triggered network call. This is the strict free-tier rule
 * (DASHBOARD.md): a locked card provably exposes no data.
 *
 *   <sail-locked-overlay [locked]="!entitled()" feature="Trends" (upgrade)="goUpgrade()">
 *     <ng-template><canvas baseChart ...></canvas></ng-template>
 *   </sail-locked-overlay>
 */
@Component({
  selector: 'sail-locked-overlay',
  templateUrl: './locked_overlay.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, MatButtonModule],
})
export class LockedOverlayComponent {
  readonly locked = input.required<boolean>();
  readonly feature = input<string>('');
  readonly message = input<string>('Upgrade to unlock this feature.');
  readonly ctaLabel = input<string>('Upgrade');
  readonly upgrade = output<void>();

  /** The protected content, provided as a single <ng-template> by the consumer. */
  readonly content = contentChild(TemplateRef);
}
