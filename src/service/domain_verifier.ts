import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Port for proving ownership of a domain: issue a code, then confirm it.
 *
 * sail ships no implementation — the endpoints, their paths and their payloads are
 * the app's. Register one at composition time:
 *
 *   { provide: DOMAIN_VERIFIER, useExisting: RegistrationService }
 *
 * Both methods may emit any body; `DomainVerificationComponent` reads only success
 * or failure, and reports the failure through `errorDetail()`.
 */
export interface DomainVerifier {
  requestVerification(domain: string): Observable<unknown>;
  confirm(domain: string, code: string): Observable<unknown>;
}

export const DOMAIN_VERIFIER = new InjectionToken<DomainVerifier>('SailDomainVerifier');
