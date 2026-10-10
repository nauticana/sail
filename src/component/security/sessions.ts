import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { BaseAsync } from '../abstract/base_async';
import { BaseAuthService } from '../../service/auth.service';
import { ActiveSession } from '../../model/appdata';

@Component({
  selector: 'sail-sessions',
  templateUrl: './sessions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, MatButtonModule],
})
export class SessionsComponent extends BaseAsync implements OnInit {
  private readonly auth = inject(BaseAuthService);

  readonly sessions = signal<ActiveSession[]>([]);
  private readonly methods = new Map(
    (this.auth.getDomainValues('sign_in_method') ?? []).map((v) => [v.Value, v.Caption]));

  ngOnInit() {
    this.loadSessions();
  }

  loadSessions() {
    this.run(this.auth.getSessions(), (sessions) => this.sessions.set(sessions), 'Failed to load sessions.');
  }

  methodCaption(code: string): string {
    return this.methods.get(code) ?? code;
  }

  revoke(session: ActiveSession) {
    if (!confirm(`Sign out the session on ${session.userAgent || 'an unknown device'}?`)) return;
    this.run(
      this.auth.revokeSession(session.id),
      () => {
        this.loadSessions();
        this.successMessage.set('Session signed out.');
      },
      'Failed to sign out the session.',
    );
  }
}
