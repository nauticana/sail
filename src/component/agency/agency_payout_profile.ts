import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { AgencyPayoutDestination, AgencyPayoutProfile } from '../../model/agency';
import { AgencyService } from '../../service/agency.service';
import { errorDetail } from '../../util/errors';
import { PayoutProviderOnboardingComponent } from '../payout/provider_onboarding';

/**
 * Self-service selection of the fully onboarded destination that receives
 * agency commission payouts. Routes and page composition remain app-owned.
 */
@Component({
  selector: 'sail-agency-payout-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PayoutProviderOnboardingComponent,
  ],
  templateUrl: './agency_payout_profile.html',
  host: { class: 'agency-payout-profile' },
})
export class AgencyPayoutProfileComponent implements OnInit {
  readonly selected = output<AgencyPayoutProfile>();

  private readonly agency = inject(AgencyService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly onboarding = signal(false);
  readonly pending = signal(false);
  readonly errorMessage = signal('');
  readonly profile = signal<AgencyPayoutProfile | null>(null);
  readonly destinations = signal<AgencyPayoutDestination[]>([]);
  readonly selectedDestinationID = signal<number | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.agency.payoutProfile().subscribe({
      next: ({ profile, destinations }) => {
        const available = destinations ?? [];
        this.profile.set(profile);
        this.destinations.set(available);
        this.selectedDestinationID.set(
          available.some((item) => item.userBankInfoId === profile?.userBankInfoId)
            ? profile!.userBankInfoId
            : available[0]?.userBankInfoId ?? null,
        );
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(errorDetail(error, 'Could not load the payout profile.'));
      },
    });
  }

  choose(event: MatSelectChange): void {
    this.selectedDestinationID.set(Number(event.value));
  }

  save(): void {
    const destinationID = this.selectedDestinationID();
    if (!destinationID || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.agency.setPayoutProfile(destinationID).subscribe({
      next: () => {
        this.saving.set(false);
        this.agency.payoutProfile().subscribe({
          next: ({ profile, destinations }) => {
            this.profile.set(profile);
            this.destinations.set(destinations ?? []);
            if (profile) this.selected.emit(profile);
          },
          error: (error: unknown) => this.errorMessage.set(errorDetail(error, 'The destination was saved, but its status could not be refreshed.')),
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(errorDetail(error, 'Could not select the payout destination.'));
      },
    });
  }

  onboardingComplete(): void {
    this.onboarding.set(false);
    this.pending.set(false);
    this.reload();
  }
}
