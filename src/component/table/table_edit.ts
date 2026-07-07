import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, OnInit, signal, ViewEncapsulation } from "@angular/core";
import { BaseForm } from "../abstract/base_form";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatTabsModule } from "@angular/material/tabs";
import { TableDetail } from "./table_detail";
import { RecordForm } from "../form/form_record";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { OpCode } from "../../model/common";

interface TableEditDialogData {
    record?: Record<string, unknown>;
    tableName?: string;
    apiName?: string;
    isNew?: boolean;
}

@Component({
    selector: 'sail-table-edit',
    templateUrl: './table_edit.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [
        RecordForm,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        TableDetail,
    ]
})
export class TableEdit extends BaseForm implements OnInit {
    readonly recordInput    = input<Record<string, unknown>>({}, { alias: 'record' });
    readonly tableNameInput = input('',      { alias: 'tableName' });
    readonly apiNameInput   = input('',      { alias: 'apiName' });

    readonly record              = linkedSignal<Record<string, unknown>, Record<string, unknown>>({ source: () => this.recordInput(), computation: (v, p) => v ?? p?.value ?? {} });
    override readonly tableName  = linkedSignal<string, string>({ source: () => this.tableNameInput(), computation: (v, p) => v || p?.value || '' });
    readonly apiName             = linkedSignal<string, string>({ source: () => this.apiNameInput(),   computation: (v, p) => v || p?.value || '' });

    readonly isReadOnlyMode = signal(true);
    readonly saveError = signal('');
    private readonly dialogRef = inject(MatDialogRef<TableEdit>, {optional: true});
    private readonly dialogData = inject<TableEditDialogData | null>(MAT_DIALOG_DATA, {optional: true});

    protected readonly tabFields = signal<string[]>([]);
    protected get isDialog(): boolean { return !!this.dialogRef; }
    /** Snapshot taken when the user enters edit mode; used for dirty-tracking on save. */
    private originalSnapshot: Record<string, unknown> | null = null;

    protected override readOnlyDeps(): void {
        super.readOnlyDeps();
        this.isReadOnlyMode();
    }

    ngOnInit(): void {
        if (this.dialogData) {
            this.record.set(this.dialogData.record ?? {});
            this.tableName.set(this.dialogData.tableName ?? '');
            this.apiName.set(this.dialogData.apiName ?? '');
            this.isNew.set(this.dialogData.isNew ?? false);
            this.isReadOnlyMode.set(!this.isNew());
        }
        if (this.isNew()) {
            this.initializeNewRecord();
            this.buildTabs();
        } else {
            this.fetchFullRecord();
        }
    }

    private initializeNewRecord() {
        const record = this.emptyRecord();
        Object.assign(record, this.record());
        this.editableRecord.set(record);
    }

    /**
     * Tabs are the table's child relations (rest_api_child metadata), not just
     * whatever array fields the backend happened to embed. Seed an empty array
     * for any child the response omitted so its grid renders (and accepts new rows).
     */
    private buildTabs() {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        const fields = (tableDef?.Children ?? []).map((child) => child.PascalName);
        const record = this.editableRecord();
        for (const field of fields) {
            if (!this.isArray(record[field])) record[field] = [];
        }
        this.tabFields.set(fields);
    }

    /** Child rows for a tab; buildTabs guarantees the array exists. */
    childRecords(key: string): Record<string, unknown>[] {
        const value = this.editableRecord()[key];
        return Array.isArray(value) ? value as Record<string, unknown>[] : [];
    }

    /** Re-fetch the row from the backend after a server-side mutation (TableAction success, etc.). */
    protected override onActionSuccess(): void {
        if (!this.isNew()) this.fetchFullRecord();
    }

    private fetchFullRecord() {
        const rec = this.record();
        const provisional = {...rec};
        this.formatRecordTimeStamp(provisional);
        this.editableRecord.set(provisional);

        const filter = this.getKeyFilters(rec);
        if (!filter) {
            console.warn('Key definition could not be found');
            return;
        }

        this.backendService.get<Record<string, unknown> | Record<string, unknown>[]>(this.apiName(), filter).subscribe({
            next: (record) => {
                if (!record) {
                    console.error('failed to read single record from the backend');
                    return;
                }
                const full = Array.isArray(record) ? record[0] : record;
                this.formatRecordTimeStamp(full);
                this.editableRecord.set(full);
                this.buildTabs();
            },
            error: (error) => {
                console.error('failed to fetch full record details', error);
                this.saveError.set('Failed to load record details.');
            },
        });
    }

    override isReadOnly(fieldName: string): boolean {
        if (this.isReadOnlyMode()) return true;
        return super.isReadOnly(fieldName);
    }

    onEdit() {
        this.isReadOnlyMode.set(false);
        this.isNew.set(false);
        // Snapshot scalar fields only; children arrays are dirty-tracked per row.
        this.originalSnapshot = { ...this.editableRecord() };
    }

    onNew() {
        this.isReadOnlyMode.set(false);
        this.isNew.set(true);
        this.originalSnapshot = null;
        this.editableRecord.set(this.emptyRecord());
        this.buildTabs();
    }

    onSave() {
        const wasNew = this.isNew();
        const result = {...this.editableRecord()};
        this.readyToSave(result, this.originalSnapshot);

        if (this.dialogRef) {
            this.dialogRef.close(result);
            return;
        }
        this.backendService.post(this.apiName(), result).subscribe({
            next: () => {
                this.saveError.set('');
                this.isReadOnlyMode.set(true);
                this.isNew.set(false);
                if (wasNew) {
                    // Sequence-keyed inserts have no client-side PK to refetch by;
                    // demote op_code so a second Save can't re-insert a duplicate.
                    const keys = this.getKeyFilters(result);
                    const keysComplete = !!keys && Object.values(keys).every((v) => v !== '');
                    if (keysComplete) {
                        this.record.set(result);
                        this.fetchFullRecord();
                    } else {
                        this.editableRecord.update((rec) => ({...rec, [this.config.opField]: OpCode.Readonly}));
                    }
                } else {
                    this.fetchFullRecord();
                }
            },
            error: (err) => {
                console.error('Save failed', err);
                this.saveError.set(err instanceof Error && err.message ? err.message : 'Save failed.');
            },
        });
    }

    onDelete() {
        if (confirm('Are you sure you want to delete this record?')) {
            const result = {...this.editableRecord()};
            result[this.config.opField] = OpCode.Delete;
            this.backendService.post(this.apiName(), result).subscribe({
                next: () => {
                    this.saveError.set('');
                    this.isReadOnlyMode.set(true);
                },
                error: (err) => {
                    console.error('Delete failed', err);
                    this.saveError.set(err instanceof Error && err.message ? err.message : 'Delete failed.');
                },
            });
        }
    }

    onCancel() {
        if (this.dialogRef) {
            this.dialogRef.close();
            return;
        }
        this.saveError.set('');
        this.isReadOnlyMode.set(true);
        this.isNew.set(false);
        // Refetch, not shallow-copy: the source row lacks the child-tab arrays.
        if (Object.keys(this.record()).length > 0) {
            this.fetchFullRecord();
        } else {
            this.editableRecord.set(this.emptyRecord());
            this.buildTabs();
        }
    }
}
