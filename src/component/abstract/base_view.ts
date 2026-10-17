import { computed, DestroyRef, Directive, inject, signal, Type, WritableSignal } from "@angular/core";
import { BaseTable } from "./base_table";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";

/** Read-only listing surface; complete as-is (TableLookup). Editing views extend AbstractEditableView. */
@Directive()
export abstract class BaseView extends BaseTable {
    readonly apiName: WritableSignal<string> = signal('');
    readonly records = signal<Record<string, unknown>[]>([]);
    readonly displayedColumns = signal<string[]>([]);
    readonly searchTerms = signal<{[key: string]: string}>({});
    /** Last load/save failure shown by the view's template ('' when none). */
    readonly viewError = signal('');

    protected readonly hasLinkPermission = computed(() => this.canUpdate() || this.canRead());

    protected override reportError(message: string): void {
        this.viewError.set(message);
    }

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
}

/** Listing surface with dialog-based create/edit/delete; subclasses implement persistence. */
@Directive()
export abstract class AbstractEditableView extends BaseView {
    protected readonly dialog = inject(MatDialog);
    readonly dialogComponent: WritableSignal<Type<unknown> | undefined> = signal(undefined);
    private activeDialog?: MatDialogRef<unknown>;

    constructor() {
        super();
        // The dialog outlives navigation (closeOnNavigation: false) until the route guard approves it.
        inject(DestroyRef).onDestroy(() => this.activeDialog?.close());
    }

    /** Read by `BaseAuthService.canDeactivate`; delegates to an open dialog implementing the contract. */
    hasUnsavedChanges(): boolean {
        const form = this.activeDialog?.componentInstance as { hasUnsavedChanges?: () => boolean } | undefined;
        return form?.hasUnsavedChanges?.() ?? false;
    }

    protected abstract handleDelete(record: Record<string, unknown>): void;

    protected abstract handleUpdate(result: Record<string, unknown>, isNew: boolean, original: Record<string, unknown>): void;

    /** Opens the row dialog and hands its result to `handleUpdate()`. */
    private openRecordDialog(record: Record<string, unknown>, isNew: boolean): void {
        const component = this.dialogComponent();
        if (!component) {
            console.error('sail: no dialogComponent configured for', this.tableName());
            return;
        }
        const dialogData = this.getDialogData(record, isNew);
        const apiName = this.apiName();
        if (apiName) dialogData['apiName'] = apiName;

        const ref = this.activeDialog = this.dialog.open(component, {
            width: '90vw',
            maxWidth: '1200px',
            maxHeight: '90vh',
            disableClose: true,
            closeOnNavigation: false,
            data: dialogData,
        });
        ref.afterClosed().subscribe((result) => {
            if (this.activeDialog === ref) this.activeDialog = undefined;
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

    /** Opens the row dialog; read-only users see the record, the dialog gates its own actions. */
    editRecord(record: Record<string, unknown>) {
        if (!this.canUpdate() && !this.requireAuth(() => this.canRead(), 'view')) return;
        this.openRecordDialog(record, false);
    }

    deleteRecord(record: Record<string, unknown>) {
        if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
        this.handleDelete(record);
    }
}
