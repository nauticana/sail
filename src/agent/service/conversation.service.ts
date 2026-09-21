import { Injectable, inject } from '@angular/core';
import { Observable, Subscriber, firstValueFrom } from 'rxjs';
import { BaseAuthService } from '../../service/auth.service';
import { BaseRestService } from '../../service/base_rest.service';
import {
  CONVERSATION_BASE_PATH,
  ConversationStreamError,
  ConversationStreamFailure,
  ConversationTurnAccepted,
  ConversationTurnRequest,
} from '../model/conversation';
import { TurnReplyFrame } from '../model/reply_frame';
import { isKnownTurnEvent } from '../model/turn_event';
import { SseParser, ServerSentEvent } from '../util/sse';
import { TurnStream } from './turn_stream';

const REPLAY_EXPIRED = 410;

/**
 * Transport for Scout's conversation bridge: `POST {base}turn`,
 * `GET {base}turn/stream` as SSE, `POST {base}turn/cancel`. Submit and cancel go through
 * `HttpClient` (and so through sail's interceptors); the stream cannot, because
 * `EventSource` sends no `Authorization` header — it is a `fetch` body reader that carries
 * the bearer itself and rotates it through `BaseAuthService.refreshSession()` once on a 401.
 *
 * The interceptor's auth-loop circuit breaker does not cover the stream.
 */
@Injectable({ providedIn: 'root' })
export class ConversationService extends BaseRestService {
  private readonly auth = inject(BaseAuthService, { optional: true });
  private readonly basePath = normalizeBasePath(inject(CONVERSATION_BASE_PATH));

  submit(request: ConversationTurnRequest): Observable<ConversationTurnAccepted> {
    return this.http.post<ConversationTurnAccepted>(this.conversationUrl('turn'), request);
  }

  /** Cancel is a request: the turn stays open until its final frame arrives. */
  cancel(requestId: string, reason?: string): Observable<ConversationTurnAccepted> {
    return this.http.post<ConversationTurnAccepted>(this.conversationUrl('turn/cancel'), {
      request_id: requestId,
      reason,
    });
  }

  /**
   * Read the reply stream from `stream.cursor()` into `stream`, emitting every accepted frame
   * and completing when the server closes the delivery. Unsubscribing aborts the request; a
   * reconnect — after a drop or a resolved approval — calls this again unchanged.
   */
  stream(requestId: string, stream: TurnStream): Observable<TurnReplyFrame> {
    return new Observable<TurnReplyFrame>((subscriber) => {
      const controller = new AbortController();
      this.read(requestId, stream, controller.signal, subscriber).then(
        () => subscriber.complete(),
        (err: unknown) => { if (!controller.signal.aborted) subscriber.error(err); },
      );
      return () => controller.abort();
    });
  }

  private async read(
    requestId: string,
    stream: TurnStream,
    signal: AbortSignal,
    subscriber: Subscriber<TurnReplyFrame>,
  ): Promise<void> {
    let response = await this.open(requestId, stream.cursor(), signal, localStorage.getItem('jwt'));
    if (response.status === 401 && this.auth) {
      const token = await firstValueFrom(this.auth.refreshSession());
      response = await this.open(requestId, stream.cursor(), signal, token);
    }
    if (response.status === REPLAY_EXPIRED) {
      // The window is gone and the turn has not finished, so no stored result exists yet;
      // streaming again once it is terminal delivers that result instead.
      stream.markReplayExpired();
      throw new ConversationStreamFailure(REPLAY_EXPIRED, await failureDetail(response), requestId);
    }
    if (!response.ok || !response.body) {
      throw new ConversationStreamFailure(response.status, await failureDetail(response), requestId);
    }
    // A 200 that is not the event stream (a proxy's error page, a login redirect) would
    // otherwise parse to nothing and complete the turn silently.
    if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
      throw new ConversationStreamFailure(response.status, 'conversation stream did not return text/event-stream', requestId);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        for (const event of parser.push(decoder.decode())) {
          this.dispatch(event, requestId, stream, subscriber);
        }
        for (const event of parser.finish()) {
          this.dispatch(event, requestId, stream, subscriber);
        }
        return;
      }
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        this.dispatch(event, requestId, stream, subscriber);
      }
    }
  }

  private dispatch(
    event: ServerSentEvent,
    requestId: string,
    stream: TurnStream,
    subscriber: Subscriber<TurnReplyFrame>,
  ): void {
    if (event.event === 'error') {
      const failure = parseJson<ConversationStreamError>(event.data);
      const status = failure?.status ?? 0;
      if (status === REPLAY_EXPIRED) stream.markReplayExpired();
      throw new ConversationStreamFailure(
        status,
        failure?.detail ?? 'conversation stream failed',
        failure?.request_id ?? requestId,
      );
    }
    if (event.event !== 'turn') return;
    const frame = toFrame(parseJson(event.data));
    // A stored result answering an expired cursor arrives on this channel too, carrying the
    // sequence it was asked with, so accept() takes it like any other frame.
    if (frame && stream.accept(frame)) subscriber.next(frame);
  }

  private open(requestId: string, cursor: number, signal: AbortSignal, token: string | null): Promise<Response> {
    const query = new URLSearchParams({ request_id: requestId, cursor: String(cursor) });
    return fetch(`${this.conversationUrl('turn/stream')}?${query}`, {
      signal,
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  private conversationUrl(path: string): string {
    return this.url(this.basePath + path);
  }
}

function normalizeBasePath(base: string): string {
  return '/' + base.trim().replace(/^\/+|\/+$/g, '') + '/';
}

function parseJson<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Unknown event kinds are dropped here so `TurnStream.events()` stays typed as it reads. */
function toFrame(value: unknown): TurnReplyFrame | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const frame = value as Partial<TurnReplyFrame>;
  if (typeof frame.request_id !== 'string' || typeof frame.sequence !== 'number' || !Array.isArray(frame.events)) {
    return undefined;
  }
  return {
    ...frame,
    request_id: frame.request_id,
    conversation_id: typeof frame.conversation_id === 'string' ? frame.conversation_id : '',
    sequence: frame.sequence,
    events: frame.events.filter(isKnownTurnEvent),
    final: frame.final === true,
  };
}

async function failureDetail(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  const problem = parseJson<{ detail?: string; title?: string; error?: string }>(body);
  const detail = problem?.detail ?? problem?.title ?? problem?.error ?? body;
  return detail || `HTTP ${response.status}`;
}
