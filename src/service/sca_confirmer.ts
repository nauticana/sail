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
 * the inline `clientSecret` branch delegates here.
 */
export interface ScaConfirmer {
  confirm(clientSecret: string): Promise<ScaResult>;
}

export const SCA_CONFIRMER = new InjectionToken<ScaConfirmer>('SailScaConfirmer');
