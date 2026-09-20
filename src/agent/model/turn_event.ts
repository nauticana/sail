/** Typed turn events (`v` 1). Exactly the member a `kind` names is set. */

export const TURN_EVENT_KINDS = [
  'text_delta',
  'tool_proposal',
  'tool_result',
  'approval_pending',
  'approval_resolved',
  'evidence',
  'effect',
  'progress',
  'result',
  'extension',
] as const;

export type TurnEventKind = (typeof TURN_EVENT_KINDS)[number];
export type EffectStatus = 'satisfied' | 'violated' | 'unknown';

/** A reference to stored content, never the content itself. */
export interface ObjectRef {
  URI: string;
  Digest: string;
}

export interface TurnToolEvent {
  call_id: string;
  tool_id: string;
  tool_version: string;
  arguments?: unknown;
  output?: unknown;
  is_error?: boolean;
}

export interface EffectObservation {
  status: EffectStatus;
  reason?: string;
  observed_at?: string;
  evidence?: ObjectRef[];
  /** The effect already held, so the mutation was not sent again. */
  reconciled?: boolean;
}

export interface TurnEffectEvent {
  call_id: string;
  tool_id: string;
  tool_version: string;
  observation: EffectObservation;
}

export interface TurnApprovalEvent {
  call_id?: string;
  tool_id?: string;
  decision?: string;
}

export interface EvidenceRef {
  id: string;
  source: string;
  object?: ObjectRef;
  call_id?: string;
  uri?: string;
}

export interface TurnProgressEvent {
  stage: string;
  iteration?: number;
  message?: string;
}

export interface TurnExtensionEvent {
  type: string;
  v: number;
  payload?: unknown;
}

export interface TurnEvent {
  v: number;
  kind: TurnEventKind;
  text?: string;
  tool?: TurnToolEvent;
  approval?: TurnApprovalEvent;
  evidence?: EvidenceRef[];
  effect?: TurnEffectEvent;
  progress?: TurnProgressEvent;
  extension?: TurnExtensionEvent;
}

const knownKinds: ReadonlySet<string> = new Set(TURN_EVENT_KINDS);

/** Narrows a received frame member; unknown kinds are dropped by callers, not reported. */
export function isKnownTurnEvent(value: unknown): value is TurnEvent {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && knownKinds.has(kind);
}
