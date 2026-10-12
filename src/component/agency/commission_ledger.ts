import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgencyEarningEntry } from '../../model/agency';
import { MoneyPipe } from '../../service/money_pipe';
import { StatusChipComponent } from '../billing/status_chip';

@Component({
  selector: 'sail-commission-ledger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, StatusChipComponent, MoneyPipe],
  templateUrl: './commission_ledger.html',
  host: { class: 'commission-ledger' },
})
export class CommissionLedgerComponent {
  readonly entries = input<AgencyEarningEntry[]>([]);
  readonly emptyMessage = input('No commission activity yet.');
}
