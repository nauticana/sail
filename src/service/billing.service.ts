import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import {
  CheckoutRequest,
  CheckoutResponse,
  Invoice,
  PaymentMethod,
  PublicPlan,
  Subscription,
} from '../model/appdata';

/**
 * BillingService — shared billing API client.
 *
 * Owns all plan/subscription/payment-method/invoice calls. Consumer apps
 * inject this service rather than duplicating HTTP wiring. See
 * keel/SHARED_PAYMENT.md for the backend contract.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    return RestURL.httpHost + path;
  }

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
}
