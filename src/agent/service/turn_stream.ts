import { computed, signal } from '@angular/core';
import { TURN_ERROR_CANCELED, TurnReplyFrame, TurnStreamStatus } from '../model/reply_frame';
import { TurnEvent } from '../model/turn_event';

const terminalStatuses: ReadonlySet<TurnStreamStatus> = new Set(['completed', 'canceled', 'failed']);

/**
 * Client-side state of one turn's reply stream. `ConversationService` or an app-specific
 * transport feeds frames to `accept`, reconnects from `cursor()`, and reports an expired replay
 * window. One instance per turn; not injectable.
 */
export class TurnStream {
  private readonly frames = signal<TurnReplyFrame[]>([]);
  private readonly state = signal<TurnStreamStatus>('idle');
  private readonly lastSequence = signal(-1);
  private suspendedAt: number | null = null;

  readonly status = this.state.asReadonly();
  /** Next zero-based sequence wanted by Scout's inclusive replay cursor. */
  readonly cursor = computed(() => this.lastSequence() + 1);
  readonly events = computed<TurnEvent[]>(() => this.frames().flatMap((frame) => frame.events));
  readonly finalFrame = computed(() => this.frames().find((frame) => frame.final && !isSuspension(frame)));
  readonly isTerminal = computed(() => terminalStatuses.has(this.state()));

  constructor(readonly requestId: string) {}

  /**
   * Returns false for a frame of another turn, one already rendered, or one after the final.
   * A suspension frame does not advance the cursor: the resumed turn reuses its sequence.
   */
  accept(frame: TurnReplyFrame): boolean {
    if (frame.request_id !== this.requestId || this.isTerminal()) return false;
    if (frame.sequence <= this.lastSequence()) return false;
    const suspension = isSuspension(frame);
    if (suspension && this.suspendedAt === frame.sequence) return false;
    this.suspendedAt = suspension ? frame.sequence : null;
    if (!suspension) this.lastSequence.set(frame.sequence);
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
    if (frame.final && !isSuspension(frame)) {
      if (frame.error_code === TURN_ERROR_CANCELED) return 'canceled';
      return frame.error_code ? 'failed' : 'completed';
    }
    if (this.state() === 'cancelling') return 'cancelling';
    return isSuspension(frame) ? 'awaiting_approval' : 'streaming';
  }
}

/** approval_pending ends the delivery, not the turn, even on a frame marked final with an error code. */
function isSuspension(frame: TurnReplyFrame): boolean {
  return frame.events[frame.events.length - 1]?.kind === 'approval_pending';
}
