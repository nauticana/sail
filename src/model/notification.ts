import { Int64 } from '../util/integer';

/** In-app notification returned by keel's `InboxHandler`. */
export interface InboxMessage {
  id: Int64;
  /** App-defined category (keel `notification_type`); '' when the sender set none. */
  type: string;
  title: string;
  body: string;
  /** Sender payload the app routes on (`{}` when the sender supplied none). */
  data: Record<string, string>;
  /** ISO timestamp, or null while unread. */
  readAt: string | null;
  createdAt: string;
}

/** One page of the caller's inbox, newest first, plus the whole-inbox unread total. */
export interface InboxPage {
  messages: InboxMessage[];
  unreadCount: Int64;
}
