import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BaseAsync } from '../../component/abstract/base_async';
import { CaptionPipe } from '../../service/caption_pipe';
import { ApprovalRequest, ApprovalVerdict } from '../model/approval';
import { ApprovalService } from '../service/approval.service';

/**
 * The signed-in person's pending approvals and a decision view: approve, reject, or edit a
 * tool call's arguments. A 409 (reassigned or decided elsewhere) reloads the list.
 * Selector: <sail-approval-inbox>.
 */
@Component({
  selector: 'sail-approval-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatInputModule, CaptionPipe],
  templateUrl: './approval_inbox.html',
})
export class ApprovalInboxComponent extends BaseAsync implements OnInit {
  private readonly approvals = inject(ApprovalService);

  readonly decided = output<ApprovalRequest>();

  readonly requests = signal<ApprovalRequest[]>([]);
  readonly selectedKey = signal('');
  readonly reason = signal('');
  readonly revisedArguments = signal('');
  readonly selected = computed(() => this.requests().find((r) => this.key(r) === this.selectedKey()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(this.approvals.pending(), (rows) => {
      this.requests.set(rows);
      if (!this.selected()) this.select(rows[0]);
    }, 'Failed to load approvals.');
  }

  select(request: ApprovalRequest | undefined): void {
    this.selectedKey.set(request ? this.key(request) : '');
    this.reason.set('');
    this.revisedArguments.set('');
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
    this.run(this.approvals.resolve({
      request_id: request.request_id,
      execution_step_id: request.execution_step_id,
      verdict,
      proposed_digest: request.proposed_digest,
      reason: this.reason().trim() || undefined,
      revised_arguments: revised,
    }), (result) => {
      this.requests.update((rows) => rows.filter((r) => this.key(r) !== this.key(request)));
      this.select(this.requests()[0]);
      this.decided.emit(result);
    }, 'Failed to record the decision.', (err) => {
      if ((err as { status?: number })?.status !== 409) return;
      this.load();
      this.errorMessage.set('This request was reassigned or decided elsewhere; the list was refreshed.');
    });
  }

  key(request: ApprovalRequest): string {
    return `${request.request_id}#${request.execution_step_id}`;
  }
}

function parseObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}
