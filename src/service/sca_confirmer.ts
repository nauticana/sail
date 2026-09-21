import { InjectionToken } from '@angular/core';

/** Outcome of a client-side SCA / 3DS confirmation attempt. */
export type ScaOutcome = 'succeeded' | 'failed' | 'cancelled';

export interface ScaResult {
  outcome: ScaOutcome;
  error?:  string;
}

/**
 * Provider-agnostic port for confirming a Strong Customer Authentication (3DS)
 * challenge on a `client_secret` returned by an off-session charge.
 *
 * sail ships NO provider SDK and NO default implementation — each app provides
 * one for its payment provider (e.g. a thin Stripe.js wrapper calling
 * `stripe.handleNextAction({ clientSecret })`) and registers it at composition
 * time, keeping the provider choice out of the shared library:
 *
 *   { provide: SCA_CONFIRMER, useClass: StripeScaConfirmer }
 *
 * The `actionUrl` (provider-hosted redirect) branch needs no confirmer — only
 * the inline `clientSecret` branches delegate here.
 */
export interface ScaConfirmer {
  /** Run the intent's `next_action` (Stripe.js `handleNextAction`). */
  confirm(clientSecret: string): Promise<ScaResult>;
  /**
   * Re-confirm the intent on-session with the method the issuer refused
   * off-session (Stripe.js `confirmCardPayment`, stripe-ios
   * `STPPaymentHandler.confirmPayment`) — there is no `next_action` to run.
   */
  confirmWithMethod(clientSecret: string, paymentMethodId: string): Promise<ScaResult>;
}

export const SCA_CONFIRMER = new InjectionToken<ScaConfirmer>('SailScaConfirmer');
