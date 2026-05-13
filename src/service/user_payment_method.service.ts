import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import { BackendService } from './rest_service';
import { BaseRestService } from './base_rest.service';
import { UserPaymentMethod } from '../model/appdata';

/**
 * UserPaymentMethodService — consumer-side saved-payment-methods API.
 *
 * list and delete go through keel's generic REST CRUD against the
 * basis user_payment_method table — that table is UserSpecific (FK
 * column `user_id`), so the auto-filter scopes reads + owner-locks
 * DELETE without any custom server-side glue. setDefault has a custom
 * endpoint because it needs an atomic multi-row UPDATE
 * (`SET is_default = (id = ?) WHERE user_id = session`) that abstract
 * single-row CRUD can't express.
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

  /** Delete a saved payment method. user_id is auto-scoped by keel. */
  delete(id: number): Observable<{ message: string }> {
    return this.backend.delete('user_payment_method', { Id: String(id) });
  }

  /**
   * Mark one row as default; clears every other row in the same call.
   * Custom endpoint — see service-class doc for the rationale.
   */
  setDefault(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url(RestURL.paymentMethodSetDefaultURL), { id });
  }
}
