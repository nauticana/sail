import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseAsync } from '../abstract/base_async';
import { NotificationInboxService, INBOX_DEFAULT_PAGE_SIZE } from '../../service/notification_inbox.service';
import { InboxMessage } from '../../model/notification';

/** In-app inbox over keel's `InboxHandler`; message routing stays with the app. */
@Component({
  selector: 'sail-notification-center',
  templateUrl: './notification_center.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
})
export class NotificationCenterComponent extends BaseAsync implements OnInit {
  readonly pageSize = input(INBOX_DEFAULT_PAGE_SIZE);
  readonly heading = input('');
  readonly emptyMessage = input('You have no notifications.');
  readonly markAllLabel = input('Mark all as read');
  readonly markReadLabel = input('Mark as read');
  readonly loadMoreLabel = input('Load older');
  readonly dateFormat = input('short');
  readonly selectable = input(true);
  readonly markReadOnSelect = input(true);

  readonly selected = output<InboxMessage>();

  private readonly inbox = inject(NotificationInboxService);

  readonly messages = this.inbox.messages;
  readonly unreadCount = this.inbox.unreadCount;
  readonly hasMore = this.inbox.hasMore;
  readonly empty = computed(() => !this.loading() && !this.errorMessage() && this.messages().length === 0);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.run(this.inbox.load(this.pageSize()), () => undefined, 'Could not load your notifications.');
  }

  loadMore(): void {
    this.run(this.inbox.loadMore(this.pageSize()), () => undefined, 'Could not load older notifications.');
  }

  select(message: InboxMessage): void {
    // Not via run(): the app may navigate away on select, and teardown would cancel the POST.
    if (this.markReadOnSelect() && !message.readAt) {
      this.inbox.markRead(message.id).subscribe({
        error: (err) => this.setError(err, 'Could not mark that notification read.'),
      });
    }
    this.selected.emit(message);
  }

  markRead(message: InboxMessage): void {
    if (message.readAt) return;
    this.run(this.inbox.markRead(message.id), () => undefined, 'Could not mark that notification read.');
  }

  markAllRead(): void {
    if (!this.unreadCount()) return;
    this.run(this.inbox.markAllRead(), () => undefined, 'Could not mark your notifications read.');
  }
}
