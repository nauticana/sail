import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import {
  PayoutOnboardingSession,
  ReusableAccount,
} from '../model/appdata';

/**
 * PayoutService — shared API client for keel/payout.
 *
 * Mirrors keel/payout/OnboardingService on the frontend: hosted-KYC
 * launch, status check, and the multi-partner reuse flow that lets a
 * user share one provider_account_id across more than one
 * (user, partner) row in user_bank_info.
 *
 * Endpoints live under /api/v1/payout/* — paths configurable via
 * RestURL.payout*URL.
 */
@Injectable({ providedIn: 'root' })
export class PayoutService {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    return RestURL.httpHost + path;
  }

  /** Launch the hosted-KYC flow. Returns a URL to open + provider-side handle. */
  startOnboarding(): Observable<PayoutOnboardingSession> {
    return this.http.post<PayoutOnboardingSession>(this.url(RestURL.payoutOnboardStartURL), {});
  }

  /** List provider accounts the user already has on OTHER partners. */
  listReusable(): Observable<{ accounts: ReusableAccount[] }> {
    return this.http.post<{ accounts: ReusableAccount[] }>(this.url(RestURL.payoutReusableURL), {});
  }

  /** Copy an existing provider_account_id onto the calling partner's row. */
  linkReusable(providerAccountId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url(RestURL.payoutReusableLinkURL), { providerAccountId });
  }

  /** True when the calling user has a populated provider_account_id on the active partner row. */
  status(): Observable<{ complete: boolean }> {
    return this.http.post<{ complete: boolean }>(this.url(RestURL.payoutStatusURL), {});
  }
}
