import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, ViewEncapsulation } from "@angular/core";
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
    readonly record = input<{[key: string]: unknown}>({});
    readonly tableName = input('');
    readonly fields = input<string[]>([]);
    readonly isReadOnly = input<(key: string) => boolean>(() => false);
    /** Full updated record on every field edit. The input object is never mutated. */
    readonly recordChange = output<{[key: string]: unknown}>();

    /** Local working copy — resets whenever the parent binds a new record object. */
    readonly working = linkedSignal(() => ({...this.record()}));

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
        const record = this.working();
        const recordKeys = new Set(Object.keys(record));
        const editableTimestamps = new Set(
            this.guiConfig.tableOverrides?.[this.tableName()]?.editableTimestamps ?? []
        );
        if (tableDef && tableDef.Columns && tableDef.Columns.length > 0) {
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

    isArray(value: unknown): boolean {
        return Array.isArray(value);
    }

    private isEmpty(value: unknown): boolean {
        return value === null || value === undefined || value === '';
    }

    onFieldChange(key: string, value: unknown) {
        this.applyUpdates({[key]: value});
    }

    onRecordUpdate(updates: {[key: string]: unknown}) {
        this.applyUpdates(updates);
    }

    private applyUpdates(updates: {[key: string]: unknown}) {
        const updated = {...this.working(), ...updates};
        this.working.set(updated);
        this.recordChange.emit(updated);
    }
}
