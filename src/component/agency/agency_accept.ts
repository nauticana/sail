import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take } from 'rxjs';
import { AgencyInvite } from '../../model/agency';
import { AgencyService } from '../../service/agency.service';
import { BaseAuthService } from '../../service/auth.service';
import { errorCode, errorDetail, httpStatus } from '../../util/errors';

const NO_PARTNER_CODE = 'agency_no_partner';
const ACCEPT_OBJECT = 'AGENCY_DELEGATION';
const ACCEPT_ACTIVITY = 'SET_ROLE';
const ACCEPT_TABLE = 'agency_client_delegation';

@Component({
  selector: 'sail-agency-accept',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './agency_accept.html',
  host: { class: 'agency-accept' },
})
export class AgencyAcceptComponent implements OnInit {
  readonly token = input('');
  readonly authenticated = input(false);
  readonly tokenStorageKey = input('sail.agencyInvite');
  readonly loginLabel = input('Log in to accept');
  readonly registerLabel = input('Create an account');
  readonly businessSetupLabel = input('Set up your business');

  readonly loginRequested = output<void>();
  readonly registrationRequested = output<void>();
  readonly businessSetupRequested = output<string>();
  readonly accepted = output<AgencyInvite>();

  private readonly agency = inject(AgencyService);
  private readonly auth = inject(BaseAuthService);
  private activeToken = '';

  readonly loading = signal(true);
  readonly accepting = signal(false);
  readonly invite = signal<AgencyInvite | null>(null);
  readonly errorMessage = signal('');
  readonly complete = signal(false);
  readonly needsBusiness = signal(false);
  /** Whether the user holds keel's accept grant; null until the permissions load. */
  readonly canAccept = signal<boolean | null>(null);

  // keel requires AGENCY_DELEGATION/SET_ROLE (PARTNER_ADMIN) to accept, and answers 403 before
  // its 409 agency_no_partner, so a user without a business also lands here without the grant.
  private readonly permissionEffect = effect((onCleanup) => {
    if (!this.authenticated()) return;
    const subscription = this.auth.getAppData().pipe(take(1)).subscribe({
      next: () => this.canAccept.set(this.auth.canExecute(ACCEPT_OBJECT, ACCEPT_ACTIVITY, ACCEPT_TABLE)),
      error: (error: unknown) => {
        this.canAccept.set(false);
        this.errorMessage.set(errorDetail(error, 'Could not load your permissions.'));
      },
    });
    onCleanup(() => subscription.unsubscribe());
  });

  ngOnInit(): void {
    this.activeToken = this.token() || localStorage.getItem(this.tokenStorageKey()) || '';
    if (!this.activeToken) {
      this.loading.set(false);
      this.errorMessage.set('The invitation token is missing.');
      return;
    }
    this.agency.inviteInfo(this.activeToken).subscribe({
      next: (invite) => {
        this.invite.set(invite);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(errorDetail(error, 'The invitation was not found.'));
      },
    });
  }

  accept(): void {
    const invite = this.invite();
    if (!invite || invite.expired || this.accepting() || !this.canAccept()) return;
    this.accepting.set(true);
    this.needsBusiness.set(false);
    this.errorMessage.set('');
    this.agency.accept(this.activeToken).subscribe({
      next: () => {
        localStorage.removeItem(this.tokenStorageKey());
        this.accepting.set(false);
        this.complete.set(true);
        this.accepted.emit(invite);
      },
      error: (error: unknown) => {
        this.accepting.set(false);
        if (httpStatus(error) === 409 && errorCode(error) === NO_PARTNER_CODE) {
          localStorage.setItem(this.tokenStorageKey(), this.activeToken);
          this.needsBusiness.set(true);
          return;
        }
        if (httpStatus(error) === 403) {
          this.canAccept.set(false);
          return;
        }
        this.errorMessage.set(errorDetail(error, 'Could not accept the invitation.'));
      },
    });
  }

  requestBusinessSetup(): void {
    localStorage.setItem(this.tokenStorageKey(), this.activeToken);
    this.businessSetupRequested.emit(this.activeToken);
  }
}
