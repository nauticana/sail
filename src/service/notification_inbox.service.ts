import { Injectable, Signal, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { RestURL } from './rest_url';
import { InboxMessage, InboxPage } from '../model/notification';

export const INBOX_MAX_PAGE_SIZE = 100;
export const INBOX_DEFAULT_PAGE_SIZE = 20;

/** Stateful client for keel's `InboxHandler` (v1.2.71+). Call `reset()` on logout. */
@Injectable({ providedIn: 'root' })
export class NotificationInboxService extends BaseRestService {
  private readonly cached = signal<InboxMessage[]>([]);
  private readonly unread = signal(0);
  private readonly older = signal(false);

  readonly messages: Signal<InboxMessage[]> = this.cached.asReadonly();
  readonly unreadCount: Signal<number> = this.unread.asReadonly();
  readonly hasMore: Signal<boolean> = this.older.asReadonly();

  load(limit = INBOX_DEFAULT_PAGE_SIZE): Observable<InboxPage> {
    return this.fetch('', limit).pipe(tap((page) => this.cached.set(page.messages)));
  }

  loadMore(limit = INBOX_DEFAULT_PAGE_SIZE): Observable<InboxPage> {
    const loaded = this.cached();
    const oldest = loaded.length ? loaded[loaded.length - 1].id : '';
    return this.fetch(oldest, limit).pipe(
      tap((page) => this.cached.update((rows) => {
        const ids = new Set(rows.map((message) => message.id));
        return rows.concat(page.messages.filter((message) => !ids.has(message.id)));
      })),
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
    this.cached.set([]);
    this.unread.set(0);
    this.older.set(false);
  }

  private fetch(before: string, limit: number): Observable<InboxPage> {
    const requested = Number.isFinite(limit) ? Math.trunc(limit) : INBOX_DEFAULT_PAGE_SIZE;
    const size = Math.min(Math.max(1, requested), INBOX_MAX_PAGE_SIZE);
    let params = new HttpParams().set('limit', size);
    if (before) params = params.set('before', before);
    return this.http.get<InboxPage>(this.url(RestURL.notificationsURL), { params }).pipe(
      tap((page) => {
        this.unread.set(page.unreadCount);
        this.older.set(page.messages.length >= size);
      }),
    );
  }
}

function nowIso(): string {
  return new Date().toISOString();
}
