import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../../component/abstract/base_async';
import { CaptionPipe } from '../../service/caption_pipe';
import { DecisionOutcome, DecisionRecord } from '../model/decision';
import { AgentStudioService } from '../service/agent_studio.service';

/**
 * What assistants did in the tenant: Scout's decision records (`decisions` feature, `AGENT_AUDIT`
 * `VIEW`), newest first and paged by `next_before`. Selector: <sail-assistant-activity>.
 */
@Component({
  selector: 'sail-assistant-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, CaptionPipe],
  templateUrl: './assistant_activity.html',
})
export class AssistantActivityComponent extends BaseAsync implements OnInit {
  private readonly studio = inject(AgentStudioService);

  readonly category = input('');
  readonly outcome = input<DecisionOutcome | undefined>(undefined);
  /** Who acted, as the app names its principals; kind and id by default. */
  readonly who = input<(record: DecisionRecord) => string>((r) => `${r.principal.kind} ${r.principal.id}`);

  readonly records = signal<DecisionRecord[]>([]);
  readonly nextBefore = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(before = 0): void {
    this.run(this.studio.decisions(before, 0, this.category(), this.outcome()), (page) => {
      this.records.update((rows) => before ? [...rows, ...page.records] : page.records);
      this.nextBefore.set(page.next_before ?? 0);
    }, 'Failed to load assistant activity.');
  }
}
