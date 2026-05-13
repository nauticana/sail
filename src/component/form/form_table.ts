import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { BaseForm } from "../abstract/base_form";
import { RecordForm } from "./form_record";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

interface TableFormDialogData {
    record: {[key: string]: any};
    tableName: string;
    isNew?: boolean;
    readOnlyColumns?: string[];
    attributeName?: string;
}

@Component({
    selector: 'table-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './form_table.html',
    imports: [
        MatButtonModule,
        MatDialogActions,
        MatDialogContent,
        MatDialogTitle,
        MatIconModule,
        RecordForm,
    ]
})
export class TableForm extends BaseForm {
    dialogRef = inject(MatDialogRef<TableForm>);
    data = inject<TableFormDialogData>(MAT_DIALOG_DATA);

    readOnlyColumns: string[] = [];

    constructor() {
        super();
        this.editableRecord = {...this.data.record};
        this.tableName.set(this.data.tableName);
        this.isNew = !!this.data.isNew;
        this.readOnlyColumns = this.data.readOnlyColumns ?? [];
    }

    override isReadOnly(fieldName: string): boolean {
        if (this.readOnlyColumns.includes(fieldName)) return true;
        return super.isReadOnly(fieldName);
    }

    onSave(): void {
        const result = {...this.editableRecord};
        this.readyToSave(result);
        this.dialogRef.close(result);
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
