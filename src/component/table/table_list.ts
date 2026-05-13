import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, input, linkedSignal, OnInit, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params } from "@angular/router";
import { BaseView } from "../abstract/base_view";
import { TableEdit } from "./table_edit";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";

@Component({
    selector: 'sail-table-list',
    templateUrl: './table_list.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [MatButtonModule, MatCheckboxModule, MatIconModule],
})
export class TableList extends BaseView implements OnInit {
    override dialogWidth = '400px';
    protected readonly tableNameInput      = input('',          { alias: 'tableName' });
    protected readonly apiNameInput        = input('',          { alias: 'apiName' });
    protected readonly dialogComponentInput = input<any>(undefined, { alias: 'dialogComponent' });

    // linkedSignal: defaults to the consumer's input, but ngOnInit / route data
    // can override with `.set()`. The `computation` preserves the last
    // non-empty value when the input transiently becomes empty.
    override readonly tableName       = linkedSignal<string, string>({ source: () => this.tableNameInput(),      computation: (v, p) => v || p?.value || '' });
    override readonly apiName         = linkedSignal<string, string>({ source: () => this.apiNameInput(),        computation: (v, p) => v || p?.value || '' });
    override readonly dialogComponent = linkedSignal<any, any>({       source: () => this.dialogComponentInput(), computation: (v, p) => v ?? p?.value });

    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly destroyRef = inject(DestroyRef);

    ngOnInit() {
        const data = this.route.snapshot.data;
        if (!this.tableName() && data['tableName']) this.tableName.set(data['tableName']);
        if (!this.apiName() && data['apiName']) this.apiName.set(data['apiName']);
        if (!this.dialogComponent()) this.dialogComponent.set(data['dialogComponent'] ?? TableEdit);
        this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.handleQueryParams(params));
    }

    protected handleDelete(record: {[key: string]: any}): void {
        if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
        if (confirm('Are you sure you want to delete this record?')) {
            const keyFilter = this.getKeyFilters(record);
            this.backendService.delete(this.apiName(), keyFilter).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => console.error('Delete failed', err),
            });
        }
    }

    protected handleUpdate(result: {[key: string]: any}, isNew: boolean, _original: {[key: string]: any}): void {
        if (!this.requireAuth(() => isNew ? this.canCreate() : this.canUpdate(), isNew ? 'create' : 'update')) return;
        if (confirm('Are you sure you want to save this record?')) {
            this.backendService.post(this.apiName(), result).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => console.error('Save failed', err),
            });
        }
    }

    fetchRecords() {
        if (!this.requireAuth(() => this.canRead(), 'read')) return;
        this.backendService.list<{[key: string]: any}>(this.apiName(), this.searchTerms).subscribe({
            next: (records) => {
                this.records = records;
                this.updateDisplayedColumns(records);
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Fetch failed', err),
        });
    }

    /** Refresh the row list on successful action — most actions mutate visible state (set_default flipping defaults, etc.). */
    protected override onActionSuccess(): void {
        this.fetchRecords();
    }

    handleQueryParams(params: Params) {
        const newSearchTerms: {[key: string]: string} = {};
        let hasSearchTerms = false;
        let action = '';
        for (const key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                if (key === '_action') {
                    action = params[key];
                } else {
                    newSearchTerms[key] = params[key];
                    hasSearchTerms = true;
                }
            }
        }
        if (hasSearchTerms) this.searchTerms = newSearchTerms;
        this.fetchRecords();
        if (action === 'create') {
            setTimeout(() => this.addRecord(), 500);
        }
    }
}
