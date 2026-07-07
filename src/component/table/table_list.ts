import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, linkedSignal, OnInit, signal, Type, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params } from "@angular/router";
import { catchError, EMPTY, Observable, switchMap, take, tap } from "rxjs";
import { errorDetail } from "../../util/errors";
import { AbstractEditableView } from "../abstract/base_view";
import { TableEdit } from "./table_edit";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";

@Component({
    selector: 'sail-table-list',
    templateUrl: './table_list.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [MatButtonModule, MatCheckboxModule, MatIconModule, MatPaginatorModule],
})
export class TableList extends AbstractEditableView implements OnInit {
    override dialogWidth = '400px';
    readonly tableNameInput       = input('',          { alias: 'tableName' });
    readonly apiNameInput          = input('',          { alias: 'apiName' });
    readonly dialogComponentInput  = input<Type<unknown> | undefined>(undefined, { alias: 'dialogComponent' });

    // linkedSignal: defaults to the consumer's input, but ngOnInit / route data
    // can override with `.set()`. The `computation` preserves the last
    // non-empty value when the input transiently becomes empty.
    override readonly tableName       = linkedSignal<string, string>({ source: () => this.tableNameInput(),      computation: (v, p) => v || p?.value || '' });
    override readonly apiName         = linkedSignal<string, string>({ source: () => this.apiNameInput(),        computation: (v, p) => v || p?.value || '' });
    override readonly dialogComponent = linkedSignal<Type<unknown> | undefined, Type<unknown> | undefined>({ source: () => this.dialogComponentInput(), computation: (v, p) => v ?? p?.value });

    // Server-side paging (keel list caps at the requested _limit; total from the envelope).
    readonly pageIndex = signal(0);
    readonly pageSize = signal(25);
    readonly total = signal(0);
    readonly pageSizeOptions = [10, 25, 50, 100];

    // Client-side sort of the CURRENT page — keel's list endpoint has no order
    // parameter, so cross-page ordering isn't possible from the frontend.
    readonly sortColumn = signal('');
    readonly sortAscending = signal(true);
    readonly sortedRecords = computed(() => {
        const rows = this.records();
        const column = this.sortColumn();
        if (!column) return rows;
        const dir = this.sortAscending() ? 1 : -1;
        return [...rows].sort((a, b) => {
            const av = a[column], bv = b[column];
            if (av == null && bv == null) return 0;
            if (av == null) return dir;
            if (bv == null) return -dir;
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
        });
    });

    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    ngOnInit() {
        const data = this.route.snapshot.data;
        if (!this.tableName() && data['tableName']) this.tableName.set(data['tableName']);
        if (!this.apiName() && data['apiName']) this.apiName.set(data['apiName']);
        if (!this.dialogComponent()) this.dialogComponent.set(data['dialogComponent'] ?? TableEdit);
        // switchMap: a stale slow response must not overwrite a newer one.
        this.route.queryParams.pipe(
            takeUntilDestroyed(this.destroyRef),
            switchMap((params) => this.handleQueryParams(params)),
        ).subscribe();
    }

    protected handleDelete(record: Record<string, unknown>): void {
        if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
        if (confirm('Are you sure you want to delete this record?')) {
            const keyFilter = this.getKeyFilters(record);
            this.backendService.delete(this.apiName(), keyFilter).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => {
                    console.error('Delete failed', err);
                    this.viewError.set(errorDetail(err, 'Delete failed.'));
                },
            });
        }
    }

    protected handleUpdate(result: Record<string, unknown>, isNew: boolean, _original: Record<string, unknown>): void {
        if (!this.requireAuth(() => isNew ? this.canCreate() : this.canUpdate(), isNew ? 'create' : 'update')) return;
        if (confirm('Are you sure you want to save this record?')) {
            this.backendService.post(this.apiName(), result).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => {
                    console.error('Save failed', err);
                    this.viewError.set(errorDetail(err, 'Save failed.'));
                },
            });
        }
    }

    fetchRecords() {
        if (!this.requireAuth(() => this.canRead(), 'read')) return;
        this.loadPage().subscribe();
    }

    private loadPage(): Observable<unknown> {
        const filter = {
            ...this.searchTerms(),
            _limit: String(this.pageSize()),
            _offset: String(this.pageIndex() * this.pageSize()),
        };
        return this.backendService.listPaginated<Record<string, unknown>>(this.apiName(), filter).pipe(
            tap((page) => {
                this.records.set(page.items ?? []);
                this.total.set(page.total ?? page.items?.length ?? 0);
                this.updateDisplayedColumns(page.items ?? []);
                this.viewError.set('');
            }),
            catchError((err) => {
                console.error('Fetch failed', err);
                this.viewError.set(errorDetail(err, 'Failed to load records.'));
                return EMPTY;
            }),
        );
    }

    onPage(event: PageEvent) {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this.fetchRecords();
    }

    onSortColumn(column: string) {
        if (column === 'actions') return;
        if (this.sortColumn() === column) {
            this.sortAscending.update((asc) => !asc);
        } else {
            this.sortColumn.set(column);
            this.sortAscending.set(true);
        }
    }

    /** Refresh the row list on successful action — most actions mutate visible state (set_default flipping defaults, etc.). */
    protected override onActionSuccess(): void {
        this.fetchRecords();
    }

    /** Every params emission REPLACES searchTerms, so a bare list URL clears stale filters. */
    private handleQueryParams(params: Params): Observable<unknown> {
        const newSearchTerms: {[key: string]: string} = {};
        let action = '';
        for (const key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                if (key === '_action') {
                    action = params[key];
                } else {
                    newSearchTerms[key] = params[key];
                }
            }
        }
        this.searchTerms.set(newSearchTerms);
        this.pageIndex.set(0);
        if (action === 'create') {
            // Gate on appdata so the create dialog gets real column metadata.
            this.cacheService.getAppData().pipe(
                take(1),
                takeUntilDestroyed(this.destroyRef),
            ).subscribe(() => this.addRecord());
        }
        if (!this.requireAuth(() => this.canRead(), 'read')) return EMPTY;
        return this.loadPage();
    }
}
