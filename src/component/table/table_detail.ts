import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output, signal, ViewEncapsulation } from "@angular/core";
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
export class TableDetail extends BaseForm {
    readonly tableNameInput = input('', { alias: 'tableName' });
    readonly recordsInput   = input<Record<string, unknown>[]>([], { alias: 'records' });
    readonly parentTableName = input('');
    readonly parentRecord = input<Record<string, unknown>>({});
    /** When true, the parent view is in read-only mode — disable all child row editing. */
    readonly parentReadOnly = input(false);
    /** Fires after any grid mutation (add/edit/delete/undelete/cancel) so a parent
     *  can re-evaluate unsaved-changes state. Local only — no server call. */
    readonly changed = output<void>();

    override readonly tableName = linkedSignal<string, string>({ source: () => this.tableNameInput(), computation: (v, p) => v || p?.value || '' });

    // The parent owns the rows array (TableEdit saves it verbatim), so mutations
    // happen in place; recordsChanged versions them for the template.
    records: Record<string, unknown>[] = [];
    private readonly recordsChanged = signal(0);
    readonly visibleRecords = computed(() => {
        this.recordsChanged();
        return [...this.records];
    });

    readonly editingRecord = signal<Record<string, unknown> | null>(null);
    private originalRecord: Record<string, unknown> | null = null;

    readonly displayedColumns = computed(() => {
        this.cacheService.appDataVersion();
        this.visibleRecords();
        return this.getDisplayedColumns(this.records);
    });

    readonly fkColumns = computed(() => {
        this.cacheService.appDataVersion();
        const fkCfg = this.getForeignKeyConfig(this.parentTableName());
        return fkCfg?.fk?.Columns?.map((col) => col.PascalName) ?? [];
    });

    private readonly dialog = inject(MatDialog);

    constructor() {
        super();
        effect(() => {
            this.records = this.recordsInput() ?? [];
            this.recordsChanged.update((v) => v + 1);
        });
    }

    private bump() {
        this.recordsChanged.update((v) => v + 1);
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

    protected override readOnlyDeps(): void {
        super.readOnlyDeps();
        this.fkColumns();
        this.parentReadOnly();
    }

    override isReadOnly(fieldName: string): boolean {
        return (this.fkColumns().includes(fieldName) || super.isReadOnly(fieldName));
    }

    openEditDialog(record: Record<string, unknown>, isNew: boolean, readOnlyColumns: string[]) {
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
                this.bump();
                this.changed.emit();
            }
        });
    }

    /** Finish an in-progress inline edit before starting another (its values are
     * already in the row; leaving it un-finalized would drop them on save). */
    private finalizeInlineEdit() {
        if (this.editingRecord()) this.saveRow();
    }

    addRecord() {
        this.finalizeInlineEdit();
        const newRecord = this.emptyRecord();
        newRecord[this.config.opField] = OpCode.Insert;
        this.initializeForeignKeys(newRecord, this.parentTableName(), this.parentRecord());

        if (this.displayedColumns().length > 6) {
            this.openEditDialog(newRecord, true, this.fkColumns());
        } else {
            this.records.push(newRecord);
            this.isNew.set(true);
            this.originalRecord = null;
            this.editingRecord.set(newRecord);
            this.bump();
        }
    }

    editRow(record: Record<string, unknown>) {
        if (this.displayedColumns().length > 6) {
            this.openEditDialog(record, false, this.fkColumns());
        } else {
            this.finalizeInlineEdit();
            this.isNew.set(record[this.config.opField] === OpCode.Insert);
            this.originalRecord = {...record};
            this.formatRecordTimeStamp(record);
            this.editingRecord.set(record);
            this.bump();
        }
    }

    saveRow() {
        const editing = this.editingRecord();
        if (editing) this.readyToSave(editing, this.originalRecord);
        this.editingRecord.set(null);
        this.originalRecord = null;
        this.isNew.set(false);
        this.bump();
        this.changed.emit();
    }

    cancelRow(record: Record<string, unknown>) {
        if (this.originalRecord) {
            Object.assign(record, this.originalRecord);
        } else {
            const index = this.records.indexOf(record);
            if (index > -1) {
                this.records.splice(index, 1);
            }
        }
        this.editingRecord.set(null);
        this.originalRecord = null;
        this.isNew.set(false);
        this.bump();
        this.changed.emit();
    }

    deleteRow(record: Record<string, unknown>) {
        if (record[this.config.opField] === OpCode.Insert) {
            const index = this.records.indexOf(record);
            if (index > -1) {
                this.records.splice(index, 1);
            }
        } else {
            record[this.config.opField] = OpCode.Delete;
        }
        this.bump();
        this.changed.emit();
    }

    unDeleteRow(record: Record<string, unknown>) {
        if (record[this.config.opField] === OpCode.Delete) {
            record[this.config.opField] = OpCode.Update;
        }
        this.bump();
        this.changed.emit();
    }
}
