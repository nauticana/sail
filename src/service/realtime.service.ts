import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, Subscription, filter, map, timeout } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { RestURL } from './rest_url';

/** Frame published on a channel by keel's realtime.Hub (Broadcast / PublishChannel). */
export interface RealtimeChannelFrame<T = unknown> {
  channel: string;
  data:    T;
}

const CONTROL_OPS = ['subscribed', 'unsubscribed', 'error'] as const;

/** Control frames of the keel realtime wire protocol. */
interface ControlFrame {
  op:       typeof CONTROL_OPS[number];
  channel?: string;
  reason?:  string;
}

/** keel's answer to a ticket request; `expiresIn` is in seconds. */
interface RealtimeTicket {
  ticket:    string;
  expiresIn: number;
}

const TICKET_TIMEOUT_MS = 10_000;
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * RealtimeService — client for keel's realtime.Hub (`GET /public/ws`).
 *
 * Owns the socket lifecycle: a single-use ticket per handshake, reconnect with
 * backoff, and re-subscription of every channel after a reconnect. Channel
 * names and payload schemas are the app's; sail only carries the frames.
 * Relay delivery is fire-and-forget on the server, so keep a REST read path for
 * state a client may have missed while disconnected.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService extends BaseRestService {
  private readonly destroyRef = inject(DestroyRef);
  private socket: WebSocket | null = null;
  private ticketRequest: Subscription | null = null;
  private reconnectDelay = RECONNECT_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly channels = new Set<string>();
  private readonly frames$ = new Subject<unknown>();

  readonly connected = signal(false);
  /** Last subscription rejected by keel's CanSubscribe, as `{channel, reason}`. */
  readonly lastError = signal<{ channel?: string; reason?: string } | null>(null);

  constructor() {
    super();
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  /** Open the socket for the stored session. Reconnects on drop until disconnect() or the session ends. */
  connect(): void {
    if (!this.hasSession()) throw new Error('RealtimeService.connect: no session token stored');
    if (this.socket || this.ticketRequest) return;
    this.clearReconnect();
    this.requestTicket();
  }

  disconnect(): void {
    this.clearReconnect();
    this.reconnectDelay = RECONNECT_MIN_MS;
    this.ticketRequest?.unsubscribe();
    this.ticketRequest = null;
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }

  private hasSession(): boolean {
    return !!localStorage.getItem('jwt');
  }

  /** Through HttpClient, so authInterceptor attaches the JWT and rotates an expired one. */
  private requestTicket(): void {
    const sessionToken = localStorage.getItem('jwt');
    if (!sessionToken) {
      this.disconnect();
      return;
    }
    const request = new Subscription();
    this.ticketRequest = request;
    request.add(this.http.post<RealtimeTicket>(this.url(RestURL.realtimeTicketURL), null).pipe(
      timeout(TICKET_TIMEOUT_MS),
      map((res) => {
        if (typeof res?.ticket !== 'string' || !res.ticket) throw new Error('ticket response carries no ticket');
        return res.ticket;
      }),
    ).subscribe({
      next: (ticket) => {
        this.ticketRequest = null;
        // A ticket belongs to the session that requested it; one that changed meanwhile gets its own.
        if (localStorage.getItem('jwt') === sessionToken) this.open(ticket);
        else this.scheduleReconnect();
      },
      error: (err: unknown) => {
        this.ticketRequest = null;
        console.error('realtime: connection ticket request failed', err);
        this.scheduleReconnect();
      },
    }));
  }

  private open(ticket: string): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${this.socketUrl(RestURL.realtimeURL)}?ticket=${encodeURIComponent(ticket)}`);
    } catch (err) {
      console.error('realtime: WebSocket construction failed', err);
      this.scheduleReconnect();
      return;
    }
    this.socket = ws;
    ws.onopen = () => {
      if (this.socket !== ws) return;
      this.reconnectDelay = RECONNECT_MIN_MS;
      this.connected.set(true);
      for (const channel of this.channels) this.sendFrame({ op: 'subscribe', channel });
    };
    ws.onmessage = (ev: MessageEvent<string>) => { if (this.socket === ws) this.onFrame(ev.data); };
    ws.onclose = () => {
      if (this.socket !== ws) return;   // superseded by disconnect()/connect(); ignore its close
      this.socket = null;
      this.connected.set(false);
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  /** Frames published on `channel`; subscribes on first use and survives reconnects. */
  channel<T = unknown>(channel: string): Observable<T> {
    if (!this.channels.has(channel)) {
      this.channels.add(channel);
      if (this.connected()) this.sendFrame({ op: 'subscribe', channel });
    }
    return this.frames$.pipe(
      filter((f): f is RealtimeChannelFrame<T> => isChannelFrame(f) && f.channel === channel),
      map((f) => f.data),
    );
  }

  unsubscribe(channel: string): void {
    if (this.channels.delete(channel) && this.connected()) this.sendFrame({ op: 'unsubscribe', channel });
  }

  /** Payloads keel delivers to this user directly (SendToUser / PublishUser), e.g. `{op: 'notification', ...}`. */
  userFrames<T = unknown>(): Observable<T> {
    return this.frames$.pipe(filter((f): f is T => !isChannelFrame(f) && !isControlFrame(f)));
  }

  /** Send an application frame; keel passes anything but subscribe/unsubscribe to OnMessage. */
  send(frame: object): void {
    if (!this.connected()) throw new Error('RealtimeService.send: socket not connected');
    this.sendFrame(frame);
  }

  private sendFrame(frame: object): void {
    this.socket?.send(JSON.stringify(frame));
  }

  private onFrame(raw: string): void {
    let frame: unknown;
    try { frame = JSON.parse(raw); } catch { console.error('realtime: non-JSON frame dropped'); return; }
    if (isControlFrame(frame) && frame.op === 'error') {
      this.lastError.set({ channel: frame.channel, reason: frame.reason });
      console.error(`realtime: subscribe ${frame.channel} rejected: ${frame.reason}`);
    }
    this.frames$.next(frame);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.requestTicket();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  /** ws(s):// form of the configured backend host plus `path`; same-origin when no host is set. */
  private socketUrl(path: string): string {
    const base = RestURL.httpHost || window.location.origin;
    return base.replace(/^http/, 'ws') + path;
  }
}

function isChannelFrame(f: unknown): f is RealtimeChannelFrame {
  return !!f && typeof f === 'object' && 'channel' in f && 'data' in f && !('op' in f);
}

function isControlFrame(f: unknown): f is ControlFrame {
  return !!f && typeof f === 'object' && CONTROL_OPS.includes((f as { op?: unknown }).op as ControlFrame['op']);
}
