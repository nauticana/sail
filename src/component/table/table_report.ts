import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from "@angular/core";
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
    ],
})
export class TableReport {
    readonly apiName = input('');
    readonly tableName = input('');

    private readonly auth = inject(BaseAuthService);
    private readonly backend = inject(BackendService);

    readonly records = signal<Record<string, unknown>[]>([]);
    readonly displayedColumns = signal<string[]>([]);
    readonly errorMessage = signal('');

    /**
     * Per-parameter input bindings, keyed by param name. Empty string when
     * the user hasn't entered a value yet — fetchReport drops empties so
     * the URL doesn't carry `?param=` for unset fields.
     */
    readonly paramValues = signal<Record<string, string>>({});

    /**
     * Report id — the last path segment of apiName (e.g. 'scorecard' for
     * 'analytic/scorecard'). This is the key for metadata lookup AND the value
     * REPORT/ACCESS grants are scoped to; the full path is only used for the
     * fetch URL.
     */
    readonly reportId = computed(() => this.apiName().split('/').pop() ?? '');

    /** Long-form header from rest_report_header; falls back to the title-cased table name. */
    readonly reportTitle = computed(() => {
        this.auth.appDataVersion();
        return this.auth.getReport(this.reportId())?.Description || titleCase(this.tableName());
    });

    /**
     * Param definitions for the current report. Empty when the report has
     * no rest_report_param rows — in that case we fetch immediately. With
     * params we render an input form and wait for the user to click "Run".
     */
    readonly params = computed<ReportParam[]>(() => {
        this.auth.appDataVersion();
        return this.auth.getReport(this.reportId())?.Params ?? [];
    });

    constructor() {
        effect(() => {
            const api = this.apiName();
            if (!api) return;
            // New report target: drop the previous report's rows and params.
            this.records.set([]);
            this.displayedColumns.set([]);
            this.paramValues.set({});
            this.errorMessage.set('');

            if (!this.auth.canReport(this.reportId())) {
                this.errorMessage.set('You do not have permission to view this report.');
                return;
            }
            // Auto-fetch only when the report takes no inputs.
            if (this.params().length === 0) {
                this.fetchReport(api, {});
            }
        });
    }

    /**
     * Look up the constant_value options for a parameter's domain.
     * Returns undefined when the parameter has no ConstantId — caller
     * renders a plain input in that case.
     */
    optionsFor(param: ReportParam): ConstantValue[] | undefined {
        if (!param.ConstantId) return undefined;
        return this.auth.getDomainValues(param.ConstantId);
    }

    /**
     * Native HTML input type derived from a parameter's data_type. Used
     * only when the parameter has no constant domain.
     */
    inputTypeFor(param: ReportParam): string {
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

    onSubmit(event: Event) {
        event.preventDefault();
        this.runReport();
    }

    runReport() {
        this.fetchReport(this.apiName(), this.paramValues());
    }

    private fetchReport(api: string, params: Record<string, string>) {
        const filled: Record<string, string> = {};
        for (const [k, v] of Object.entries(params)) {
            // Drop empty values so the URL doesn't carry `?param=` for unset fields.
            if (v !== '' && v != null) filled[k] = v;
        }
        this.backend.report(api, filled).subscribe({
            next: (rows) => {
                this.records.set(rows ?? []);
                this.displayedColumns.set(rows?.length ? Object.keys(rows[0]) : []);
                this.errorMessage.set('');
            },
            error: (err) => {
                this.errorMessage.set(err instanceof Error && err.message ? err.message : 'Failed to load report data.');
            },
        });
    }

    /** Re-exported for templates; same as the shared util. */
    titleCase(str: string): string { return titleCase(str); }
}
