import { computed, Directive, inject, signal, Type, WritableSignal } from "@angular/core";
import { BaseTable } from "./base_table";
import { MatDialog } from "@angular/material/dialog";

/** Read-only listing surface; complete as-is (TableLookup). Editing views extend AbstractEditableView. */
@Directive()
export abstract class BaseView extends BaseTable {
    readonly apiName: WritableSignal<string> = signal('');
    readonly records = signal<Record<string, unknown>[]>([]);
    readonly displayedColumns = signal<string[]>([]);
    readonly searchTerms = signal<{[key: string]: string}>({});
    /** Last load/save failure shown by the view's template ('' when none). */
    readonly viewError = signal('');

    protected readonly hasLinkPermission = computed(() => {
        this.cacheService.appDataVersion();
        this.tableName();
        return this.canUpdate() || this.canRead();
    });

    /** Whether an "actions" column is appended for privileged users; lookup views return false. */
    protected includeActionsColumn(): boolean {
        return true;
    }

    updateDisplayedColumns(records: Record<string, unknown>[]) {
        const columns = this.getDisplayedColumns(records);
        if (columns.length > 0 &&
            this.includeActionsColumn() &&
            !columns.includes('actions') &&
            (this.canUpdate() || this.canDelete())
        ) columns.push('actions');
        this.displayedColumns.set(columns);
    }

    isLinkColumn(column: string): boolean {
        const columns = this.displayedColumns();
        return (columns.length > 0 && columns[0] === column && this.hasLinkPermission());
    }

    /** Human-readable message for a failed view operation. */
    protected errorText(err: unknown, fallback: string): string {
        return err instanceof Error && err.message ? err.message : fallback;
    }
}

/** Listing surface with dialog-based create/edit/delete; subclasses implement persistence. */
@Directive()
export abstract class AbstractEditableView extends BaseView {
    protected readonly dialog = inject(MatDialog);
    readonly dialogComponent: WritableSignal<Type<unknown> | undefined> = signal(undefined);

    protected abstract handleDelete(record: Record<string, unknown>): void;

    protected abstract handleUpdate(result: Record<string, unknown>, isNew: boolean, original: Record<string, unknown>): void;

    /**
     * Shared row-dialog opener. Builds the dialog data and wires the result
     * straight into `handleUpdate()` (subclass-specific). Used by both
     * `addRecord()` (new row + empty `original`) and `editRecord()` (existing
     * row passed through verbatim).
     */
    private openRecordDialog(record: Record<string, unknown>, isNew: boolean): void {
        const component = this.dialogComponent();
        if (!component) {
            console.error('sail: no dialogComponent configured for', this.tableName());
            return;
        }
        const dialogData = this.getDialogData(record, isNew);
        const apiName = this.apiName();
        if (apiName) dialogData['apiName'] = apiName;

        this.dialog.open(component, {
            width: '90vw',
            maxWidth: '1200px',
            maxHeight: '90vh',
            disableClose: true,
            data: dialogData,
        }).afterClosed().subscribe((result) => {
            if (result) this.handleUpdate(result, isNew, isNew ? {} : record);
        });
    }

    addRecord() {
        if (!this.requireAuth(() => this.canCreate(), 'create')) return;
        const record = this.emptyRecord();
        // Seed columns from an existing row when emptyRecord() returned just the
        // op-code field (table metadata wasn't loaded yet).
        const rows = this.records();
        if (Object.keys(record).length === 1 && rows.length > 0) {
            Object.keys(rows[0]).forEach((key) => { record[key] = ''; });
        }
        this.openRecordDialog(record, true);
    }

    /**
     * Open the row dialog. Renamed conceptually from "edit": when the user
     * has only `canRead()`, we still want to show them the record + child rows.
     * The dialog itself (TableEdit) handles read-only mode — its Edit/New/Delete
     * buttons are gated by the same permissions.
     * Block only when neither read nor update is granted.
     */
    editRecord(record: Record<string, unknown>) {
        if (!this.canUpdate() && !this.requireAuth(() => this.canRead(), 'view')) return;
        this.openRecordDialog(record, false);
    }

    deleteRecord(record: Record<string, unknown>) {
        if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
        this.handleDelete(record);
    }
}
