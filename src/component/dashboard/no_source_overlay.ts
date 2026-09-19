import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, ViewEncapsulation, contentChild, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/** Source-readiness sibling of LockedOverlayComponent: the template is never instantiated while unavailable. */
@Component({
  selector: 'sail-no-source-overlay',
  templateUrl: './no_source_overlay.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, MatButtonModule],
})
export class NoSourceOverlayComponent {
  readonly unavailable = input.required<boolean>();
  readonly sourceName = input.required<string>();
  readonly message = input<string>('Connect this data source to continue.');
  readonly ctaLabel = input<string>('Connect');
  readonly connect = output<void>();

  readonly content = contentChild(TemplateRef);
}
