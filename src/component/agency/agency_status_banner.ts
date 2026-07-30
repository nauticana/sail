import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AgencyProfile } from '../../model/agency';

@Component({
  selector: 'sail-agency-status-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agency_status_banner.html',
  host: { class: 'agency-status-banner' },
})
export class AgencyStatusBannerComponent {
  readonly profile = input<AgencyProfile | null>(null);
  readonly pendingMessage = input('Agency approval is pending. Client management is read-only until approval.');
  readonly suspendedMessage = input('Agency access is suspended. New invitations and earnings are paused.');

  readonly pending = computed(() => {
    const profile = this.profile();
    return profile !== null && !profile.approvedAt && !profile.suspended;
  });
  readonly suspended = computed(() => this.profile()?.suspended === true);
  readonly canManage = computed(() => {
    const profile = this.profile();
    return profile !== null && Boolean(profile.approvedAt) && !profile.suspended;
  });
}
