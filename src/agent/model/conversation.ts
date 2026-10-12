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

/** Where the app mounts Scout's ConversationHandler, e.g. '/api/wingmate/'. */
export const CONVERSATION_BASE_PATH = new InjectionToken<string>('SailConversationBasePath', {
  providedIn: 'root',
  factory: () => '/api/conversation/',
});
