import { ChangeDetectionStrategy, Component, effect, inject, input, OnInit, ViewEncapsulation } from "@angular/core";
import { DynamicField } from "../form/form_field";
import { MatButtonModule } from "@angular/material/button";
import { BaseForm } from "../abstract/base_form";
import { MatDialog } from "@angular/material/dialog";
import { TableForm } from "../form/form_table";
import { MatIconModule } from "@angular/material/icon";
import { BackendService } from "../../service/rest_service";
import { TableAction } from "../../model/appdata";

@Component({
    selector: 'table-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './table_detail.html',
    imports: [
        DynamicField,
        MatButtonModule,
        MatIconModule,
    ],
})
export class TableDetail extends BaseForm implements OnInit {
    readonly tableNameInput = input('', { alias: 'tableName' });
    readonly recordsInput = input<any[]>([], { alias: 'records' });
    readonly parentTableName = input('');
    readonly parentRecord = input<any>({});
    /** When true, the parent view is in read-only mode — disable all child row editing. */
    readonly parentReadOnly = input(false);

    records: any[] = [];
    editingRecord: any = null;
    originalRecord: any = null;
    displayedColumns: string[] = [];
    fkColumns: string[] = [];

    private readonly dialog = inject(MatDialog);
    private readonly backendService = inject(BackendService);

    constructor() {
        super();
        effect(() => { const v = this.tableNameInput(); if (v) this.tableName.set(v); });
        effect(() => { this.records = this.recordsInput(); });
    }

    /**
     * Fire a TableAction. Per-row actions require the record to be
     * server-side (not 'I' inserted-locally-not-saved); table-level
     * actions only need the parent to be writable. Action POSTs hit
     * the resolved URL directly — no need to round-trip through the
     * parent form.
     */
    executeAction(action: TableAction, record?: {[key: string]: unknown}): void {
        if (!this.canExecuteAction(action)) {
            alert(`Missing authorization for action ${action.authorityObject}/${action.authorityCheck}`);
            return;
        }
        if (action.recordSpecific && record && record[this.config.opField] === 'I') {
            alert('Save the record first before running this action.');
            return;
        }
        if (action.confirmMessage && !confirm(action.confirmMessage)) return;
        const body = action.recordSpecific && record ? this.primaryKeyValues(record) : {};
        this.backendService.executeAction(action.method, body).subscribe({
            next: () => {/* parent form re-fetches on its own save */},
            error: (err) => {
                console.error(`Action ${action.action} failed`, err);
                alert(err?.error?.detail ?? `Failed to ${action.caption}`);
            },
        });
    }

    override canCreate() { return !this.parentReadOnly() && super.canCreate(); }
    override canUpdate() { return !this.parentReadOnly() && super.canUpdate(); }
    override canDelete() { return !this.parentReadOnly() && super.canDelete(); }

    ngOnInit(): void {
        this.displayedColumns = this.getDisplayedColumns(this.records);
        const fkCfg = this.getForeignKeyConfig(this.parentTableName());
        if (fkCfg && fkCfg.fk && fkCfg.fk.Columns) {
            for (const col of fkCfg.fk.Columns) {
                this.fkColumns.push(col.PascalName);
            }
        }
    }

    override isReadOnly(fieldName: string): boolean {
        return (this.fkColumns.includes(fieldName) || super.isReadOnly(fieldName));
    }

    openEditDialog(record: any, isNew: boolean, readOnlyColumns: string[]) {
        const dialogRef = this.dialog.open(TableForm, {
            width: this.dialogWidth,
            disableClose: true,
            data: this.getDialogData(record, isNew, readOnlyColumns),
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                if (isNew) {
                    this.records.push(result);
                } else {
                    Object.assign(record, result);
                }
            }
        });
    }

    addRecord() {
        const newRecord = this.emptyRecord();
        newRecord[this.config.opField] = 'I';
        this.initializeForeignKeys(newRecord, this.parentTableName(), this.parentRecord());

        if (this.displayedColumns.length > 6) {
            this.openEditDialog(newRecord, true, this.fkColumns);
        } else {
            this.records.push(newRecord);
            this.isNew = true;
            this.originalRecord = null;
            this.editingRecord = newRecord;
        }
    }

    editRow(record: any) {
        if (this.displayedColumns.length > 6) {
            this.openEditDialog(record, false, this.fkColumns);
        } else {
            this.editingRecord = record;
            this.isNew = record[this.config.opField] === 'I';
            this.originalRecord = {...record};
            this.formatRecordTimeStamp(record);
        }
    }

    saveRow() {
        this.readyToSave(this.editingRecord);
        this.editingRecord = null;
        this.originalRecord = null;
        this.isNew = false;
    }

    cancelRow(record: any) {
        if (this.originalRecord) {
            Object.assign(record, this.originalRecord);
        } else {
            const index = this.records.indexOf(record);
            if (index > -1) {
                this.records.splice(index, 1);
            }
        }
        this.editingRecord = null;
        this.originalRecord = null;
        this.isNew = false;
    }

    deleteRow(record: any) {
        if (record[this.config.opField] === 'I') {
            const index = this.records.indexOf(record);
            if (index > -1) {
                this.records.splice(index, 1);
            }
        } else {
            record[this.config.opField] = 'D';
        }
    }

    unDeleteRow(record: any) {
        if (record[this.config.opField] === 'D') {
            record[this.config.opField] = 'U';
        }
    }
}
