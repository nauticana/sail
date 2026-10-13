import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseRestService } from '../../service/base_rest.service';
import { ApprovalRequest, ApprovalResolveRequest, Confirmation, ConfirmationKey, ReconcileOutcome } from '../model/approval';

const base = '/api/approval/';

/** Client for Scout's approval desk and MCP confirmation inbox under the fixed `/api/approval/` path. */
@Injectable({ providedIn: 'root' })
export class ApprovalService extends BaseRestService {
  /** The requests the signed-in person may decide now, soonest deadline first. */
  pending(): Observable<ApprovalRequest[]> {
    return this.http.get<ApprovalRequest[]>(this.url(base + 'pending'));
  }

  /** 409 when the request was reassigned or decided differently since it was read. */
  resolve(request: ApprovalResolveRequest): Observable<ApprovalRequest> {
    return this.http.post<ApprovalRequest>(this.url(base + 'resolve'), request);
  }

  /** Lists open confirmations plus those since the RFC 3339 time; zero limit takes Scout's batch. */
  confirmations(since = '', limit = 0): Observable<Confirmation[]> {
    return this.http.get<Confirmation[]>(this.url(base + 'confirmations'), { params: { since, limit } });
  }

  decideConfirmation(key: ConfirmationKey, approve: boolean, note = ''): Observable<Confirmation> {
    return this.http.post<Confirmation>(this.url(base + 'confirmation/decide'), { ...key, approve, note });
  }

  withdrawConfirmation(key: ConfirmationKey): Observable<ConfirmationKey> {
    return this.http.post<ConfirmationKey>(this.url(base + 'confirmation/withdraw'), key);
  }

  /** Records the verified outcome of an unknown confirmation; the note is required. */
  reconcileConfirmation(key: ConfirmationKey, outcome: ReconcileOutcome, note: string): Observable<Confirmation> {
    return this.http.post<Confirmation>(this.url(base + 'confirmation/reconcile'), { ...key, outcome, note });
  }
}
