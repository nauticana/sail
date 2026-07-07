import { signal } from "@angular/core";
import { BaseTable } from "./base_table";

export abstract class BaseForm extends BaseTable {
    readonly editableRecord = signal<{[key: string]: unknown}>({});
    readonly isNew = signal(false);
    readonly title = signal('');

    protected override readOnlyDeps(): void {
        super.readOnlyDeps();
        this.isNew();
    }

    override isReadOnly(fieldName: string): boolean {
        // keel column_display_attribute: 'R' is always display-only; 'I'
        // (insert-only) is editable while creating, locked once it exists.
        const mode = this.getColumn(fieldName)?.DisplayMode;
        if (mode === 'R' || mode === 'U') return true; // 'U' = keel-set audit stamp
        if (mode === 'I') return !this.isNew();
        return !this.isNew() && this.isKey(fieldName);
    }
}
