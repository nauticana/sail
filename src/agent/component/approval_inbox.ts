import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, forkJoin } from 'rxjs';
import { BaseAsync } from '../../component/abstract/base_async';
import { CaptionPipe } from '../../service/caption_pipe';
import { ApprovalRequest, ApprovalVerdict, Confirmation } from '../model/approval';
import { ApprovalService } from '../service/approval.service';

/**
 * The signed-in person's pending approvals and MCP confirmations with a decision view: approve,
 * reject, or edit a tool call's arguments; confirm, decline, withdraw, or reconcile a confirmation.
 * A 409 (reassigned or decided elsewhere) reloads the list.
 * Selector: <sail-approval-inbox>.
 */
@Component({
  selector: 'sail-approval-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, MatButtonModule, MatFormFieldModule, MatInputModule, CaptionPipe],
  templateUrl: './approval_inbox.html',
})
export class ApprovalInboxComponent extends BaseAsync implements OnInit {
  private readonly approvals = inject(ApprovalService);

  readonly decided = output<ApprovalRequest>();
  readonly confirmationChanged = output<Confirmation>();

  readonly requests = signal<ApprovalRequest[]>([]);
  readonly confirmations = signal<Confirmation[]>([]);
  readonly selectedKey = signal('');
  readonly reason = signal('');
  readonly revisedArguments = signal('');
  readonly selected = computed(() => this.requests().find((r) => this.key(r) === this.selectedKey()));
  readonly selectedConfirmation = computed(() => this.confirmations().find((c) => this.confirmationKey(c) === this.selectedKey()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(forkJoin([this.approvals.pending(), this.approvals.confirmations()]), ([requests, confirmations]) => {
      this.requests.set(requests);
      this.confirmations.set(confirmations);
      if (!this.selected() && !this.selectedConfirmation()) this.select(requests[0] ? this.key(requests[0]) : confirmations[0] ? this.confirmationKey(confirmations[0]) : '');
    }, 'Failed to load approvals.');
  }

  select(key: string): void {
    this.selectedKey.set(key);
    this.reason.set('');
    this.revisedArguments.set('');
  }

  confirm(approve: boolean): void {
    const c = this.selectedConfirmation();
    if (!c) return;
    this.applyConfirmation(this.approvals.decideConfirmation(c, approve, this.reason().trim()));
  }

  withdraw(): void {
    const c = this.selectedConfirmation();
    if (!c || !window.confirm('Withdraw this confirmation?')) return;
    this.run(this.approvals.withdrawConfirmation(c), () => this.load(), 'Failed to withdraw the confirmation.');
  }

  reconcile(outcome: 'D' | 'F'): void {
    const c = this.selectedConfirmation();
    if (!c) return;
    this.applyConfirmation(this.approvals.reconcileConfirmation(c, outcome, this.reason().trim()));
  }

  private applyConfirmation(request: Observable<Confirmation>): void {
    this.run(request, (result) => {
      this.confirmations.update((rows) => rows.map((c) => c.id === result.id && c.tenant_id === result.tenant_id ? result : c));
      this.reason.set('');
      this.confirmationChanged.emit(result);
    }, 'Failed to record the decision.', (err) => this.reloadOnConflict(err));
  }

  confirmationKey(c: Confirmation): string {
    return `${c.tenant_id}/${c.id}`;
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
      this.select(this.requests()[0] ? this.key(this.requests()[0]) : '');
      this.decided.emit(result);
    }, 'Failed to record the decision.', (err) => this.reloadOnConflict(err));
  }

  private reloadOnConflict(err: unknown): void {
    if ((err as { status?: number })?.status !== 409) return;
    this.load();
    this.errorMessage.set('This request was reassigned or decided elsewhere; the list was refreshed.');
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
