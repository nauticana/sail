import { ChangeDetectionStrategy, Component, ViewEncapsulation, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable } from 'rxjs';
import { BaseAsync } from '../abstract/base_async';
import { ApprovalPolicyChange, ApprovalReviewKind } from '../../model/approval_policy';
import { ApprovalPolicyService } from '../../service/approval_policy.service';
import { BaseAuthService } from '../../service/auth.service';

/** The session partner's, or with `platform` the platform's, separation-of-duties policy per review kind. */
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
  readonly platform = input(false);
  readonly changed = output<ApprovalPolicyChange>();

  readonly policies = signal<Record<string, ApprovalPolicyChange>>({});
  readonly saving = signal<string | null>(null);

  private readonly kindsEffect = effect(() => this.reload());

  reload(): void {
    const objectTypes = this.reviewKinds().map((kind) => kind.objectType);
    this.run(this.service.open(objectTypes, this.platform()), (rules) => this.policies.set(rules), 'Could not load approval policies.');
  }

  canChange(): boolean {
    return this.auth.hasPermission('APPROVAL_POLICY', this.platform() ? 'CHANGE_PLATFORM' : 'CHANGE', 'approval_policy');
  }

  allowsSinglePerson(objectType: string): boolean {
    const rule = this.policies()[objectType];
    return !!rule?.allowSinglePerson && rule.inForce;
  }

  isPending(objectType: string): boolean {
    return this.policies()[objectType]?.inForce === false;
  }

  toggle(objectType: string, event: MatSlideToggleChange): void {
    this.save(objectType, this.service.set(objectType, event.checked, this.platform()), () => { event.source.checked = !event.checked; });
  }

  withdraw(objectType: string): void {
    this.save(objectType, this.service.set(objectType, false, this.platform()));
  }

  confirm(objectType: string): void {
    this.save(objectType, this.service.confirm(objectType, this.platform()));
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
