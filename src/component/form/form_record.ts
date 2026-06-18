import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from "@angular/core";
import { DynamicField } from "./form_field";
import { BaseAuthService } from "../../service/auth.service";
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from "../../config";

@Component({
    selector: 'sail-record-form',
    templateUrl: './form_record.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [DynamicField],
})
export class RecordForm {
    private readonly auth = inject(BaseAuthService);
    private readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
    readonly record = input<{[key: string]: any}>({});
    readonly tableName = input('');
    readonly fields = input<string[]>([]);
    readonly isReadOnly = input<(key: string) => boolean>(() => false);

    private get hiddenFields(): Set<string> {
        const global = this.guiConfig.hiddenFields;
        const override = this.guiConfig.tableOverrides?.[this.tableName()]?.hiddenFields ?? [];
        return new Set([...global, ...override]);
    }

    readonly computedFields = computed(() => {
        const f = this.fields();
        const hidden = this.hiddenFields;
        if (f.length > 0) {
            return f.filter(key => !hidden.has(key));
        }
        const tableDef = this.auth.getTableDefinition(this.tableName());
        const recordKeys = new Set(Object.keys(this.record()));
        const editableTimestamps = new Set(
            this.guiConfig.tableOverrides?.[this.tableName()]?.editableTimestamps ?? []
        );
        if (tableDef && tableDef.Columns && tableDef.Columns.length > 0) {
            const record = this.record();
            return tableDef.Columns
                .filter(col => !(col.HasDefault && col.DataType === 'timestamp'
                                 && !editableTimestamps.has(col.PascalName)))
                // column_display_attribute: 'H' is never shown; 'S' (secret) is
                // also never shown and is stripped from reads server-side; 'R'/'U'
                // (read-only and keel-set audit stamp) show display-only but hide
                // when empty — so a new record's audit fields disappear and on edit
                // only populated ones show.
                .filter(col => col.DisplayMode !== 'H' && col.DisplayMode !== 'S')
                .filter(col => !((col.DisplayMode === 'R' || col.DisplayMode === 'U')
                                 && this.isEmpty(record[col.PascalName])))
                .sort((a, b) => a.Order - b.Order)
                .map(col => col.PascalName)
                .filter(key => !hidden.has(key) && recordKeys.has(key));
        }
        return [...recordKeys].filter(key => !hidden.has(key));
    });

    isArray(value: any): boolean {
        return Array.isArray(value);
    }

    private isEmpty(value: any): boolean {
        return value === null || value === undefined || value === '';
    }

    onRecordUpdate(updates: {[key: string]: any}) {
        Object.assign(this.record(), updates);
    }
}
