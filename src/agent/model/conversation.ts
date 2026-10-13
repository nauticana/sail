import { InjectionToken } from '@angular/core';

/** One asynchronous turn, as Scout's conversation bridge takes it. */
export interface ConversationTurnRequest {
  request_id: string;
  conversation_id: string;
  /** The agent type alias; its default agent serves a new conversation. */
  agent_type: string;
  /** One agent of that type instead of its default. */
  agent_name?: string;
  /** Pins a new conversation to one release; needs `release_reason`. */
  release?: string;
  release_reason?: string;
  /** The product's opaque reference to the work the turn serves. */
  work_ref?: string;
  /** Opaque product payload; the backend forwards it to the agent unread. */
  input: unknown;
}

/** One agent the person may address through an agent type (`agent_name` on a turn request). */
export interface ConversationAgent {
  agent_name: string;
  display_name: string;
  is_default: boolean;
  release: string;
}

export interface ConversationTurnAccepted {
  request_id: string;
}

/** Data of an SSE `error` event: a failure raised after the stream's 200 was committed. */
export interface ConversationStreamError {
  status: number;
  detail: string;
  request_id?: string;
}

/** Error thrown into `ConversationService.stream()`; status 410 is an expired replay window. */
export class ConversationStreamFailure extends Error {
  constructor(readonly status: number, readonly detail: string, readonly requestId?: string) {
    super(detail);
    this.name = 'ConversationStreamFailure';
  }
}

/** A `turn_status` code; C, F and X are terminal, as Scout's catalog marks them. */
export type TurnStatus = 'Q' | 'R' | 'S' | 'U' | 'H' | 'O' | 'C' | 'F' | 'X';

export const TERMINAL_TURN_STATUSES: ReadonlySet<string> = new Set<TurnStatus>(['C', 'F', 'X']);

/** One turn of the signed-in person's history; cost fields are absent while nothing is settled. */
export interface ConversationTurn {
  request_id: string;
  conversation_id: string;
  agent_name: string;
  release_version: string;
  status: TurnStatus;
  work_ref?: string;
  task_kind: string;
  input_summary: string;
  error_text?: string;
  /** The product's result card, handed to the kind's `sailTurnResult` template. */
  result?: unknown;
  created_at: string;
  completed_at?: string;
  cost_minor?: number;
  currency?: string;
  exponent?: number;
}

/** Newest first; `next_before` is absent on the last page. */
export interface ConversationTurnPage {
  turns: ConversationTurn[];
  next_before?: string;
}

/**
 * Where the app mounts Scout's ConversationHandler, e.g. '/api/wingmate/'. `ConversationService` is a
 * root singleton: provide this at bootstrap, or provide both together on a component.
 */
export const CONVERSATION_BASE_PATH = new InjectionToken<string>('SailConversationBasePath', {
  providedIn: 'root',
  factory: () => '/api/conversation/',
});
