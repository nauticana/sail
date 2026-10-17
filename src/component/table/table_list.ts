import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, linkedSignal, OnInit, signal, Type, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { catchError, EMPTY, finalize, Observable, switchMap, take, tap } from "rxjs";
import { errorDetail } from "../../util/errors";
import { AbstractEditableView } from "../abstract/base_view";
import { TableEdit } from "./table_edit";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";

const DEFAULT_PAGE_SIZE = 25;
// keel list controls; every other query parameter is a column filter.
const RESERVED_PARAMS = new Set(['_action', '_order', '_limit', '_offset']);

@Component({
    selector: 'sail-table-list',
    templateUrl: './table_list.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [MatButtonModule, MatCheckboxModule, MatIconModule, MatPaginatorModule, MatProgressBarModule],
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

    readonly emptyMessage = input('');

    // Paging and sort live in the URL (_limit, _offset, _order) and run on the server.
    readonly pageIndex = signal(0);
    readonly pageSize = signal(DEFAULT_PAGE_SIZE);
    readonly total = signal(0);
    readonly pageSizeOptions = [10, DEFAULT_PAGE_SIZE, 50, 100];
    readonly sortColumn = signal('');
    readonly sortAscending = signal(true);
    readonly loading = signal(false);
    private request = 0;

    readonly activeFilters = computed(() => Object.entries(this.searchTerms())
        .map(([key, value]) => ({ label: this.colCaption(key), value: this.displayValue(key, value) })));

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
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
        this.prompt.ask({ title: `Delete this ${this.getCaption()} record?`, action: 'Delete record', destructive: true }, () =>
            this.backendService.delete(this.apiName(), this.getKeyFilters(record)).subscribe({
                next: () => this.fetchRecords(),
                error: (err) => {
                    console.error('Delete failed', err);
                    this.viewError.set(errorDetail(err, 'Delete failed.'));
                },
            }));
    }

    protected handleUpdate(result: Record<string, unknown>, isNew: boolean, _original: Record<string, unknown>): void {
        if (!this.requireAuth(() => isNew ? this.canCreate() : this.canUpdate(), isNew ? 'create' : 'update')) return;
        this.backendService.post(this.apiName(), result).subscribe({
            next: () => this.fetchRecords(),
            error: (err) => {
                console.error('Save failed', err);
                this.viewError.set(errorDetail(err, 'Save failed.'));
            },
        });
    }

    fetchRecords() {
        if (!this.requireAuth(() => this.canRead(), 'read')) return;
        this.loadPage().subscribe();
    }

    /** Only the latest request may change rows or clear `loading`; older responses are dropped. */
    private loadPage(): Observable<unknown> {
        const id = ++this.request;
        const size = this.pageSize();
        const column = this.sortColumn();
        this.records.set([]);
        this.loading.set(true);
        return this.backendService.listPaginated<Record<string, unknown>>(this.apiName(), this.searchTerms(), {
            limit: size,
            offset: this.pageIndex() * size,
            orderBy: column ? `${column} ${this.sortAscending() ? 'ASC' : 'DESC'}` : undefined,
        }).pipe(
            tap((page) => {
                if (id !== this.request) return;
                this.records.set(page.items ?? []);
                this.total.set(page.total ?? page.items?.length ?? 0);
                this.updateDisplayedColumns(page.items ?? []);
                this.viewError.set('');
            }),
            catchError((err) => {
                console.error('Fetch failed', err);
                if (id === this.request) this.viewError.set(errorDetail(err, 'Failed to load records.'));
                return EMPTY;
            }),
            finalize(() => { if (id === this.request) this.loading.set(false); }),
        );
    }

    onPage(event: PageEvent) {
        const offset = event.pageIndex * event.pageSize;
        this.navigate({ _limit: event.pageSize === DEFAULT_PAGE_SIZE ? null : event.pageSize, _offset: offset || null });
    }

    onSortColumn(column: string) {
        if (column === 'actions') return;
        const descending = this.sortColumn() === column && this.sortAscending();
        this.navigate({ _order: descending ? column + ' DESC' : column, _offset: null });
    }

    /** Drops the filters and the page; keeps sort and page size. */
    clearSearch() {
        const { _order, _limit } = this.route.snapshot.queryParams;
        this.router.navigate([], { relativeTo: this.route, queryParams: { _order, _limit } });
    }

    private navigate(controls: Params) {
        this.router.navigate([], { relativeTo: this.route, queryParams: { ...controls, _action: null }, queryParamsHandling: 'merge' });
    }

    protected override onActionSuccess(): void {
        this.fetchRecords();
    }

    /** Every params emission replaces the filters, so a bare list URL clears them. */
    private handleQueryParams(params: Params): Observable<unknown> {
        const filters: {[key: string]: string} = {};
        for (const [key, value] of Object.entries(params)) {
            if (!RESERVED_PARAMS.has(key)) filters[key] = String(value);
        }
        this.searchTerms.set(filters);
        const limit = Number(params['_limit']);
        const size = this.pageSizeOptions.includes(limit) ? limit : DEFAULT_PAGE_SIZE;
        const offset = Number(params['_offset']);
        this.pageSize.set(size);
        this.pageIndex.set(Number.isInteger(offset) && offset >= 0 && offset % size === 0 ? offset / size : 0);
        const order = String(params['_order'] ?? '').trim().split(/\s+/).filter(Boolean);
        const [column = '', direction = 'ASC'] = order;
        const columns = this.metadataColumns();
        const valid = order.length <= 2 && /^\w+$/.test(column) && columns.includes(column) && /^(ASC|DESC)$/i.test(direction);
        this.sortColumn.set(valid ? column : '');
        this.sortAscending.set(!valid || direction.toUpperCase() === 'ASC');
        if (params['_action'] === 'create') {
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
