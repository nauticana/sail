import { Injectable, Signal, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { EMPTY, Observable, Subscription, catchError, filter, switchMap, tap } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { RealtimeService } from './realtime.service';
import { RestURL } from './rest_url';
import { InboxMessage, InboxPage } from '../model/notification';

export const INBOX_MAX_PAGE_SIZE = 100;
export const INBOX_DEFAULT_PAGE_SIZE = 20;

/**
 * Stateful client for keel's `InboxHandler` (v1.2.71+). After `load()` it re-fetches
 * the newest page on each realtime `notification` frame (keel `realtime.UserDispatcher`).
 * Call `reset()` on logout.
 */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService extends BaseRestService {
  private readonly realtime = inject(RealtimeService);
  private live: Subscription | null = null;
  private pageSize = INBOX_DEFAULT_PAGE_SIZE;
  private readonly cached = signal<InboxMessage[]>([]);
  private readonly unread = signal(0);
  private readonly older = signal(false);

  readonly messages: Signal<InboxMessage[]> = this.cached.asReadonly();
  readonly unreadCount: Signal<number> = this.unread.asReadonly();
  readonly hasMore: Signal<boolean> = this.older.asReadonly();

  load(limit = INBOX_DEFAULT_PAGE_SIZE): Observable<InboxPage> {
    this.pageSize = pageSizeOf(limit);
    return this.fetch('', limit).pipe(tap((page) => {
      this.cached.set(page.messages);
      this.older.set(this.isFull(page, limit));
      this.follow();
    }));
  }

  loadMore(limit = INBOX_DEFAULT_PAGE_SIZE): Observable<InboxPage> {
    const loaded = this.cached();
    const oldest = loaded.length ? loaded[loaded.length - 1].id : '';
    return this.fetch(oldest, limit).pipe(
      tap((page) => {
        this.older.set(this.isFull(page, limit));
        this.cached.update((rows) => {
          const ids = new Set(rows.map((message) => message.id));
          return rows.concat(page.messages.filter((message) => !ids.has(message.id)));
        });
      }),
    );
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(this.url(RestURL.notificationsMarkReadURL), { id }).pipe(
      tap(() => {
        const wasUnread = this.cached().some((m) => m.id === id && !m.readAt);
        this.cached.update((rows) => rows.map((m) => (m.id === id ? { ...m, readAt: m.readAt ?? nowIso() } : m)));
        if (wasUnread) this.unread.update((n) => Math.max(0, n - 1));
      }),
    );
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(this.url(RestURL.notificationsMarkAllReadURL), {}).pipe(
      tap(() => {
        this.cached.update((rows) => rows.map((m) => (m.readAt ? m : { ...m, readAt: nowIso() })));
        this.unread.set(0);
      }),
    );
  }

  reset(): void {
    this.live?.unsubscribe();
    this.live = null;
    this.cached.set([]);
    this.unread.set(0);
    this.older.set(false);
  }

  /** The frame carries no message id, so the newest page is re-fetched and merged over the cache head. */
  private follow(): void {
    if (this.live) return;
    this.live = this.realtime.userFrames<{ op?: unknown }>().pipe(
      filter((frame) => frame?.op === 'notification'),
      switchMap(() => this.fetch('', this.pageSize).pipe(
        catchError((err) => {
          console.error('notification inbox: refresh after realtime frame failed', err);
          return EMPTY;
        }),
      )),
    ).subscribe((page) => {
      const fresh = new Set(page.messages.map((message) => message.id));
      this.cached.update((rows) => page.messages.concat(rows.filter((message) => !fresh.has(message.id))));
    });
  }

  private fetch(before: string, limit: number): Observable<InboxPage> {
    let params = new HttpParams().set('limit', pageSizeOf(limit));
    if (before) params = params.set('before', before);
    return this.http.get<InboxPage>(this.url(RestURL.notificationsURL), { params }).pipe(
      tap((page) => this.unread.set(page.unreadCount)),
    );
  }

  private isFull(page: InboxPage, limit: number): boolean {
    return page.messages.length >= pageSizeOf(limit);
  }
}

function pageSizeOf(limit: number): number {
  const requested = Number.isFinite(limit) ? Math.trunc(limit) : INBOX_DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, requested), INBOX_MAX_PAGE_SIZE);
}

function nowIso(): string {
  return new Date().toISOString();
}
