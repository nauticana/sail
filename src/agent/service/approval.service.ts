import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseRestService } from '../../service/base_rest.service';
import { ApprovalRequest, ApprovalResolveRequest } from '../model/approval';

/** Client for Scout's approval desk under the fixed `/api/approval/` path. */
@Injectable({ providedIn: 'root' })
export class ApprovalService extends BaseRestService {
  /** The requests the signed-in person may decide now, soonest deadline first. */
  pending(): Observable<ApprovalRequest[]> {
    return this.http.get<ApprovalRequest[]>(this.url('/api/approval/pending'));
  }

  /** 409 when the request was reassigned or decided differently since it was read. */
  resolve(request: ApprovalResolveRequest): Observable<ApprovalRequest> {
    return this.http.post<ApprovalRequest>(this.url('/api/approval/resolve'), request);
  }
}
