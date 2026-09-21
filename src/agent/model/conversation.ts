import { InjectionToken } from '@angular/core';

/** One asynchronous turn, as Scout's conversation bridge takes it. */
export interface ConversationTurnRequest {
  request_id: string;
  conversation_id: string;
  agent_id: string;
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
