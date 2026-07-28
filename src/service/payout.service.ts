import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import { BaseRestService } from './base_rest.service';
import {
  BankInfoFormValue,
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
export class PayoutService extends BaseRestService {
  /**
   * Start provider onboarding. A non-empty URL is the hosted-KYC handoff;
   * an empty URL means confirmation continues asynchronously (for example,
   * a Wise recipient confirming from email).
   */
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

  /**
   * Replace the payout destination with a new bank-info version
   * (atomic supersede + insert on the backend). Identity changes go
   * through this, never through generic CRUD edits. `provider` and
   * `providerAgreement` are server-owned and ignored here.
   */
  replaceBankInfo(value: BankInfoFormValue): Observable<{ message: string }> {
    const { countryCode, currency, accountHolderName, billingAddress, taxIdType, taxId } = value;
    return this.http.post<{ message: string }>(this.url(RestURL.payoutBankReplaceURL),
      { countryCode, currency, accountHolderName, billingAddress, taxIdType, taxId });
  }

  /**
   * Register a payout beneficiary from provider-collected details
   * (Airwallex embedded beneficiary component). The payload passes
   * through to the provider; the backend links the returned id.
   */
  registerBeneficiary(beneficiary: unknown): Observable<{ beneficiaryId: string }> {
    return this.http.post<{ beneficiaryId: string }>(this.url(RestURL.payoutBeneficiaryURL), { beneficiary });
  }
}
