import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input, linkedSignal, OnInit, ViewEncapsulation } from "@angular/core";
import { BaseForm } from "../abstract/base_form";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatTabsModule } from "@angular/material/tabs";
import { TableDetail } from "./table_detail";
import { RecordForm } from "../form/form_record";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { OpCode } from "../../model/common";

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
    readonly recordInput    = input<any>({}, { alias: 'record' });
    readonly tableNameInput = input('',      { alias: 'tableName' });
    readonly apiNameInput   = input('',      { alias: 'apiName' });

    readonly record              = linkedSignal<any, any>({       source: () => this.recordInput(),    computation: (v, p) => v ?? p?.value ?? {} });
    override readonly tableName  = linkedSignal<string, string>({ source: () => this.tableNameInput(), computation: (v, p) => v || p?.value || '' });
    readonly apiName             = linkedSignal<string, string>({ source: () => this.apiNameInput(),   computation: (v, p) => v || p?.value || '' });

    isReadOnlyMode = true;
    private readonly dialogRef = inject(MatDialogRef<TableEdit>, {optional: true});
    private readonly dialogData = inject<{record?: any; tableName?: string; apiName?: string; isNew?: boolean} | null>(MAT_DIALOG_DATA, {optional: true});
    private readonly cdr = inject(ChangeDetectorRef);

    protected tabCount = 0;
    protected tabFields: string[] = [];
    protected get isDialog(): boolean { return !!this.dialogRef; }
    /** Snapshot taken when the user enters edit mode; used for dirty-tracking on save. */
    private originalSnapshot: any = null;

    ngOnInit(): void {
        if (this.dialogData) {
            this.record.set(this.dialogData.record ?? {});
            this.tableName.set(this.dialogData.tableName ?? '');
            this.apiName.set(this.dialogData.apiName ?? '');
            this.isNew = this.dialogData.isNew ?? false;
            this.isReadOnlyMode = !this.isNew;
        }
        if (this.isNew) {
            this.initializeNewRecord();
            this.buildTabs();
        } else {
            this.fetchFullRecord();
        }
    }

    private initializeNewRecord() {
        this.editableRecord = this.emptyRecord();
        const rec = this.record();
        if (rec) Object.assign(this.editableRecord, rec);
    }

    private buildTabs() {
        this.tabCount = 0;
        this.tabFields = [];
        for (const field of Object.keys(this.editableRecord)) {
            if (this.isArray(this.editableRecord[field])) {
                this.tabCount++;
                this.tabFields.push(field);
            }
        }
    }

    /** Re-fetch the row from the backend after a server-side mutation (TableAction success, etc.). */
    protected override onActionSuccess(): void {
        if (!this.isNew) this.fetchFullRecord();
    }

    private fetchFullRecord() {
        const rec = this.record();
        this.editableRecord = {...rec};
        this.formatRecordTimeStamp(this.editableRecord);

        const filter = this.getKeyFilters(rec);
        if (!filter) {
            console.warn('Key definition could not be found');
            return;
        }

        this.backendService.get<any>(this.apiName(), filter).subscribe({
            next: (record) => {
                if (!record) {
                    console.error('failed to read single record from the backend');
                    return;
                }
                this.editableRecord = Array.isArray(record) ? record[0] : record;
                this.formatRecordTimeStamp(this.editableRecord);
                this.buildTabs();
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('failed to fetch full record details', error);
            },
        });
    }

    override isReadOnly(fieldName: string): boolean {
        if (this.isReadOnlyMode) return true;
        return super.isReadOnly(fieldName);
    }

    onEdit() {
        this.isReadOnlyMode = false;
        this.isNew = false;
        this.isReadOnlyBound = this.isReadOnly.bind(this);
        // Snapshot scalar fields only; children arrays are dirty-tracked per row.
        this.originalSnapshot = { ...this.editableRecord };
    }

    onNew() {
        this.isReadOnlyMode = false;
        this.isNew = true;
        this.editableRecord = this.emptyRecord();
        this.isReadOnlyBound = this.isReadOnly.bind(this);
    }

    onSave() {
        const result = {...this.editableRecord};
        this.readyToSave(result, this.originalSnapshot);

        if (this.dialogRef) {
            this.dialogRef.close(result);
        } else {
            this.backendService.post(this.apiName(), result).subscribe({
                next: () => {
                    this.isReadOnlyMode = true;
                    this.isNew = false;
                    this.isReadOnlyBound = this.isReadOnly.bind(this);
                    this.cdr.markForCheck();
                },
                error: (err) => console.error('Save failed', err),
            });
        }
    }

    onDelete() {
        if (confirm('Are you sure you want to delete this record?')) {
            const result = {...this.editableRecord};
            result[this.config.opField] = OpCode.Delete;
            this.backendService.post(this.apiName(), result).subscribe({
                next: () => {
                    this.isReadOnlyMode = true;
                    this.isReadOnlyBound = this.isReadOnly.bind(this);
                    this.cdr.markForCheck();
                },
                error: (err) => console.error('Delete failed', err),
            });
        }
    }

    onCancel() {
        if (this.dialogRef) {
            this.dialogRef.close();
            return;
        }
        this.isReadOnlyMode = true;
        this.editableRecord = {...this.record()};
        this.isNew = false;
        this.isReadOnlyBound = this.isReadOnly.bind(this);
    }
}
