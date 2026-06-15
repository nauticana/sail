import { ChangeDetectionStrategy, Component, effect, inject, input, linkedSignal, OnInit, output, ViewEncapsulation } from "@angular/core";
import { DynamicField } from "../form/form_field";
import { MatButtonModule } from "@angular/material/button";
import { BaseForm } from "../abstract/base_form";
import { MatDialog } from "@angular/material/dialog";
import { TableForm } from "../form/form_table";
import { MatIconModule } from "@angular/material/icon";
import { TableAction } from "../../model/appdata";
import { OpCode } from "../../model/common";

@Component({
    selector: 'sail-table-detail',
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
    readonly recordsInput   = input<any[]>([], { alias: 'records' });
    readonly parentTableName = input('');
    readonly parentRecord = input<any>({});
    /** When true, the parent view is in read-only mode — disable all child row editing. */
    readonly parentReadOnly = input(false);
    /** Fires after any grid mutation (add/edit/delete/undelete/cancel) so a parent
     *  can re-evaluate unsaved-changes state. Local only — no server call. */
    readonly changed = output<void>();

    override readonly tableName = linkedSignal<string, string>({ source: () => this.tableNameInput(), computation: (v, p) => v || p?.value || '' });

    records: any[] = [];
    editingRecord: any = null;
    originalRecord: any = null;
    displayedColumns: string[] = [];
    fkColumns: string[] = [];

    private readonly dialog = inject(MatDialog);

    constructor() {
        super();
        // records is a writable array (push/splice in event handlers); keep it in sync with the input
        // via effect rather than linkedSignal so mutations work on the consumer's array reference.
        effect(() => { this.records = this.recordsInput(); });
    }

    /**
     * Per-row actions require the record to be server-side (not 'I'
     * inserted-locally-not-saved); the keel action POST would hit a record
     * that doesn't exist yet. Table-level actions are always allowed.
     */
    protected override beforeExecuteAction(action: TableAction, record?: Record<string, unknown>): boolean {
        if (action.recordSpecific && record && record[this.config.opField] === OpCode.Insert) {
            alert('Save the record first before running this action.');
            return false;
        }
        return true;
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
                this.changed.emit();
            }
        });
    }

    addRecord() {
        const newRecord = this.emptyRecord();
        newRecord[this.config.opField] = OpCode.Insert;
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
            this.isNew = record[this.config.opField] === OpCode.Insert;
            this.originalRecord = {...record};
            this.formatRecordTimeStamp(record);
        }
    }

    saveRow() {
        this.readyToSave(this.editingRecord);
        this.editingRecord = null;
        this.originalRecord = null;
        this.isNew = false;
        this.changed.emit();
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
        this.changed.emit();
    }

    deleteRow(record: any) {
        if (record[this.config.opField] === OpCode.Insert) {
            const index = this.records.indexOf(record);
            if (index > -1) {
                this.records.splice(index, 1);
            }
        } else {
            record[this.config.opField] = OpCode.Delete;
        }
        this.changed.emit();
    }

    unDeleteRow(record: any) {
        if (record[this.config.opField] === OpCode.Delete) {
            record[this.config.opField] = OpCode.Update;
        }
        this.changed.emit();
    }
}
