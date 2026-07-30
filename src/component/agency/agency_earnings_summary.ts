import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgencyEarnings } from '../../model/agency';
import { formatMinorCurrency } from '../../util/money';

@Component({
  selector: 'sail-agency-earnings-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agency_earnings_summary.html',
  host: { class: 'agency-earnings-summary' },
})
export class AgencyEarningsSummaryComponent {
  readonly earnings = input<AgencyEarnings | null>(null);
  readonly activeClients = input(0);
  readonly format = formatMinorCurrency;
}
