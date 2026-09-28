import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import { BackendService } from './rest_service';
import { BaseRestService } from './base_rest.service';
import { UserPaymentMethod } from '../model/appdata';

/**
 * UserPaymentMethodService — consumer-side saved-payment-methods API.
 *
 * list goes through keel's generic REST CRUD against the UserSpecific basis
 * user_payment_method table. remove and setDefault are keel table actions:
 * remove detaches the method at the provider before deleting the row, so keel
 * grants no generic DELETE on the table.
 */
@Injectable({ providedIn: 'root' })
export class UserPaymentMethodService extends BaseRestService {
  private readonly backend = inject(BackendService);

  /**
   * List the caller's saved payment methods. Returns rows with PascalCase
   * fields per the generic-CRUD convention; the default row sorts first
   * server-side (filter ordering is set on rest_api_header).
   */
  list(): Observable<UserPaymentMethod[]> {
    return this.backend.list<UserPaymentMethod>('user_payment_method');
  }

  /** Detach a saved payment method at the provider and delete it. */
  remove(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url(RestURL.paymentMethodRemoveURL), { id });
  }

  /** Mark one row as default; clears every other row in the same call. */
  setDefault(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url(RestURL.paymentMethodSetDefaultURL), { id });
  }
}
