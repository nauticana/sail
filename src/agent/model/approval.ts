import { PrincipalRef } from './decision';

/** Scout approval desk and MCP confirmation inbox wire types (v1.2.14). Codes render through backend captions. */

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

/** `mcp_confirmation_status`: P pending, A approved, R running, D executed, F failed, U unknown, X declined, W withdrawn, T expired. */
export type ConfirmationStatus = 'P' | 'A' | 'R' | 'D' | 'F' | 'U' | 'X' | 'W' | 'T';

/** A verified reconciliation outcome. */
export type ReconcileOutcome = Extract<ConfirmationStatus, 'D' | 'F'>;

/** Scout's bound on decision and reconciliation notes, in characters. */
export const CONFIRMATION_NOTE_MAX = 500;

export interface ConfirmationKey {
  tenant_id: number;
  id: number;
}

/** One MCP tool call awaiting or past a person's confirmation; never its payload. */
export interface Confirmation extends ConfirmationKey {
  tenant_label?: string;
  maker: PrincipalRef;
  client_ref?: string;
  client_label?: string;
  tool: string;
  payload_digest: string;
  /** The product's preview of the complete action. */
  preview?: unknown;
  channel: string;
  status: ConfirmationStatus;
  approval_required: boolean;
  expired: boolean;
  expires_at: string;
  created_at: string;
  decided_at?: string;
  decider?: PrincipalRef;
  decision_note?: string;
  error?: string;
  completed_at?: string;
  reconciler?: PrincipalRef;
  reconcile_note?: string;
  can_decide: boolean;
  can_withdraw: boolean;
  can_reconcile: boolean;
}
