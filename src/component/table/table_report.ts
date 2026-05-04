import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { BaseAuthService } from "../../service/auth.service";
import { RestURL } from "../../service/rest_url";

@Component({
    selector: 'table-report',
    templateUrl: './table_report.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCheckboxModule],
})
export class TableReport {
    readonly apiName = input('');
    readonly tableName = input('');

    private readonly http = inject(HttpClient);
    private readonly auth = inject(BaseAuthService);

    readonly records = signal<Record<string, unknown>[]>([]);
    readonly displayedColumns = signal<string[]>([]);
    readonly errorMessage = signal('');

    /**
     * Report header text — long-form description from rest_report_header.
     * Falls back to the title-cased table name only if the lookup misses
     * (e.g. a brand-new report whose row hasn't been seeded yet).
     */
    readonly reportTitle = computed(() => {
        const reportId = this.apiName().split('/').pop() ?? '';
        return this.auth.getReport(reportId)?.Description || this.titleCase(this.tableName());
    });

    constructor() {
        effect(() => {
            const api = this.apiName();
            if (!api) return;

            if (!this.auth.canReport(api)) {
                this.errorMessage.set('You do not have permission to view this report.');
                return;
            }
            this.fetchReport(api);
        });
    }

    private fetchReport(api: string) {
        const url = RestURL.httpHost + '/api/' + api;
        this.http.get<Record<string, unknown>[]>(url).subscribe({
            next: (rows) => {
                this.records.set(rows ?? []);
                if (rows?.length) {
                    this.displayedColumns.set(Object.keys(rows[0]));
                }
            },
            error: (err) => {
                this.errorMessage.set(err?.error ?? 'Failed to load report data.');
            },
        });
    }

    titleCase(str: string): string {
        return str.replaceAll('_', ' ').toLowerCase().split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}
