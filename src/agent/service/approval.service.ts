import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseRestService } from '../../service/base_rest.service';
import { ApprovalRequest, ApprovalResolveRequest, Confirmation, ConfirmationKey } from '../model/approval';

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

  /** Open confirmations and those created since `since` (RFC 3339), across the person's tenants. */
  confirmations(since = ''): Observable<Confirmation[]> {
    return this.http.get<Confirmation[]>(this.url(base + 'confirmations'), { params: since ? { since } : {} });
  }

  decideConfirmation(key: ConfirmationKey, approve: boolean, note = ''): Observable<Confirmation> {
    return this.http.post<Confirmation>(this.url(base + 'confirmation/decide'), { ...key, approve, note });
  }

  withdrawConfirmation(key: ConfirmationKey): Observable<ConfirmationKey> {
    return this.http.post<ConfirmationKey>(this.url(base + 'confirmation/withdraw'), key);
  }

  /** Records the verified outcome of an unknown confirmation: D executed or F failed. */
  reconcileConfirmation(key: ConfirmationKey, outcome: 'D' | 'F', note = ''): Observable<Confirmation> {
    return this.http.post<Confirmation>(this.url(base + 'confirmation/reconcile'), { ...key, outcome, note });
  }
}
