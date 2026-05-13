import { Directive, inject, signal, WritableSignal } from "@angular/core";
import { BaseTable } from "./base_table";
import { MatDialog } from "@angular/material/dialog";

@Directive()
export abstract class BaseView extends BaseTable {
    protected readonly dialog = inject(MatDialog);
    readonly apiName: WritableSignal<string> = signal('');
    readonly dialogComponent: WritableSignal<any> = signal(undefined);
    records: Array<{[key: string]: any}> = [];
    displayedColumns: string[] = [];
    searchTerms: {[key: string]: string} = {};
    protected hasLinkPermission = false;

    protected abstract handleDelete(record: {[key: string]: any}): void;

    protected abstract handleUpdate(result: {[key: string]: any}, isNew: boolean, original: {[key: string]: any}): void;

    updateDisplayedColumns(record: Array<{[key: string]: any}>) {
        this.displayedColumns = this.getDisplayedColumns(record);
        if (this.displayedColumns.length > 0 &&
            !this.displayedColumns.includes('actions') &&
            (this.canUpdate() || this.canDelete())
        ) this.displayedColumns.push('actions');
        this.hasLinkPermission = this.canUpdate() || this.canRead();
    }

    isLinkColumn(column: string): boolean {
        return (this.displayedColumns.length > 0 && this.displayedColumns[0] === column && this.hasLinkPermission);
    }

    trackByRecord(index: number, record: {[key: string]: any}): any {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        if (!tableDef || !tableDef.Keys || tableDef.Keys.length === 0) return index;
        return tableDef.Keys.map((key) => record[key.PascalName]).join('_');
    }

    /**
     * Shared row-dialog opener. Builds the dialog data and wires the result
     * straight into `handleUpdate()` (subclass-specific). Used by both
     * `addRecord()` (new row + empty `original`) and `editRecord()` (existing
     * row passed through verbatim).
     */
    private openRecordDialog(record: {[key: string]: any}, isNew: boolean): void {
        const dialogData = this.getDialogData(record, isNew);
        const apiName = this.apiName();
        if (apiName) dialogData['apiName'] = apiName;

        this.dialog.open(this.dialogComponent(), {
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
        if (Object.keys(record).length === 1 && this.records.length > 0) {
            Object.keys(this.records[0]).forEach((key) => { record[key] = ''; });
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
    editRecord(record: {[key: string]: any}) {
        if (!this.canUpdate() && !this.requireAuth(() => this.canRead(), 'view')) return;
        this.openRecordDialog(record, false);
    }

    deleteRecord(record: {[key: string]: any}) {
        if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
        this.handleDelete(record);
    }
}
