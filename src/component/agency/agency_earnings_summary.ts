import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgencyEarnings } from '../../model/agency';
import { MoneyPipe } from '../../service/money_pipe';

@Component({
  selector: 'sail-agency-earnings-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe],
  templateUrl: './agency_earnings_summary.html',
  host: { class: 'agency-earnings-summary' },
})
export class AgencyEarningsSummaryComponent {
  readonly earnings = input<AgencyEarnings | null>(null);
  readonly activeClients = input(0);
}
