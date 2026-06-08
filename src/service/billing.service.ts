import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import { BaseRestService } from './base_rest.service';
import {
  CheckoutRequest,
  CheckoutResponse,
  Invoice,
  PaymentMethod,
  PortalResponse,
  PublicPlan,
  Subscription,
  UsageMeter,
} from '../model/appdata';

/**
 * BillingService — shared billing API client.
 *
 * Owns all plan/subscription/payment-method/invoice calls. Consumer apps
 * inject this service rather than duplicating HTTP wiring. See
 * keel/SHARED_PAYMENT.md for the backend contract.
 */
@Injectable({ providedIn: 'root' })
export class BillingService extends BaseRestService {
  /** Public catalog — safe to call before login. */
  listPlans(): Observable<PublicPlan[]> {
    return this.http.get<PublicPlan[]>(this.url(RestURL.plansURL));
  }

  /**
   * Create a provider-hosted checkout session; caller redirects to the URL.
   *
   * The endpoint is JWT-gated and validates `priceId`, `successUrl`,
   * `cancelUrl` against server-side allowlists. Configure
   * `AllowedRedirectHosts` and `AllowedPriceIDs` on the keel deployment
   * or every checkout will be rejected with 400.
   */
  createCheckout(req: CheckoutRequest): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(this.url(RestURL.checkoutURL), req);
  }

  /** Current partner's active subscription. */
  getSubscription(): Observable<Subscription> {
    return this.http.get<Subscription>(this.url(RestURL.subscriptionURL));
  }

  /** Cancel auto-renew on the current subscription. */
  cancelSubscription(): Observable<void> {
    return this.http.post<void>(this.url(RestURL.cancelSubURL), {});
  }

  /** Partner's invoice history. */
  listInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(this.url(RestURL.invoicesURL));
  }

  /** Payment methods on file for the partner. */
  listPaymentMethods(): Observable<PaymentMethod[]> {
    return this.http.get<PaymentMethod[]>(this.url(RestURL.paymentMethodsURL));
  }

  /**
   * Create a provider customer-portal session; caller redirects to the URL so
   * the partner can manage their payment method / subscription on the
   * provider's hosted page.
   */
  createPortalSession(): Observable<PortalResponse> {
    return this.http.post<PortalResponse>(this.url(RestURL.portalURL), {});
  }

  /** Current-period usage per resource (used vs plan limit). */
  listUsage(): Observable<UsageMeter[]> {
    return this.http.get<UsageMeter[]>(this.url(RestURL.usageURL));
  }
}
