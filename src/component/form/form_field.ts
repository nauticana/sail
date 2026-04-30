import { ChangeDetectionStrategy, Component, inject, Input, input, output, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { BaseTable } from "../abstract/base_table";
import { ConstantValue } from "../../model/common";
import { TableLookup } from "../table/table_lookup";

@Component({
    selector: 'dynamic-field',
    templateUrl: './form_field.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        '[class.field-wide]': 'isTextArea',
        '[class.field-editable]': '!readonlyField()',
        '[class.field-readonly]': 'readonlyField()',
        '[style.max-width.px]': 'fieldMaxWidth',
    },
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
    ]
})
export class DynamicField extends BaseTable {
    // @Input() required — signal input not possible due to BaseTable inheritance chain
    @Input() override tableName = '';
    readonly value = input<any>(undefined);
    readonly valueChange = output<any>();
    readonly recordUpdate = output<{[key: string]: any}>();
    readonly field = input('');
    readonly label = input('');
    readonly readonlyField = input(false, {alias: 'readonly'});
    readonly subscriptSizing = input<'fixed' | 'dynamic'>('dynamic');
    readonly appearance = input<'fill' | 'outline'>('outline');

    private readonly dialog = inject(MatDialog);

    get col() {
        return this.getColumn(this.field());
    }

    get inputType() {
        if (!this.col || !this.col.InputType || this.col.LookupStyle === 'S') return 'text';
        return this.col.InputType;
    }

    get isTextArea(): boolean {
        if (!this.col) return false;
        return this.col.Size > 80;
    }

    get isDateLike(): boolean {
        if (!this.col) return false;
        return this.col.InputType === 'date'
            || this.col.InputType === 'datetime'
            || this.col.InputType === 'datetime-local';
    }

    /**
     * Max width (px) for the field, derived from column Size.
     * `null` = no cap (field fills its container — used for text areas / long fields).
     */
    get fieldMaxWidth(): number | null {
        if (this.isTextArea) return null;
        const size = this.col?.Size ?? 0;
        if (size === 0) return 240;
        if (size <= 10) return 180;
        if (size <= 30) return 260;
        if (size <= 80) return 400;
        return 520;
    }

    get textAreaRows(): number {
        if (!this.col) return 3;
        if (this.col.Size > 500) return 4;
        return 2;
    }

    isLookupTableSearch(): boolean {
        return !!(this.col && this.col.LookupTable && this.col.LookupStyle === 'S');
    }

    get maxLength() {
        if (!this.col) return 0;
        return this.col.Size;
    }

    get scale() {
        if (!this.col) return 0;
        return this.col.Scale;
    }

    get required() {
        if (!this.col) return false;
        return this.col.Required;
    }

    get options(): ConstantValue[] {
        if (!this.col) return [];
        return this.getOptions(this.field()) ?? [];
    }

    get step() {
        if (!this.col) return 0;
        return this.col.Step;
    }

    get displayCaption(): string {
        return this.displayValue(this.field(), this.value());
    }

    onInputChange(event: any) {
        if (event && event.target) this.valueChange.emit(event.target.value);
    }

    onSelectChange(event: any) {
        if (event) this.valueChange.emit(event.value);
    }

    onCheckboxChange(event: any) {
        if (event) this.valueChange.emit(event.checked);
    }

    updateForeignKeys(parentRecord: any) {
        if (!this.col || !this.col.LookupTable) return;
        const fk = this.getForeignKeyConfig(this.col.LookupTable);
        const updates: {[key: string]: any} = {};
        if (fk && fk.fk) {
            fk.fk.Columns.forEach((column, index) => {
                updates[column.PascalName] = parentRecord[fk.parent.Keys[index].PascalName];
            });
        }
        this.recordUpdate.emit(updates);
        this.valueChange.emit(updates[this.field()]);
    }

    openLookup() {
        if (!this.isLookupTableSearch()) return;
        const dialogRef = this.dialog.open(TableLookup, {
            width: this.dialogWidth,
            data: {tableName: this.col?.LookupTable},
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result) this.updateForeignKeys(result);
        });
    }
}
