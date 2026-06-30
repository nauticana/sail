/** Lifecycle state of a data/chart card (sail-data-card). */
export type DataCardState = 'loading' | 'ready' | 'empty' | 'error' | 'locked';

/** A prioritized, completable next-best-action (sail-action-center, FR-008). */
export interface ActionItem {
  id: string;
  title: string;
  reason: string;
  ctaLabel: string;
  /** Higher sorts first; defaults to 0. */
  priority?: number;
  done?: boolean;
}

/** One selectable scope entity (e.g. a business) for sail-entity-selector. */
export interface EntityOption {
  id: string;
  label: string;
  /** Defaults to true; the selector defaults to the first active entity. */
  active?: boolean;
}

/** Step of the self-service verification flow (sail-verification-flow). */
export type VerificationStep = 'idle' | 'requested' | 'verifying' | 'verified' | 'error';
