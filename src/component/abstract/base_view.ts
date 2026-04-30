import { Directive, inject, Input } from "@angular/core";
import { BaseTable } from "./base_table";
import { MatDialog } from "@angular/material/dialog";

@Directive()
export abstract class BaseView extends BaseTable {
    protected readonly dialog = inject(MatDialog);
    @Input() override tableName = '';
    @Input() apiName = '';
    @Input() dialogComponent: any;
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
        const tableDef = this.cacheService.getTableDefinition(this.tableName);
        if (!tableDef || !tableDef.Keys || tableDef.Keys.length === 0) return index;
        return tableDef.Keys.map((key) => record[key.PascalName]).join('_');
    }

    addRecord() {
        if (!this.canCreate()) {
            alert('Missing authorization to create records');
            return;
        }
        const record = this.emptyRecord();

        if (Object.keys(record).length === 1 && this.records.length > 0) {
            Object.keys(this.records[0]).forEach((key) => {
                record[key] = '';
            });
        }

        const dialogRef = this.dialog.open(this.dialogComponent, {
            width: '90vw',
            maxWidth: '1200px',
            maxHeight: '90vh',
            disableClose: true,
            data: this.getDialogData(record, true),
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) this.handleUpdate(result, true, {});
        });
    }

    editRecord(record: {[key: string]: any}) {
        if (!this.canUpdate()) {
            alert('Missing authorization to update records');
            return;
        }
        const dialogData = this.getDialogData(record, false);
        if (this.apiName) {
            dialogData['apiName'] = this.apiName;
        }
        const dialogRef = this.dialog.open(this.dialogComponent, {
            width: '90vw',
            maxWidth: '1200px',
            maxHeight: '90vh',
            disableClose: true,
            data: dialogData,
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result) this.handleUpdate(result, false, record);
        });
    }

    deleteRecord(record: {[key: string]: any}) {
        if (!this.canDelete()) {
            alert('Missing authorization to delete records');
            return;
        }
        this.handleDelete(record);
    }
}
