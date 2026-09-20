import { computed, signal } from '@angular/core';
import { TURN_ERROR_CANCELED, TurnReplyFrame, TurnStreamStatus } from '../model/reply_frame';
import { TurnEvent } from '../model/turn_event';

const terminalStatuses: ReadonlySet<TurnStreamStatus> = new Set(['completed', 'canceled', 'failed']);

/**
 * Client-side state of one turn's reply stream. Transport stays the app's: it feeds frames to
 * `accept`, reconnects from `cursor()`, and reports an expired replay window. One instance per
 * turn; not injectable.
 */
export class TurnStream {
  private readonly frames = signal<TurnReplyFrame[]>([]);
  private readonly state = signal<TurnStreamStatus>('idle');
  private readonly lastSequence = signal(0);

  readonly status = this.state.asReadonly();
  /** Last sequence rendered; a reconnect resumes after it. */
  readonly cursor = this.lastSequence.asReadonly();
  readonly events = computed<TurnEvent[]>(() => this.frames().flatMap((frame) => frame.events));
  readonly finalFrame = computed(() => this.frames().find((frame) => frame.final));
  readonly isTerminal = computed(() => terminalStatuses.has(this.state()));

  constructor(readonly requestId: string) {}

  /** Returns false for a frame of another turn, one already rendered, or one after the final. */
  accept(frame: TurnReplyFrame): boolean {
    if (frame.request_id !== this.requestId || this.isTerminal()) return false;
    if (frame.sequence <= this.lastSequence()) return false;
    this.lastSequence.set(frame.sequence);
    this.append(frame);
    return true;
  }

  /** The reconnect cursor fell behind the retained window; the app now reads the stored result. */
  markReplayExpired(): void {
    if (!this.isTerminal()) this.state.set('replay_expired');
  }

  /**
   * A final frame rebuilt from the turn record: a payload or an error code, no intermediate
   * events. It completes the turn whatever its sequence.
   */
  acceptStoredResult(frame: TurnReplyFrame): boolean {
    if (frame.request_id !== this.requestId || !frame.final || this.isTerminal()) return false;
    this.append(frame);
    return true;
  }

  /** Cancel is a request: the turn stays `cancelling` until its final frame arrives. */
  markCancelRequested(): void {
    if (!this.isTerminal()) this.state.set('cancelling');
  }

  private append(frame: TurnReplyFrame): void {
    this.frames.update((frames) => [...frames, frame]);
    this.state.set(this.statusAfter(frame));
  }

  private statusAfter(frame: TurnReplyFrame): TurnStreamStatus {
    if (frame.final) {
      if (frame.error_code === TURN_ERROR_CANCELED) return 'canceled';
      return frame.error_code ? 'failed' : 'completed';
    }
    if (this.state() === 'cancelling') return 'cancelling';
    // approval_pending ends the delivery, not the turn: resumed frames follow on the same stream.
    const last = frame.events[frame.events.length - 1];
    return last?.kind === 'approval_pending' ? 'awaiting_approval' : 'streaming';
  }
}
