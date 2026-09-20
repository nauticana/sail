import {
  EvidenceRef,
  TurnApprovalEvent,
  TurnEffectEvent,
  TurnEvent,
  TurnExtensionEvent,
  TurnProgressEvent,
  TurnToolEvent,
  isKnownTurnEvent,
} from '../model/turn_event';

export type ToolCallApproval = 'pending' | 'resolved';

export interface ToolCallView {
  kind: 'tool';
  call_id: string;
  tool_id: string;
  tool_version: string;
  arguments?: unknown;
  result?: TurnToolEvent;
  /** Set only for an `is_error` result; its output is never shown. */
  errorClass?: string;
  effect?: TurnEffectEvent;
  approval?: ToolCallApproval;
  decision?: string;
}

export type TurnTimelineItem =
  | { kind: 'text'; text: string }
  | ToolCallView
  | { kind: 'evidence'; refs: EvidenceRef[] }
  | { kind: 'progress'; progress: TurnProgressEvent }
  | { kind: 'extension'; extension: TurnExtensionEvent }
  | { kind: 'result' };

function errorClassOf(tool: TurnToolEvent): string | undefined {
  if (!tool.is_error) return undefined;
  const output = tool.output;
  if (!output || typeof output !== 'object') return '';
  const errorClass = (output as { error?: unknown }).error;
  return typeof errorClass === 'string' ? errorClass : '';
}

/**
 * Folds a turn's events, in frame order, into renderable items: text deltas concatenate, and a
 * call's proposal, result, effect, and approval meet on one item by `call_id`. Unknown kinds
 * are skipped.
 */
export function buildTurnTimeline(events: readonly unknown[]): TurnTimelineItem[] {
  const items: TurnTimelineItem[] = [];
  const calls = new Map<string, ToolCallView>();

  const callFor = (source: { call_id?: string; tool_id?: string; tool_version?: string }): ToolCallView => {
    const callId = source.call_id ?? '';
    let call = calls.get(callId);
    if (!call) {
      call = { kind: 'tool', call_id: callId, tool_id: source.tool_id ?? '', tool_version: source.tool_version ?? '' };
      calls.set(callId, call);
      items.push(call);
    }
    return call;
  };

  const applyApproval = (approval: TurnApprovalEvent | undefined, state: ToolCallApproval): void => {
    if (!approval) return;
    const call = callFor(approval);
    call.approval = state;
    call.decision = approval.decision;
  };

  for (const candidate of events) {
    if (!isKnownTurnEvent(candidate)) continue;
    const event: TurnEvent = candidate;
    switch (event.kind) {
      case 'text_delta': {
        const last = items[items.length - 1];
        if (last?.kind === 'text') last.text += event.text ?? '';
        else items.push({ kind: 'text', text: event.text ?? '' });
        break;
      }
      case 'tool_proposal':
        if (event.tool) callFor(event.tool).arguments = event.tool.arguments;
        break;
      case 'tool_result':
        if (event.tool) {
          const call = callFor(event.tool);
          call.result = event.tool;
          call.errorClass = errorClassOf(event.tool);
        }
        break;
      case 'effect':
        if (event.effect) callFor(event.effect).effect = event.effect;
        break;
      case 'approval_pending':
        applyApproval(event.approval, 'pending');
        break;
      case 'approval_resolved':
        applyApproval(event.approval, 'resolved');
        break;
      case 'evidence':
        if (event.evidence?.length) items.push({ kind: 'evidence', refs: event.evidence });
        break;
      case 'progress':
        if (event.progress) items.push({ kind: 'progress', progress: event.progress });
        break;
      case 'extension':
        if (event.extension) items.push({ kind: 'extension', extension: event.extension });
        break;
      case 'result':
        items.push({ kind: 'result' });
        break;
    }
  }
  return items;
}
