import { ChangeDetectionStrategy, Component, ViewEncapsulation, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable, forkJoin, of } from 'rxjs';
import { BaseAsync } from '../abstract/base_async';
import { ApprovalPolicy, ApprovalPolicyChange, ApprovalReviewKind } from '../../model/approval_policy';
import { ApprovalPolicyService } from '../../service/approval_policy.service';
import { BaseAuthService } from '../../service/auth.service';

/** The session partner's separation-of-duties policy per review kind. */
@Component({
  selector: 'sail-approval-policy',
  templateUrl: './approval_policy.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatSlideToggleModule],
})
export class ApprovalPolicyComponent extends BaseAsync {
  private readonly service = inject(ApprovalPolicyService);
  private readonly auth = inject(BaseAuthService);

  readonly reviewKinds = input.required<readonly ApprovalReviewKind[]>();
  readonly changed = output<ApprovalPolicyChange>();

  readonly policies = signal<Record<string, ApprovalPolicy | null>>({});
  readonly saving = signal<string | null>(null);

  private readonly kindsEffect = effect(() => this.reload());

  reload(): void {
    const kinds = this.reviewKinds();
    const requests = Object.fromEntries(kinds.map((kind) => [kind.objectType, this.service.current(kind.objectType)]));
    this.run(kinds.length ? forkJoin(requests) : of({}), (rows) => this.policies.set(rows), 'Could not load approval policies.');
  }

  canChange(): boolean {
    return this.auth.hasPermission('APPROVAL_POLICY', 'CHANGE', 'approval_policy');
  }

  /** Open row in force that lets one person decide. */
  allowsSinglePerson(objectType: string): boolean {
    const row = this.policies()[objectType];
    return !!row?.AllowSinglePerson && !!row.Begda;
  }

  /** Allowing one person was set and waits for another administrator's confirmation. */
  isPending(objectType: string): boolean {
    const row = this.policies()[objectType];
    return !!row && !row.Begda;
  }

  toggle(objectType: string, event: MatSlideToggleChange): void {
    this.save(objectType, this.service.set(objectType, event.checked), () => { event.source.checked = !event.checked; });
  }

  withdraw(objectType: string): void {
    this.save(objectType, this.service.set(objectType, false));
  }

  confirm(objectType: string): void {
    this.save(objectType, this.service.confirm(objectType));
  }

  private save(objectType: string, request: Observable<ApprovalPolicyChange>, undo?: () => void): void {
    this.saving.set(objectType);
    this.run(request, (change) => {
      this.saving.set(null);
      this.changed.emit(change);
      this.reload();
      if (!change.inForce) this.successMessage.set('Another administrator must confirm this change.');
    }, 'Could not change the approval policy.', () => {
      this.saving.set(null);
      undo?.();
    });
  }
}
