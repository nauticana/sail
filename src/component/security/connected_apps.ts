import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { OAuthGrant } from '../../model/access';
import { AccessService } from '../../service/access.service';
import { BaseAsync } from '../abstract/base_async';
import { PromptService } from '../../service/prompt.service';

/**
 * OAuth clients holding a live grant from the signed-in user, with disconnect; a disconnected
 * client must authorize again. Selector: <sail-connected-apps>.
 */
@Component({
  selector: 'sail-connected-apps',
  templateUrl: './connected_apps.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, MatButtonModule],
})
export class ConnectedAppsComponent extends BaseAsync implements OnInit {
  private readonly access = inject(AccessService);
  private readonly prompt = inject(PromptService);

  readonly grants = signal<OAuthGrant[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(this.access.grants(), (rows) => this.grants.set(rows), 'Failed to load connected apps.');
  }

  revoke(grant: OAuthGrant): void {
    const name = grant.clientName || grant.clientId;
    this.prompt.ask({ title: `Disconnect "${name}"?`, message: 'It will have to connect again.', action: 'Disconnect app', destructive: true },
      () => this.run(this.access.revokeGrant(grant.clientId), () => {
        this.successMessage.set(`Disconnected ${name}.`);
        this.load();
      }, 'Failed to disconnect the app.'));
  }
}
