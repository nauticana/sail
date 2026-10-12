import { Directive, TemplateRef, inject, input } from '@angular/core';
import { AgentSummary } from '../model/agent_studio';

/**
 * A product tab of <sail-studio-page>:
 * `<ng-template sailStudioTab="governance" label="Governance" let-agent>…</ng-template>`.
 * The template's context is the selected agent's summary.
 */
@Directive({ selector: 'ng-template[sailStudioTab]' })
export class StudioTabDirective {
  readonly id = input.required<string>({ alias: 'sailStudioTab' });
  readonly label = input.required<string>();
  readonly template = inject<TemplateRef<{ $implicit: AgentSummary }>>(TemplateRef);
}
