import { inject, Injectable } from '@angular/core';
import { Observable, defaultIfEmpty, forkJoin, map } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { RestURL } from './rest_url';
import { ApprovalPolicy, ApprovalPolicyChange } from '../model/approval_policy';

/**
 * Client for keel's `approval_policy` REST table and `handler.ApprovalPolicyHandler`.
 * With `platform` it reads and changes the platform's policy instead of the session partner's.
 */
@Injectable({ providedIn: 'root' })
export class ApprovalPolicyService extends BaseRestService {
  private readonly backend = inject(BackendService);

  /** The session partner's open row for a review kind; null when it has none. */
  current(objectType: string): Observable<ApprovalPolicy | null> {
    return this.backend.list<ApprovalPolicy>('approval_policy', { ObjectType: objectType }, { orderBy: 'id desc', limit: 1 })
      .pipe(map(([row]) => (row && !row.Endda ? row : null)));
  }

  /** The open rules by object type; a kind without one is absent. */
  open(objectTypes: readonly string[], platform = false): Observable<Record<string, ApprovalPolicyChange>> {
    const rules = platform
      ? this.http.get<ApprovalPolicyChange[]>(this.url(RestURL.approvalPolicyPlatformURL))
      : forkJoin(objectTypes.map((t) => this.current(t))).pipe(defaultIfEmpty([]), map((rows) => rows.flatMap((row) =>
        row ? [{ objectType: row.ObjectType, allowSinglePerson: row.AllowSinglePerson, inForce: !!row.Begda }] : [])));
    return rules.pipe(map((rows) => Object.fromEntries(rows.map((r) => [r.objectType, r]))));
  }

  /** Allowing a single person may wait for another administrator (`inForce` false). */
  set(objectType: string, allowSinglePerson: boolean, platform = false): Observable<ApprovalPolicyChange> {
    const path = platform ? RestURL.approvalPolicySetPlatformURL : RestURL.approvalPolicySetURL;
    return this.http.post<ApprovalPolicyChange>(this.url(path), { objectType, allowSinglePerson });
  }

  /** keel refuses the administrator who made the change. */
  confirm(objectType: string, platform = false): Observable<ApprovalPolicyChange> {
    const path = platform ? RestURL.approvalPolicyConfirmPlatformURL : RestURL.approvalPolicyConfirmURL;
    return this.http.post<ApprovalPolicyChange>(this.url(path), { objectType });
  }
}
