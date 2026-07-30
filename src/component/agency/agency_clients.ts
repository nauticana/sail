import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AgencyClient, AgencyClientColumn, AgencyProfile } from '../../model/agency';
import { AgencyService } from '../../service/agency.service';
import { errorDetail } from '../../util/errors';
import { StatusChipComponent } from '../billing/status_chip';
import { AgencyStatusBannerComponent } from './agency_status_banner';

@Component({
  selector: 'sail-agency-clients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
    AgencyStatusBannerComponent,
  ],
  templateUrl: './agency_clients.html',
  host: { class: 'agency-clients' },
})
export class AgencyClientsComponent implements OnInit {
  readonly extraColumns = input<AgencyClientColumn[]>([]);
  readonly enrollmentTitle = input('Agency enrollment');
  readonly enrollmentDescription = input('Apply to manage clients and receive referral commission.');
  readonly enrollmentActionLabel = input('Apply');
  readonly showBillingModelControls = input(false);

  readonly enrolled = output<AgencyProfile>();
  readonly clientAdded = output<AgencyClient>();
  readonly invited = output<{ client: AgencyClient; inviteLink: string }>();
  readonly cancelled = output<AgencyClient>();
  readonly billingModelChanged = output<{ client: AgencyClient; billingModel: 'R' | 'W' }>();

  private readonly agency = inject(AgencyService);
  private readonly snack = inject(MatSnackBar);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly needsEnrollment = signal(false);
  readonly profile = signal<AgencyProfile | null>(null);
  readonly clients = signal<AgencyClient[]>([]);
  readonly activeClients = signal(0);
  readonly inviteLinks = signal<Record<number, string>>({});
  readonly canManage = computed(() => {
    const profile = this.profile();
    return profile !== null && Boolean(profile.approvedAt) && !profile.suspended;
  });

  readonly addForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    email: ['', Validators.email],
    website: [''],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(afterProfileLoad?: (profile: AgencyProfile) => void): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.agency.profile().subscribe({
      next: ({ profile }) => {
        this.profile.set(profile);
        this.needsEnrollment.set(profile === null);
        if (profile === null) {
          this.clients.set([]);
          this.activeClients.set(0);
          this.loading.set(false);
          return;
        }
        afterProfileLoad?.(profile);
        this.loadClients();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(errorDetail(error, 'Could not load the agency profile.'));
      },
    });
  }

  enroll(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.agency.enroll().subscribe({
      next: () => this.reload((profile) => this.enrolled.emit(profile)),
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(errorDetail(error, 'Agency enrollment failed.'));
      },
    });
  }

  addClient(): void {
    if (this.addForm.invalid || !this.canManage()) return;
    const value = this.addForm.getRawValue();
    this.agency.addClients([value]).subscribe({
      next: () => {
        this.addForm.reset();
        this.loadClients((client) => this.clientAdded.emit(client));
      },
      error: (error: unknown) => this.snack.open(errorDetail(error, 'Could not add the client.'), 'Dismiss'),
    });
  }

  invite(client: AgencyClient): void {
    if (!this.canManage()) return;
    this.agency.invite(client.id).subscribe({
      next: ({ inviteLink }) => {
        this.inviteLinks.update((links) => ({ ...links, [client.id]: inviteLink }));
        this.invited.emit({ client, inviteLink });
        this.copy(inviteLink);
        this.loadClients();
      },
      error: (error: unknown) => this.snack.open(errorDetail(error, 'Could not create the invitation.'), 'Dismiss'),
    });
  }

  cancel(client: AgencyClient): void {
    if (!this.canManage()) return;
    this.agency.cancel(client.id).subscribe({
      next: () => {
        this.cancelled.emit(client);
        this.loadClients();
      },
      error: (error: unknown) => this.snack.open(errorDetail(error, 'Could not cancel the client.'), 'Dismiss'),
    });
  }

  setBillingModel(client: AgencyClient, billingModel: 'R' | 'W'): void {
    if (!this.canManage() || !client.clientPartnerId) return;
    this.agency.setBillingModel(client.clientPartnerId, billingModel).subscribe({
      next: () => {
        this.billingModelChanged.emit({ client, billingModel });
        this.loadClients();
      },
      error: (error: unknown) => this.snack.open(errorDetail(error, 'Could not change the billing model.'), 'Dismiss'),
    });
  }

  copy(link: string): void {
    if (!navigator.clipboard) {
      this.snack.open(link, 'Dismiss');
      return;
    }
    navigator.clipboard.writeText(link).then(
      () => this.snack.open('Invitation link copied.', undefined, { duration: 2500 }),
      () => this.snack.open(link, 'Dismiss'),
    );
  }

  private loadClients(afterLoad?: (client: AgencyClient) => void): void {
    this.agency.clients().subscribe({
      next: ({ items, activeClients }) => {
        const previousIDs = new Set(this.clients().map((client) => client.id));
        const clients = items ?? [];
        this.clients.set(clients);
        this.activeClients.set(activeClients ?? 0);
        this.loading.set(false);
        if (afterLoad) {
          const added = clients.find((client) => !previousIDs.has(client.id));
          if (added) afterLoad(added);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(errorDetail(error, 'Could not load agency clients.'));
      },
    });
  }
}
