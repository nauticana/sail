import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { RestURL } from './rest_url';
import { ApprovalPolicy, ApprovalPolicyChange } from '../model/approval_policy';

/** Client for keel's `approval_policy` REST table and `handler.ApprovalPolicyHandler`. */
@Injectable({ providedIn: 'root' })
export class ApprovalPolicyService extends BaseRestService {
  private readonly backend = inject(BackendService);

  /** The session partner's open row for a review kind; null when it has none. */
  current(objectType: string): Observable<ApprovalPolicy | null> {
    return this.backend.list<ApprovalPolicy>('approval_policy', { ObjectType: objectType }, { orderBy: 'id desc', limit: 1 })
      .pipe(map(([row]) => (row && !row.Endda ? row : null)));
  }

  /** Allowing a single person may wait for another administrator (`inForce` false). */
  set(objectType: string, allowSinglePerson: boolean): Observable<ApprovalPolicyChange> {
    return this.http.post<ApprovalPolicyChange>(this.url(RestURL.approvalPolicySetURL), { objectType, allowSinglePerson });
  }

  /** keel refuses the administrator who made the change. */
  confirm(objectType: string): Observable<ApprovalPolicyChange> {
    return this.http.post<ApprovalPolicyChange>(this.url(RestURL.approvalPolicyConfirmURL), { objectType });
  }
}
