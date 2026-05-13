import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from "@angular/core";
import { HttpParams } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { BaseAuthService } from "../../service/auth.service";
import { BaseRestService } from "../../service/base_rest.service";
import { ConstantValue } from "../../model/common";
import { ReportParam } from "../../model/appdata";
import { titleCase } from "../../util/text";

@Component({
    selector: 'sail-table-report',
    templateUrl: './table_report.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
    ],
})
export class TableReport extends BaseRestService {
    readonly apiName = input('');
    readonly tableName = input('');

    private readonly auth = inject(BaseAuthService);

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
     * Report header text — long-form description from rest_report_header.
     * Falls back to the title-cased table name only if the lookup misses
     * (e.g. a brand-new report whose row hasn't been seeded yet).
     */
    readonly reportTitle = computed(() => {
        const reportId = this.apiName().split('/').pop() ?? '';
        return this.auth.getReport(reportId)?.Description || titleCase(this.tableName());
    });

    /**
     * Param definitions for the current report. Empty when the report has
     * no rest_report_param rows — in that case we fetch immediately. With
     * params we render an input form and wait for the user to click "Run",
     * preserving the standard "filter then fetch" UX for parameterized
     * reports.
     */
    readonly params = computed<ReportParam[]>(() => {
        const reportId = this.apiName().split('/').pop() ?? '';
        return this.auth.getReport(reportId)?.Params ?? [];
    });

    constructor() {
        super();
        effect(() => {
            const api = this.apiName();
            if (!api) return;

            if (!this.auth.canReport(api)) {
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

    paramValue(name: string): string {
        return this.paramValues()[name] ?? '';
    }

    runReport() {
        this.fetchReport(this.apiName(), this.paramValues());
    }

    private fetchReport(api: string, params: Record<string, string>) {
        let httpParams = new HttpParams();
        for (const [k, v] of Object.entries(params)) {
            // Drop empty values so the URL doesn't carry `?param=` for
            // unset fields — backends should treat absent and empty-string
            // the same, sending neither is the cleanest signal.
            if (v !== '' && v != null) {
                httpParams = httpParams.set(k, v);
            }
        }
        this.http.get<Record<string, unknown>[]>(this.url('/api/' + api), { params: httpParams }).subscribe({
            next: (rows) => {
                this.records.set(rows ?? []);
                if (rows?.length) {
                    this.displayedColumns.set(Object.keys(rows[0]));
                } else {
                    this.displayedColumns.set([]);
                }
                this.errorMessage.set('');
            },
            error: (err) => {
                this.errorMessage.set(err?.error?.detail ?? err?.error?.message ?? 'Failed to load report data.');
            },
        });
    }

    /** Re-exported for templates; same as the shared util. */
    titleCase(str: string): string { return titleCase(str); }
}
