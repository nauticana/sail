import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { BaseAuthService } from "../../service/auth.service";
import { BackendService } from "../../service/rest_service";
import { ConstantValue } from "../../model/common";
import { ReportParam } from "../../model/appdata";
import { titleCase } from "../../util/text";
import { errorDetail } from "../../util/errors";
import { MoneyColumnService } from "../../service/money_column.service";
import { isInt64 } from "../../util/integer";
import { ReportChart } from "./report_chart";

/** Periods offered when a report has a date range. */
export type DatePreset = 'Today' | 'Last 7 days' | 'Last 30 days' | 'This month' | 'Last month' | 'This year';

@Component({
    selector: 'sail-table-report',
    templateUrl: './table_report.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        ReportChart,
    ],
})
export class TableReport {
    readonly apiName = input('');
    readonly tableName = input('');

    private readonly auth = inject(BaseAuthService);
    private readonly backend = inject(BackendService);
    private readonly money = inject(MoneyColumnService);

    readonly records = signal<Record<string, unknown>[]>([]);
    readonly displayedColumns = signal<string[]>([]);
    readonly errorMessage = signal('');
    /** Entered values by parameter name; empty ones are not sent. */
    readonly paramValues = signal<Record<string, string>>({});
    readonly datePresets: readonly DatePreset[] = ['Today', 'Last 7 days', 'Last 30 days', 'This month', 'Last month', 'This year'];

    /** The last segment of apiName: the metadata key and the REPORT grant's scope. */
    readonly reportId = computed(() => this.apiName().split('/').pop() ?? '');
    readonly reportTitle = computed(() => this.auth.getReport(this.reportId())?.Description || titleCase(this.tableName()));
    /** With parameters the report waits for Run; without, it loads at once. */
    readonly params = computed<ReportParam[]>(() => this.auth.getReport(this.reportId())?.Params ?? []);
    /** The first two date or timestamp parameters, in order, are a range's start and end. */
    readonly dateRange = computed(() => {
        const dates = this.params().filter((p) => !p.ConstantID && ['date', 'datetime-local'].includes(this.inputTypeFor(p)));
        return dates.length >= 2 ? [dates[0], dates[1]] as const : null;
    });

    /** The report when keel gives it a chart (v1.3.14), else null. */
    readonly chart = computed(() => {
        const report = this.auth.getReport(this.reportId());
        return report?.ChartKind && report.ChartKind !== 'N' && report.CategoryColumn && report.Series?.length ? report : null;
    });
    protected readonly cellText = (column: string, record: Record<string, unknown>) => this.cell(column, record);

    private lastApi: string | null = null;

    constructor() {
        // Runs on apiName and appdata changes; parameters reset only when the report changes.
        effect(() => {
            const api = this.apiName();
            if (!api) return;
            const apiChanged = api !== this.lastApi;
            this.lastApi = api;
            if (apiChanged) {
                this.records.set([]);
                this.displayedColumns.set([]);
                this.paramValues.set({});
            }
            this.errorMessage.set('');
            if (!this.auth.canReport(this.reportId())) {
                this.errorMessage.set('You do not have permission to view this report.');
                return;
            }
            if (this.params().length === 0 && (apiChanged || untracked(this.records).length === 0)) {
                this.fetchReport(api, {});
            }
        });
    }

    /** The parameter's constant_value options; undefined renders a typed input. */
    optionsFor(param: ReportParam): ConstantValue[] | undefined {
        return param.ConstantID ? this.auth.getDomainValues(param.ConstantID) : undefined;
    }

    inputTypeFor(param: ReportParam): 'number' | 'date' | 'datetime-local' | 'text' {
        switch ((param.DataType || '').toLowerCase()) {
            case 'int':
            case 'integer':
            case 'number':
            case 'numeric':
                return 'number';
            case 'date':
                return 'date';
            case 'datetime':
            case 'timestamp':
                return 'datetime-local';
            default:
                return 'text';
        }
    }

    setParam(name: string, value: string) {
        this.paramValues.update((current) => ({ ...current, [name]: value }));
    }

    onParamInput(name: string, event: Event) {
        this.setParam(name, (event.target as HTMLInputElement).value);
    }

    paramValue(name: string): string {
        return this.paramValues()[name] ?? '';
    }

    /** Fills the date range with the preset's first and last day, as of today. */
    applyPreset(preset: DatePreset, today = new Date()) {
        const range = this.dateRange();
        if (!range) return;
        const [start, end] = range;
        const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
        const [from, to] = {
            'Today': [today, today],
            'Last 7 days': [new Date(y, m, d - 6), today],
            'Last 30 days': [new Date(y, m, d - 29), today],
            'This month': [new Date(y, m, 1), today],
            'Last month': [new Date(y, m - 1, 1), new Date(y, m, 0)],
            'This year': [new Date(y, 0, 1), today],
        }[preset];
        this.setParam(start.Name, this.dateValue(start, from, '00:00'));
        this.setParam(end.Name, this.dateValue(end, to, '23:59'));
    }

    private dateValue(param: ReportParam, day: Date, time: string): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
        return this.inputTypeFor(param) === 'date' ? date : `${date}T${time}`;
    }

    onSubmit(event: Event) {
        event.preventDefault();
        this.runReport();
    }

    runReport() {
        this.fetchReport(this.apiName(), this.paramValues());
    }

    private fetchReport(api: string, params: Record<string, string>) {
        const filled = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
        this.backend.report(api, filled).subscribe({
            next: (rows) => {
                this.records.set(rows ?? []);
                this.displayedColumns.set(rows?.length ? Object.keys(rows[0]) : []);
                this.errorMessage.set('');
            },
            error: (err) => {
                this.errorMessage.set(errorDetail(err, 'Failed to load report data.'));
            },
        });
    }

    /** A money column of `tableName` (report rows carry SQL column names) renders at its currency's exponent. */
    cell(column: string, record: Record<string, unknown>): unknown {
        const value = record[column];
        const col = this.auth.getTableDefinition(this.tableName())?.Columns.find((c) => c.ColumnName === column || c.PascalName === column);
        return col?.CurrencyPath && (typeof value === 'number' || isInt64(value)) ? this.money.display(this.tableName(), col, value, record) : value;
    }

    titleCase(str: string): string { return titleCase(str); }
}
