import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { map, Observable, of, switchMap, take } from "rxjs";
import { RecordForm } from "../form/form_record";
import { BaseView } from "../abstract/base_view";

@Component({
    selector: 'sail-table-lookup',
    templateUrl: './table_lookup.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [
        MatButtonModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
        RecordForm,
    ],
})
export class TableLookup extends BaseView implements OnInit {
    override readonly tableName = signal('');
    readonly searchRecord = signal<Record<string, unknown>>({});
    readonly searchColumns = computed<string[]>(() => {
        this.cacheService.appDataVersion();
        this.tableName();
        return this.getDisplayedColumns();
    });

    private readonly dialogRef = inject(MatDialogRef<TableLookup>);
    private readonly data = inject<{tableName?: string; apiName?: string}>(MAT_DIALOG_DATA);

    /** A lookup only selects — no edit/delete, so no appended "actions" column. */
    protected override includeActionsColumn(): boolean {
        return false;
    }

    ngOnInit() {
        if (this.data) {
            this.tableName.set(this.data.tableName ?? '');
            this.apiName.set(this.data.apiName   ?? '');
        }
        this.searchRecord.set(this.emptyRecord());
        this.resolveApi().subscribe();
    }

    /** Resolve (and cache) the api serving this table; '' when none matches. */
    private resolveApi(): Observable<string> {
        const apiName = this.apiName();
        if (apiName) return of(apiName);
        const tableName = this.tableName();
        return this.cacheService.getAppData().pipe(
            take(1),
            map((data) => {
                for (const api in data.Apis ?? {}) {
                    if (data.Apis[api].Table?.TableName === tableName) {
                        this.apiName.set(api); // bare RestUri; BackendService.crudUrl resolves the version
                        return api;
                    }
                }
                return '';
            }),
        );
    }

    onSearch() {
        // Chained on resolveApi so an early click waits instead of silently no-oping.
        this.resolveApi().pipe(
            switchMap((apiName) => {
                if (!apiName) {
                    this.viewError.set(`No API found for table ${this.tableName()}`);
                    return of<Record<string, unknown>[]>([]);
                }
                return this.backendService.list<Record<string, unknown>>(apiName, this.buildSearchTerms(this.searchRecord()));
            }),
        ).subscribe({
            next: (records) => {
                this.records.set(records);
                this.updateDisplayedColumns(records);
            },
            error: (err) => {
                console.error('Lookup search failed', err);
                this.viewError.set(this.errorText(err, 'Search failed.'));
            },
        });
    }

    onSelect(record: Record<string, unknown>) {
        this.dialogRef.close(record);
    }

    onClear() {
        this.searchRecord.set(this.emptyRecord());
        this.records.set([]);
    }
}
