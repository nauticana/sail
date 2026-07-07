import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxChange, MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { BaseTable } from "../abstract/base_table";
import { ConstantValue, LookupStyle } from "../../model/common";
import { TableLookup } from "../table/table_lookup";

@Component({
    selector: 'sail-dynamic-field',
    templateUrl: './form_field.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        '[class.field-wide]': 'isTextArea',
        '[class.field-editable]': '!isReadonly',
        '[class.field-readonly]': 'isReadonly',
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
    readonly tableNameInput = input('', { alias: 'tableName' });
    readonly value = input<unknown>(undefined);
    readonly valueChange = output<unknown>();
    readonly recordUpdate = output<{[key: string]: unknown}>();
    readonly field = input('');
    readonly label = input('');
    readonly readonlyField = input(false, {alias: 'readonly'});
    readonly subscriptSizing = input<'fixed' | 'dynamic'>('dynamic');
    readonly appearance = input<'fill' | 'outline'>('outline');

    override readonly tableName = linkedSignal<string, string>({ source: () => this.tableNameInput(), computation: (v, p) => v || p?.value || '' });

    private readonly dialog = inject(MatDialog);

    get col() {
        return this.getColumn(this.field());
    }

    get inputType() {
        if (!this.col || !this.col.InputType || this.col.LookupStyle === LookupStyle.Search) return 'text';
        return this.col.InputType;
    }

    /** Read-only state for this field. The parent form computes it (keys,
     *  FK columns, and column_display_attribute modes R/I) and feeds it in. */
    get isReadonly(): boolean {
        return this.readonlyField();
    }

    get isTextArea(): boolean {
        if (!this.col) return false;
        // Explicit display_rows override wins; otherwise trust keel's InputType
        // (TEXT columns → 'textarea', VARCHAR → 'text') rather than guessing
        // from Size — a long VARCHAR is still a single-line field.
        if (this.col.DisplayRows) return this.col.DisplayRows > 1;
        return this.col.InputType === 'textarea';
    }

    get isDateLike(): boolean {
        if (!this.col) return false;
        return this.col.InputType === 'date'
            || this.col.InputType === 'time'
            || this.col.InputType === 'datetime'
            || this.col.InputType === 'datetime-local';
    }

    /**
     * Max width (px) for the field, derived from column Size.
     * `null` = no cap (field fills its container — used for text areas / long fields).
     */
    get fieldMaxWidth(): number | null {
        if (this.col?.DisplayWidth) return this.col.DisplayWidth;
        if (this.isTextArea) return null;
        const size = this.col?.Size ?? 0;
        if (size === 0) return 240;
        if (size <= 10) return 180;
        if (size <= 30) return 260;
        if (size <= 80) return 400;
        return 520;
    }

    get textAreaRows(): number {
        if (this.col?.DisplayRows) return this.col.DisplayRows;
        if (!this.col) return 3;
        if (this.col.Size > 500) return 4;
        return 2;
    }

    isLookupTableSearch(): boolean {
        return !!(this.col && this.col.LookupTable && this.col.LookupStyle === LookupStyle.Search);
    }

    /** null when metadata is missing/zero — [attr.maxLength] then omits the
     * attribute (maxlength="0" would block all typing). */
    get maxLength(): number | null {
        const size = this.col?.Size ?? 0;
        return size > 0 ? size : null;
    }

    /** Input-safe string form of the bound value. */
    get inputValue(): string {
        const v = this.value();
        return v === null || v === undefined ? '' : String(v);
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

    onInputChange(event: Event) {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
        if (target) this.valueChange.emit(this.coerce(target.value));
    }

    /** Numeric columns emit numbers, not the input's raw string. */
    private coerce(raw: string): unknown {
        if (raw !== '' && this.isNumber(this.field())) {
            const n = Number(raw);
            if (!isNaN(n)) return n;
        }
        return raw;
    }

    onSelectChange(event: MatSelectChange) {
        this.valueChange.emit(event.value);
    }

    onCheckboxChange(event: MatCheckboxChange) {
        this.valueChange.emit(event.checked);
    }

    updateForeignKeys(parentRecord: Record<string, unknown>) {
        if (!this.col || !this.col.LookupTable) return;
        const fk = this.getForeignKeyConfig(this.col.LookupTable);
        // No FK config → nothing to map; emitting would wipe the current value.
        if (!fk?.fk || fk.fk.Columns.length !== fk.parent.Keys.length) return;
        const updates: {[key: string]: unknown} = {};
        fk.fk.Columns.forEach((column, index) => {
            updates[column.PascalName] = parentRecord[fk.parent.Keys[index].PascalName];
        });
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
