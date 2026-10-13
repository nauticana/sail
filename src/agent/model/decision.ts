/** A allowed, D denied, P pending (`audit_decision_outcome`). */
export type DecisionOutcome = 'A' | 'D' | 'P';

export interface PrincipalRef {
  kind: string;
  id: string;
  /** The product's caption for the principal (Scout `contract.Labeler`). */
  label?: string;
}

export interface AuthorityRef {
  subject: PrincipalRef;
  grant_id?: string;
  grantor?: PrincipalRef;
}

/** One governed decision of the tenant (Scout `api.DecisionRecord`); evidence is a digest only. */
export interface DecisionRecord {
  id: number;
  category: string;
  action: string;
  resource: string;
  outcome: DecisionOutcome;
  reason: string;
  principal: PrincipalRef;
  authority?: AuthorityRef;
  /** The client application the principal acted through. */
  client_ref?: string;
  client_label?: string;
  work_ref?: string;
  scope_id?: string;
  release_version?: string;
  policy_id?: string;
  policy_version?: string;
  obligations?: string[];
  evidence_digest?: string;
  request_id: string;
  conversation_id?: string;
  occurred_at: string;
}

/** Newest first; `next_before` is absent on the last page. */
export interface DecisionPage {
  records: DecisionRecord[];
  next_before?: number;
}

export interface DecisionCategoryGroup {
  category: string;
  records: DecisionRecord[];
}

/** A principal's label, or its kind and id. */
export function principalName(ref: PrincipalRef): string {
  return ref.label || `${ref.kind} ${ref.id}`;
}
