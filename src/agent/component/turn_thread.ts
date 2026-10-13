import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, Directive, OnInit, TemplateRef, contentChildren, inject, input, signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../../component/abstract/base_async';
import { CaptionPipe } from '../../service/caption_pipe';
import { MoneyPipe } from '../../service/money_pipe';
import { ConversationTurn, TERMINAL_TURN_STATUSES } from '../model/conversation';
import { ConversationService } from '../service/conversation.service';

export interface TurnResultContext {
  $implicit: ConversationTurn;
}

/**
 * The result card of one task kind, or of every other kind with `"*"`:
 * `<ng-template sailTurnResult="kind" let-turn>…</ng-template>`.
 */
@Directive({ selector: 'ng-template[sailTurnResult]' })
export class TurnResultDirective {
  readonly kind = input.required<string>({ alias: 'sailTurnResult' });
  readonly template = inject<TemplateRef<TurnResultContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: TurnResultDirective, ctx: unknown): ctx is TurnResultContext {
    return true;
  }
}

/**
 * The signed-in person's turns from `GET {base}turns`, newest first, with status captions, cost
 * and release version, paged by `next_before` and reloaded every `pollMs` while a turn is
 * nonterminal. Selector: <sail-turn-thread>.
 */
@Component({
  selector: 'sail-turn-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet, MatButtonModule, CaptionPipe, MoneyPipe],
  templateUrl: './turn_thread.html',
})
export class TurnThreadComponent extends BaseAsync implements OnInit {
  private readonly conversation = inject(ConversationService);

  /** Only turns that served this work item; all of the person's turns when empty. */
  readonly workRef = input('');
  /** `task_kind` → label; the kind itself otherwise. */
  readonly kindLabels = input<Record<string, string>>({});
  readonly pollMs = input(10000);
  readonly emptyMessage = input('Nothing yet.');
  /** Shown for a failed turn that carries no error text. */
  readonly failedText = input('The turn failed.');

  readonly turns = signal<ConversationTurn[]>([]);
  readonly nextBefore = signal('');
  private readonly results = contentChildren(TurnResultDirective);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  ngOnInit(): void {
    this.load();
  }

  /** Reloads the first page; the pages below it are dropped. */
  load(): void {
    clearTimeout(this.timer);
    this.run(this.conversation.turns(this.workRef()), (page) => {
      this.turns.set(page.turns);
      this.nextBefore.set(page.next_before ?? '');
      if (page.turns.some((t) => !TERMINAL_TURN_STATUSES.has(t.status))) {
        this.timer = setTimeout(() => this.load(), Math.max(1000, this.pollMs()));
      }
    }, 'Failed to load the turns.');
  }

  more(): void {
    this.run(this.conversation.turns(this.workRef(), this.nextBefore()), (page) => {
      this.turns.update((rows) => [...rows, ...page.turns]);
      this.nextBefore.set(page.next_before ?? '');
    }, 'Failed to load more turns.');
  }

  label(kind: string): string {
    return this.kindLabels()[kind] ?? kind;
  }

  resultTemplate(kind: string): TemplateRef<TurnResultContext> | undefined {
    const results = this.results();
    return (results.find((r) => r.kind() === kind) ?? results.find((r) => r.kind() === '*'))?.template;
  }
}
