import { ObjectRef } from './turn_event';

export type DecisionOutcome = 'allow' | 'deny' | 'pending';

export interface PrincipalRef {
  kind: string;
  id: string;
}

export interface AuthorityRef {
  subject: PrincipalRef;
  grant_id?: string;
  grantor?: PrincipalRef;
}

/**
 * One audit record as sail renders it. The audit endpoint is the app's, so the app maps its
 * response onto this shape; `id` is whatever key the endpoint gives a record.
 */
export interface DecisionRecord {
  id: string | number;
  category: string;
  action: string;
  resource: string;
  outcome: DecisionOutcome;
  reason: string;
  principal: PrincipalRef;
  authority?: AuthorityRef;
  scope_id?: string;
  release_version?: string;
  policy_id?: string;
  policy_version?: string;
  obligations?: string[];
  evidence?: ObjectRef;
  request_id: string;
  conversation_id?: string;
  occurred_at: string;
}

export interface DecisionCategoryGroup {
  category: string;
  records: DecisionRecord[];
}
