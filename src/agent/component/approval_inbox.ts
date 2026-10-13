import { DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, Directive, ElementRef, Injector, OnInit, Signal, TemplateRef, afterNextRender,
  computed, contentChildren, inject, input, output, signal, viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { BaseAsync } from '../../component/abstract/base_async';
import { CaptionPipe } from '../../service/caption_pipe';
import { errorDetail, httpStatus } from '../../util/errors';
import {
  ApprovalRequest, ApprovalVerdict, CONFIRMATION_NOTE_MAX, Confirmation, ReconcileOutcome,
} from '../model/approval';
import { principalName } from '../model/decision';
import { ApprovalService } from '../service/approval.service';

export interface ApprovalPreviewContext {
  $implicit: Confirmation;
}

/**
 * How one tool's confirmation preview reads, or every other tool's with `"*"`:
 * `<ng-template sailApprovalPreview="tool" let-c>…</ng-template>`. Without one the preview prints as JSON.
 */
@Directive({ selector: 'ng-template[sailApprovalPreview]' })
export class ApprovalPreviewDirective {
  readonly tool = input.required<string>({ alias: 'sailApprovalPreview' });
  readonly template = inject<TemplateRef<ApprovalPreviewContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: ApprovalPreviewDirective, ctx: unknown): ctx is ApprovalPreviewContext {
    return true;
  }
}

export interface ApprovalInboxSection {
  title: string;
  requests: ApprovalRequest[];
  confirmations: Confirmation[];
}

const actionErrors: Record<number, string> = {
  403: 'You are not allowed to do this here.',
  404: 'This item no longer exists, or you can no longer see it; the list was refreshed.',
  409: 'This item changed or was decided elsewhere; the list was refreshed.',
};

/**
 * The signed-in person's pending approvals and MCP confirmations, grouped as waiting, submitted,
 * needing reconciliation and recent, with a decision view: approve, reject, or edit a tool call's
 * arguments; confirm, decline, withdraw, or reconcile a confirmation. Approving asks once more, and
 * reconciling requires a note. A list the backend does not serve (404) stays empty.
 * Selector: <sail-approval-inbox>.
 */
@Component({
  selector: 'sail-approval-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, NgTemplateOutlet, MatButtonModule, MatFormFieldModule, MatInputModule, CaptionPipe],
  templateUrl: './approval_inbox.html',
})
export class ApprovalInboxComponent extends BaseAsync implements OnInit {
  private readonly approvals = inject(ApprovalService);
  private readonly injector = inject(Injector);
  private readonly previews = contentChildren(ApprovalPreviewDirective);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly yes = viewChild<ElementRef<HTMLElement>>('yes');
  private opened = '';

  /** The item to open first: an approval or confirmation key, or a confirmation id from a link. */
  readonly open = input('');

  readonly decided = output<ApprovalRequest>();
  readonly confirmationChanged = output<Confirmation>();

  readonly noteMax = CONFIRMATION_NOTE_MAX;
  readonly name = principalName;
  readonly requests = signal<ApprovalRequest[]>([]);
  readonly confirmations = signal<Confirmation[]>([]);
  readonly sections = computed(() => groupInbox(this.requests(), this.confirmations()));
  readonly selectedKey = signal('');
  readonly reason = signal('');
  readonly revisedArguments = signal('');
  /** The approve step awaits its second click. */
  readonly confirming = signal(false);
  readonly selected = computed(() => this.requests().find((r) => this.key(r) === this.selectedKey()));
  readonly selectedConfirmation = computed(() => this.confirmations().find((c) => this.confirmationKey(c) === this.selectedKey()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(forkJoin([
      this.listed(this.approvals.pending(), this.requests(), 'Failed to load approvals.'),
      this.listed(this.approvals.confirmations(), this.confirmations(), 'Failed to load confirmations.'),
    ]), ([requests, confirmations]) => {
      this.requests.set(requests);
      this.confirmations.set(confirmations);
      const link = this.open();
      if (link && link !== this.opened) {
        const linked = requests.find((r) => this.key(r) === link)
          ?? confirmations.find((c) => this.confirmationKey(c) === link || String(c.id) === link);
        if (linked) {
          this.opened = link;
          this.select('request_id' in linked ? this.key(linked) : this.confirmationKey(linked));
          this.focus(this.heading);
          return;
        }
        if (!this.successMessage()) {
          this.successMessage.set('The linked item is not listed: it may be decided, withdrawn or expired, or not yours to act on.');
        }
      }
      if (!this.selected() && !this.selectedConfirmation()) {
        this.selectFirst();
      }
    });
  }

  select(key: string): void {
    this.selectedKey.set(key);
    this.reason.set('');
    this.revisedArguments.set('');
    this.confirming.set(false);
  }

  askApprove(): void {
    this.confirming.set(true);
    this.focus(this.yes);
  }

  cancelApprove(): void {
    this.confirming.set(false);
    this.focus(this.heading);
  }

  previewTemplate(tool: string): TemplateRef<ApprovalPreviewContext> | undefined {
    const previews = this.previews();
    return (previews.find((p) => p.tool() === tool) ?? previews.find((p) => p.tool() === '*'))?.template;
  }

  decide(verdict: ApprovalVerdict): void {
    const request = this.selected();
    if (!request) return;
    let revised: Record<string, unknown> | undefined;
    if (verdict === 'E') {
      revised = parseObject(this.revisedArguments());
      if (!revised) {
        this.errorMessage.set('Revised arguments must be a JSON object.');
        return;
      }
    }
    this.act(this.approvals.resolve({
      request_id: request.request_id,
      execution_step_id: request.execution_step_id,
      verdict,
      proposed_digest: request.proposed_digest,
      reason: this.reason().trim() || undefined,
      revised_arguments: revised,
    }), (result) => {
      this.requests.update((rows) => rows.filter((r) => this.key(r) !== this.key(request)));
      this.selectFirst();
      this.decided.emit(result);
      return verdict === 'X' ? 'Rejected.' : 'Approved.';
    });
  }

  confirm(approve: boolean): void {
    const c = this.selectedConfirmation();
    if (!c) return;
    this.applyConfirmation(this.approvals.decideConfirmation(c, approve, this.reason().trim()),
      approve ? 'Confirmed; the action runs shortly.' : 'Declined; nothing was done.');
  }

  withdraw(): void {
    const c = this.selectedConfirmation();
    if (!c || !window.confirm('Withdraw this confirmation?')) return;
    this.act(this.approvals.withdrawConfirmation(c), () => {
      this.load();
      return 'Withdrawn; nothing will be done.';
    });
  }

  reconcile(outcome: ReconcileOutcome): void {
    const c = this.selectedConfirmation();
    const note = this.reason().trim();
    if (!c || !note) return;
    this.applyConfirmation(this.approvals.reconcileConfirmation(c, outcome, note), 'Outcome recorded; the action was not run again.');
  }

  key(request: ApprovalRequest): string {
    return `${request.request_id}#${request.execution_step_id}`;
  }

  confirmationKey(c: Confirmation): string {
    return `${c.tenant_id}/${c.id}`;
  }

  private applyConfirmation(request: Observable<Confirmation>, done: string): void {
    this.act(request, (result) => {
      this.confirmations.update((rows) => rows.map((c) => c.id === result.id && c.tenant_id === result.tenant_id ? result : c));
      this.confirmationChanged.emit(result);
      return done;
    });
  }

  private act<T>(request: Observable<T>, done: (result: T) => string): void {
    this.run(request, (result) => {
      this.reason.set('');
      this.confirming.set(false);
      this.successMessage.set(done(result));
      this.focus(this.heading);
    }, 'Failed to record the decision.', (err) => {
      const status = httpStatus(err);
      const message = actionErrors[status ?? 0];
      if (!message) return;
      if (status !== 403) this.load();
      this.errorMessage.set(message);
    });
  }

  private listed<T>(list: Observable<T[]>, current: T[], failed: string): Observable<T[]> {
    return list.pipe(catchError((err) => {
      if (httpStatus(err) === 404) return of([]);
      this.errorMessage.set(errorDetail(err, failed));
      return of(current);
    }));
  }

  private focus(target: Signal<ElementRef<HTMLElement> | undefined>): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }

  private selectFirst(): void {
    const first = this.sections()[0];
    this.select(first?.requests[0] ? this.key(first.requests[0])
      : first?.confirmations[0] ? this.confirmationKey(first.confirmations[0]) : '');
  }
}

/** Approvals wait first; confirmations land in the first section they qualify for, open ones soonest expiry first. */
export function groupInbox(requests: ApprovalRequest[], confirmations: Confirmation[]): ApprovalInboxSection[] {
  const sections: ApprovalInboxSection[] = [
    { title: 'Waiting for your decision', requests, confirmations: [] },
    { title: 'Submitted by you', requests: [], confirmations: [] },
    { title: 'Needs reconciliation', requests: [], confirmations: [] },
    { title: 'Recent', requests: [], confirmations: [] },
  ];
  for (const c of confirmations) {
    sections[c.can_decide ? 0 : c.can_withdraw ? 1 : c.can_reconcile ? 2 : 3].confirmations.push(c);
  }
  sections.forEach((s, i) => s.confirmations.sort(i < 2
    ? (a, b) => time(a.expires_at) - time(b.expires_at)
    : (a, b) => lastActivity(b) - lastActivity(a)));
  return sections.filter((s) => s.requests.length || s.confirmations.length);
}

function time(value: string | undefined): number {
  return (value && Date.parse(value)) || 0;
}

function lastActivity(c: Confirmation): number {
  return Math.max(time(c.created_at), time(c.decided_at), time(c.completed_at));
}

function parseObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}
