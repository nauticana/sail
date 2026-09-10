import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import { RestURL } from './rest_url';

/** Frame published on a channel by keel's realtime.Hub (Broadcast / PublishChannel). */
export interface RealtimeChannelFrame<T = unknown> {
  channel: string;
  data:    T;
}

/** Control frames of the keel realtime wire protocol. */
interface ControlFrame {
  op:       'subscribed' | 'unsubscribed' | 'error';
  channel?: string;
  reason?:  string;
}

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * RealtimeService — client for keel's realtime.Hub (`GET /public/ws`).
 *
 * Owns the socket lifecycle: JWT handshake via `?token=`, reconnect with
 * backoff, and re-subscription of every channel after a reconnect. Channel
 * names and payload schemas are the app's; sail only carries the frames.
 * Relay delivery is fire-and-forget on the server, so keep a REST read path for
 * state a client may have missed while disconnected.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly destroyRef = inject(DestroyRef);
  private socket: WebSocket | null = null;
  private wanted = false;
  private reconnectDelay = RECONNECT_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly channels = new Set<string>();
  private readonly frames$ = new Subject<unknown>();

  readonly connected = signal(false);
  /** Last subscription rejected by keel's CanSubscribe, as `{channel, reason}`. */
  readonly lastError = signal<{ channel?: string; reason?: string } | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  /** Open the socket with the stored JWT. Reconnects on drop until disconnect(). */
  connect(): void {
    this.wanted = true;
    if (this.socket) return;
    const token = localStorage.getItem('jwt');
    if (!token) throw new Error('RealtimeService.connect: no session token stored');
    const ws = new WebSocket(`${socketUrl(RestURL.realtimeURL)}?token=${encodeURIComponent(token)}`);
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
      if (this.wanted) this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  disconnect(): void {
    this.wanted = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
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

  /** Payloads keel delivers to this user directly (SendToUser / PublishUser). */
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

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted) this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }
}

function isChannelFrame(f: unknown): f is RealtimeChannelFrame {
  return !!f && typeof f === 'object' && 'channel' in f && 'data' in f && !('op' in f);
}

function isControlFrame(f: unknown): f is ControlFrame {
  return !!f && typeof f === 'object' && 'op' in f;
}

/** ws(s):// form of the configured backend host plus `path`; same-origin when no host is set. */
function socketUrl(path: string): string {
  const base = RestURL.httpHost || window.location.origin;
  return base.replace(/^http/, 'ws') + path;
}
