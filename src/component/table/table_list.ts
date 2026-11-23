import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Injector, input, linkedSignal, OnInit, signal, Type, viewChild, ViewEncapsulation } from "@angular/core";
import { NgComponentOutlet } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { catchError, distinctUntilChanged, EMPTY, finalize, Observable, switchMap, take, tap } from "rxjs";
import { errorDetail } from "../../util/errors";
import { saveBlob } from "../../util/download";
import { AbstractEditableView } from "../abstract/base_view";
import { TableEdit } from "./table_edit";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { toSafeInteger } from '../../util/integer';
import { TablePreferences } from "../../service/table_preferences";
import { TablePrefs } from "../../model/table_prefs";

const DEFAULT_PAGE_SIZE = 25;
// keel list controls and the open record; every other query parameter is a column filter.
const RESERVED_PARAMS = new Set(['_action', '_order', '_limit', '_offset', '_record']);
const MIN_WIDTH = 48;
const MAX_WIDTH = 800;
const WIDTH_STEP = 16;
const MAX_SAVED_FILTERS = 20;

/** `dialog` opens a record over the list; `split` opens it in a pane beside the list. */
export type TableListLayout = 'dialog' | 'split';

interface PaneState {
    record: Record<string, unknown>;
    isNew: boolean;
}

@Component({
    selector: 'sail-table-list',
    templateUrl: './table_list.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [NgComponentOutlet, MatButtonModule, MatCheckboxModule, MatIconModule, MatPaginatorModule, MatProgressBarModule],
})
export class TableList extends AbstractEditableView implements OnInit {
    override dialogWidth = '400px';
    readonly tableNameInput       = input('',          { alias: 'tableName' });
    readonly apiNameInput          = input('',          { alias: 'apiName' });
    readonly dialogComponentInput  = input<Type<unknown> | undefined>(undefined, { alias: 'dialogComponent' });
    readonly layoutInput           = input<TableListLayout | undefined>(undefined, { alias: 'layout' });

    // linkedSignal: defaults to the consumer's input, but ngOnInit / route data
    // can override with `.set()`. The `computation` preserves the last
    // non-empty value when the input transiently becomes empty.
    override readonly tableName       = linkedSignal<string, string>({ source: () => this.tableNameInput(),      computation: (v, p) => v || p?.value || '' });
    override readonly apiName         = linkedSignal<string, string>({ source: () => this.apiNameInput(),        computation: (v, p) => v || p?.value || '' });
    override readonly dialogComponent = linkedSignal<Type<unknown> | undefined, Type<unknown> | undefined>({ source: () => this.dialogComponentInput(), computation: (v, p) => v ?? p?.value });
    readonly layout = linkedSignal<TableListLayout | undefined, TableListLayout>({ source: () => this.layoutInput(), computation: (v, p) => v ?? p?.value ?? 'dialog' });

    readonly emptyMessage = input('');

    // Paging and sort live in the URL (_limit, _offset, _order) and run on the server.
    readonly pageIndex = signal(0);
    readonly pageSize = signal(DEFAULT_PAGE_SIZE);
    readonly total = signal(0);
    readonly pageSizeOptions = [10, DEFAULT_PAGE_SIZE, 50, 100];
    readonly sortColumn = signal('');
    readonly sortAscending = signal(true);
    readonly loading = signal(false);
    readonly exporting = signal(false);
    /** The last export held fewer rows than matched (keel's `max_export_rows`). */
    readonly exportTruncated = signal(false);
    private request = 0;

    readonly activeFilters = computed(() => Object.entries(this.searchTerms())
        .map(([key, value]) => ({ label: this.colCaption(key), value: this.displayValue(key, value) })));

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    private readonly preferences = inject(TablePreferences);

    /** The user's layout for this table, from `TablePreferences`. */
    readonly prefs = linkedSignal<string, TablePrefs>({ source: () => this.tableName(), computation: (table) => table ? this.preferences.read(table) : {} });

    /** Data columns in the user's order, hidden ones included (the column menu lists them). */
    readonly orderedColumns = computed(() => {
        const order = this.prefs().order ?? [];
        const all = this.displayedColumns().filter((c) => c !== 'actions');
        const rank = (c: string) => order.includes(c) ? order.indexOf(c) : order.length + all.indexOf(c);
        return all.sort((a, b) => rank(a) - rank(b));
    });

    /** Rendered columns: the visible data columns, then `actions`. */
    readonly columns = computed(() => {
        const hidden = new Set(this.prefs().hidden);
        const columns = this.orderedColumns().filter((c) => !hidden.has(c));
        return this.displayedColumns().includes('actions') ? [...columns, 'actions'] : columns;
    });

    readonly columnsOpen = signal(false);
    readonly pane = signal<PaneState | null>(null);
    private readonly paneOutlet = viewChild(NgComponentOutlet);
    private readonly paneKey = computed(() => {
        const pane = this.pane();
        return pane && !pane.isNew ? this.recordKey(pane.record) : '';
    });
    /** The pane's row on this page, -1 when it is not on it. */
    readonly paneIndex = computed(() => {
        const key = this.paneKey();
        return key ? this.records().findIndex((r) => this.recordKey(r) === key) : -1;
    });
    /** The pane component receives the dialog contract: MAT_DIALOG_DATA, and a MatDialogRef whose `close(result)` saves. */
    readonly paneInjector = computed(() => {
        const pane = this.pane();
        if (!pane) return null;
        const ref: Pick<MatDialogRef<unknown>, 'close'> = { close: (result?: unknown) => this.closePane(pane, result) };
        return Injector.create({ parent: this.injector, providers: [
            { provide: MAT_DIALOG_DATA, useValue: this.recordData(pane.record, pane.isNew) },
            { provide: MatDialogRef, useValue: ref },
        ] });
    });
    private resizing?: { column: string; x: number; width: number };

    ngOnInit() {
        const data = this.route.snapshot.data;
        if (!this.tableName() && data['tableName']) this.tableName.set(data['tableName']);
        if (!this.apiName() && data['apiName']) this.apiName.set(data['apiName']);
        if (!this.dialogComponent()) this.dialogComponent.set(data['dialogComponent'] ?? TableEdit);
        if (!this.layoutInput() && data['layout']) this.layout.set(data['layout']);
        // Opening a record changes no list parameter, so it does not reload the rows;
        // switchMap: a stale slow response must not overwrite a newer one.
        this.route.queryParams.pipe(
            takeUntilDestroyed(this.destroyRef),
            tap((params) => this.handleRecordParams(params)),
            distinctUntilChanged((a, b) => this.listQuery(a) === this.listQuery(b)),
            switchMap((params) => this.handleQueryParams(params)),
        ).subscribe();
    }

    protected handleDelete(record: Record<string, unknown>): void {
        if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
        this.prompt.ask({ title: `Delete this ${this.getCaption()} record?`, action: 'Delete record', destructive: true }, () =>
            this.backendService.delete(this.apiName(), this.getKeyFilters(record)).subscribe({
                next: () => {
                    if (this.isPaneRecord(record)) this.showPane(null);
                    this.fetchRecords();
                },
                error: (err) => {
                    console.error('Delete failed', err);
                    this.viewError.set(errorDetail(err, 'Delete failed.'));
                },
            }));
    }

    protected handleUpdate(result: Record<string, unknown>, isNew: boolean, _original: Record<string, unknown>): void {
        if (!this.requireAuth(() => isNew ? this.canCreate() : this.canUpdate(), isNew ? 'create' : 'update')) return;
        this.backendService.post(this.apiName(), result).subscribe({
            next: () => {
                this.fetchRecords();
                if (this.pane()) this.showPane(this.recordKey(result) ? { record: result, isNew: false } : null);
            },
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
        this.records.set([]);
        this.loading.set(true);
        return this.backendService.listPaginated<Record<string, unknown>>(this.apiName(), this.searchTerms(), {
            limit: size,
            offset: this.pageIndex() * size,
            orderBy: this.orderBy(),
        }).pipe(
            tap((page) => {
                if (id !== this.request) return;
                this.records.set(page.items ?? []);
                this.total.set(toSafeInteger(page.total ?? page.items?.length ?? 0));
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

    private orderBy(): string | undefined {
        const column = this.sortColumn();
        return column ? `${column} ${this.sortAscending() ? 'ASC' : 'DESC'}` : undefined;
    }

    /** Downloads every row matching the current filters, in the current order. */
    exportCsv() {
        if (!this.requireAuth(() => this.canExport(), 'export')) return;
        this.exporting.set(true);
        this.exportTruncated.set(false);
        this.backendService.exportCsv(this.apiName(), this.searchTerms(), this.orderBy()).pipe(
            finalize(() => this.exporting.set(false)),
        ).subscribe({
            next: (file) => {
                saveBlob(file.blob, this.tableName() + '.csv');
                this.exportTruncated.set(file.truncated);
                this.viewError.set('');
            },
            error: (err) => {
                console.error('Export failed', err);
                this.viewError.set('Export failed.');
            },
        });
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

    /** Drops the filters and the page; keeps sort, page size and the open record. */
    clearSearch() {
        this.applyFilters({});
    }

    applyFilters(filters: Record<string, string>) {
        const { _order, _limit, _record } = this.route.snapshot.queryParams;
        this.router.navigate([], { relativeTo: this.route, queryParams: { ...filters, _order, _limit, _record } });
    }

    /** Keeps the newest `MAX_SAVED_FILTERS`; saving the same filters again replaces the entry. */
    saveFilter() {
        const filters = this.searchTerms();
        const name = this.activeFilters().map((f) => `${f.label}: ${f.value}`).join(', ');
        const same = JSON.stringify(filters);
        const saved = (this.prefs().filters ?? []).filter((f) => JSON.stringify(f.filters) !== same);
        this.savePrefs({ filters: [...saved, { name, filters }].slice(-MAX_SAVED_FILTERS) });
    }

    removeFilter(index: number) {
        this.savePrefs({ filters: (this.prefs().filters ?? []).filter((_, i) => i !== index) });
    }

    toggleCompact() {
        this.savePrefs({ compact: !this.prefs().compact });
    }

    isHidden(column: string): boolean {
        return this.prefs().hidden?.includes(column) ?? false;
    }

    toggleColumn(column: string) {
        const hidden = this.prefs().hidden ?? [];
        this.savePrefs({ hidden: hidden.includes(column) ? hidden.filter((c) => c !== column) : [...hidden, column] });
    }

    moveColumn(column: string, delta: number) {
        const order = [...this.orderedColumns()];
        const from = order.indexOf(column);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= order.length) return;
        [order[from], order[to]] = [order[to], order[from]];
        this.savePrefs({ order });
    }

    resetColumns() {
        this.savePrefs({ hidden: undefined, order: undefined, widths: undefined });
    }

    columnWidth(column: string): number | null {
        return this.prefs().widths?.[column] ?? null;
    }

    startResize(event: PointerEvent, column: string) {
        const handle = event.target as HTMLElement;
        handle.setPointerCapture(event.pointerId);
        this.resizing = { column, x: event.clientX, width: handle.parentElement?.getBoundingClientRect().width ?? MIN_WIDTH };
    }

    dragResize(event: PointerEvent) {
        if (this.resizing) this.setWidth(this.resizing.column, this.resizing.width + event.clientX - this.resizing.x, false);
    }

    endResize() {
        if (!this.resizing) return;
        this.resizing = undefined;
        this.savePrefs({});
    }

    /** Arrow keys on the resize handle. */
    stepWidth(event: Event, column: string, delta: number) {
        event.preventDefault();
        const th = (event.target as HTMLElement).parentElement;
        this.setWidth(column, (this.columnWidth(column) ?? th?.getBoundingClientRect().width ?? MIN_WIDTH) + delta * WIDTH_STEP);
    }

    private setWidth(column: string, width: number, persist = true) {
        const px = Math.round(Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH));
        const widths = { ...this.prefs().widths, [column]: px };
        if (persist) this.savePrefs({ widths });
        else this.prefs.update((p) => ({ ...p, widths }));
    }

    private savePrefs(change: TablePrefs) {
        const prefs = { ...this.prefs(), ...change };
        this.prefs.set(prefs);
        this.preferences.write(this.tableName(), prefs);
    }

    /** The first visible column opens the record. */
    override isLinkColumn(column: string): boolean {
        return this.columns()[0] === column && this.hasLinkPermission();
    }

    /** In the split layout the record opens in the pane, an existing one with its key in `_record`. */
    protected override openRecord(record: Record<string, unknown>, isNew: boolean): void {
        if (this.layout() !== 'split') {
            super.openRecord(record, isNew);
            return;
        }
        this.leavePane(() => this.showPane({ record, isNew }));
    }

    /** Opens the previous (-1) or next (1) row of this page in the pane. */
    stepRecord(delta: number) {
        const record = this.records()[this.paneIndex() + delta];
        if (record && this.paneIndex() >= 0) this.openRecord(record, false);
    }

    isPaneRecord(record: Record<string, unknown>): boolean {
        return !!this.paneKey() && this.recordKey(record) === this.paneKey();
    }

    override hasUnsavedChanges(): boolean {
        const pane = this.paneOutlet()?.componentInstance as { hasUnsavedChanges?: () => boolean } | null | undefined;
        return super.hasUnsavedChanges() || (pane?.hasUnsavedChanges?.() ?? false);
    }

    private leavePane(then: () => void) {
        if (!this.pane() || !this.hasUnsavedChanges()) {
            then();
            return;
        }
        this.prompt.ask({ title: 'Discard your changes?', message: 'Your edits to this record are not saved.', action: 'Discard changes', destructive: true }, then);
    }

    private closePane(pane: PaneState, result?: unknown) {
        if (result) {
            this.handleUpdate(result as Record<string, unknown>, pane.isNew, pane.isNew ? {} : pane.record);
            return;
        }
        this.showPane(null);
    }

    /** Sets or closes the pane and keeps `_record` in step; a new record has none. */
    private showPane(pane: PaneState | null) {
        this.pane.set(pane);
        this.navigate({ _record: this.paneKey() || null });
    }

    /** The row's key values, each URI-encoded, joined by commas; '' without a complete key. */
    private recordKey(record: Record<string, unknown>): string {
        const values = Object.values(this.getKeyFilters(record) ?? {});
        return values.length && values.every((v) => v !== '') ? values.map(encodeURIComponent).join(',') : '';
    }

    /** Opens or closes the pane to follow `_record` (a deep link, or back and forward). */
    private syncPane(key: string) {
        if (key === this.paneKey()) return;
        if (!key) {
            if (!this.pane()?.isNew) this.pane.set(null);
            return;
        }
        const keys = this.cacheService.getTableDefinition(this.tableName())?.Keys ?? [];
        let values: string[];
        try {
            values = key.split(',').map(decodeURIComponent);
        } catch {
            return;
        }
        if (values.length !== keys.length) return;
        const record = this.records().find((r) => this.recordKey(r) === key)
            ?? Object.fromEntries(keys.map((k, i) => [k.PascalName, values[i]]));
        this.pane.set({ record, isNew: false });
    }

    private navigate(controls: Params) {
        this.router.navigate([], { relativeTo: this.route, queryParams: { ...controls, _action: null }, queryParamsHandling: 'merge' });
    }

    protected override onActionSuccess(): void {
        this.fetchRecords();
    }

    /** The parameters that select rows; `_record` and `_action` do not. */
    private listQuery(params: Params): string {
        return JSON.stringify(Object.entries(params).filter(([k]) => k !== '_record' && k !== '_action').sort());
    }

    /** Gated on appdata so the record gets real column metadata. */
    private handleRecordParams(params: Params) {
        this.cacheService.getAppData().pipe(
            take(1),
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            if (this.layout() === 'split') this.syncPane(String(params['_record'] ?? ''));
            if (params['_action'] === 'create') this.addRecord();
        });
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
        if (!this.requireAuth(() => this.canRead(), 'read')) return EMPTY;
        return this.loadPage();
    }
}
