import { TurnEvent } from './turn_event';

export const TURN_ERROR_CANCELED = 'canceled';

/**
 * One reply frame as sail consumes it. The backend's reply type fixes no JSON names, so the
 * app's transport adapter maps its own wire shape onto this one.
 */
export interface TurnReplyFrame {
  request_id: string;
  conversation_id: string;
  sequence: number;
  events: TurnEvent[];
  final: boolean;
  error_code?: string;
  /** Opaque product payload; on a synthesized final frame it is the whole answer. */
  payload?: unknown;
  agent_version?: string;
  emitted_at?: string;
}

export type TurnStreamStatus =
  | 'idle'
  | 'streaming'
  | 'awaiting_approval'
  | 'cancelling'
  | 'completed'
  | 'canceled'
  | 'failed'
  | 'replay_expired';
