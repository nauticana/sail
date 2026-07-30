import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgencyPayout } from '../../model/agency';
import { formatMinorCurrency } from '../../util/money';
import { StatusChipComponent } from '../billing/status_chip';

@Component({
  selector: 'sail-agency-payout-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, StatusChipComponent],
  templateUrl: './agency_payout_history.html',
  host: { class: 'agency-payout-history' },
})
export class AgencyPayoutHistoryComponent {
  readonly payouts = input<AgencyPayout[]>([]);
  readonly emptyMessage = input('No agency payouts yet.');
  readonly format = formatMinorCurrency;
}
