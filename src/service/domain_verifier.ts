import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** keel domain_verification_method codes the component can run: email code, DNS TXT record, HTTP file. */
export type DomainVerificationMethod = 'EC' | 'DT' | 'HF';

/** keel's issued challenge (the `challenge` of the `partner_domain` `challenge` action). */
export interface DomainChallenge {
  method: string;
  domainUrl: string;
  domainName: string;
  expiresAt: string;
  recordName?: string;
  recordValue?: string;
  fileUrl?: string;
  fileBody?: string;
}

/**
 * Port for proving ownership of a domain.
 *
 * sail ships no implementation — the endpoints, their paths and their payloads are
 * the app's. Register one at composition time:
 *
 *   { provide: DOMAIN_VERIFIER, useExisting: RegistrationService }
 *
 * `requestVerification` sends an email code. `challenge` issues a DNS TXT or HTTP
 * file challenge; implement it to offer those methods. `confirm` receives the
 * method for a challenge and an empty code. `DomainVerificationComponent` reads only
 * success or failure of the other calls, and reports a failure through `errorDetail()`.
 */
export interface DomainVerifier {
  requestVerification(domain: string): Observable<unknown>;
  challenge?(domain: string, method: Exclude<DomainVerificationMethod, 'EC'>): Observable<DomainChallenge>;
  confirm(domain: string, code: string, method?: DomainVerificationMethod): Observable<unknown>;
}

export const DOMAIN_VERIFIER = new InjectionToken<DomainVerifier>('SailDomainVerifier');
