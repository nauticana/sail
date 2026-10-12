/** Scout approval desk wire types (v1.2.7). Codes render through backend captions. */

/** A approved, X rejected, E edited (tool-call proposals only, with revised arguments). */
export type ApprovalVerdict = 'A' | 'X' | 'E';

export interface ApproverReference {
  kind: string;
  ref: string;
}

/** One decision a reviewer owes; evidence stays behind its own authorization. */
export interface ApprovalRequest {
  request_id: string;
  execution_step_id: number;
  conversation_id: string;
  scope_id?: string;
  rule_id: string;
  action: string;
  resource: string;
  output_class: string;
  risk_tier: string;
  summary: string;
  proposed_digest: string;
  status: string;
  deadline_at?: string;
  created_at: string;
  revises_step_id?: number;
  rule_source: string;
  route_id?: string;
  route_step: number;
  approver_reference?: ApproverReference;
}

export interface ApprovalResolveRequest {
  request_id: string;
  execution_step_id: number;
  verdict: ApprovalVerdict;
  proposed_digest: string;
  reason?: string;
  /** The JSON object an `E` verdict runs the tool call with instead. */
  revised_arguments?: Record<string, unknown>;
}
