import { computed, inject, Injector, Signal, WritableSignal } from "@angular/core";
import { ForeignKey, TableAction, TableColumn, TableDefinition } from "../../model/appdata";
import { ConstantValue, LookupStyle, OpCode } from "../../model/common";
import { BaseAuthService } from "../../service/auth.service";
import { BackendService } from "../../service/rest_service";
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from "../../config";
import { titleCase } from "../../util/text";
import { MatDialog } from "@angular/material/dialog";
import { RevealDialog } from "../table/reveal_dialog";


/** CRUD verb used by `requireAuth()` to compose the "Missing authorization" alert. */
export type AuthVerb = 'create' | 'read' | 'update' | 'delete' | 'view';

/** ISO-like timestamp prefix — gate for comparing two strings as instants. */
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T/;


export abstract class BaseTable {
    protected readonly cacheService = inject(BaseAuthService);
    protected readonly backendService = inject(BackendService);
    // Reveal dialogs are rare — resolve MatDialog lazily so every BaseTable subclass doesn't eagerly depend on it.
    readonly #injector = inject(Injector);
    protected readonly config: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
    protected readonly dialogWidth: string = '400px';
    /** Subclasses supply the source — a plain signal or a linkedSignal over an input. */
    abstract readonly tableName: WritableSignal<string>;
    /** Optional consumer-set override; when empty the title-cased table name is used. */
    caption = '';
    /** Consumer-set per-field option overrides (per fieldName). When unset, options come from the column's LookupDomain / LookupTable. */
    fieldOptions: {[key: string]: ConstantValue[]} = {};

    isReadOnly(_fieldName: string): boolean {
        return false;
    }

    /** Function-input for `[isReadOnly]`; new closure identity whenever
     * `readOnlyDeps()` signals change, so OnPush children re-render on mode flips. */
    readonly isReadOnlyFn: Signal<(fieldName: string) => boolean> = computed(() => {
        this.readOnlyDeps();
        return (fieldName: string) => this.isReadOnly(fieldName);
    });

    /** Read every signal your `isReadOnly()` override depends on. */
    protected readOnlyDeps(): void {
        this.cacheService.appDataVersion();
        this.tableName();
    }

    /** Re-exported on the class so templates can call `titleCase(x)` without an extra import in the consumer. */
    titleCase(str: string): string { return titleCase(str); }

    /** Display title for the active table; recomputes when `tableName` changes. */
    getCaption(): string {
        return this.caption || titleCase(this.tableName());
    }

    /** Display label for a column; uses the metadata Caption, otherwise title-cases the field name. */
    colCaption(fieldName: string): string {
        const col = this.getColumn(fieldName);
        return col?.Caption || titleCase(fieldName);
    }

    canRead()   { return this.cacheService.canRead(this.tableName()); }
    canCreate() { return this.cacheService.canCreate(this.tableName()); }
    canUpdate() { return this.cacheService.canUpdate(this.tableName()); }
    canDelete() { return this.cacheService.canDelete(this.tableName()); }

    /** True when the record is a locally-inserted row not yet persisted (op_code === 'I'). */
    isInserted(record: Record<string, unknown>): boolean { return record[this.config.opField] === OpCode.Insert; }
    /** True when the record is marked for update (op_code === 'U'). */
    isUpdated(record: Record<string, unknown>):  boolean { return record[this.config.opField] === OpCode.Update; }
    /** True when the record is marked for delete (op_code === 'D'). */
    isDeleted(record: Record<string, unknown>):  boolean { return record[this.config.opField] === OpCode.Delete; }

    /**
     * Authorization guard with shared "Missing authorization" copy. Pass the
     * permission predicate (typically a `canX()` method on this class) and
     * the verb that fills the alert. Returns true when allowed.
     *
     *   if (!this.requireAuth(() => this.canDelete(), 'delete')) return;
     */
    protected requireAuth(check: () => boolean, verb: AuthVerb): boolean {
        if (check()) return true;
        alert(`Missing authorization to ${verb} records`);
        return false;
    }

    /**
     * The table's registered TableAction list (basis `table_action` rows).
     * Templates use the memoized `tableActions` / `recordActions` instead.
     */
    getActions(recordSpecific?: boolean): TableAction[] {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        const actions = tableDef?.Actions ?? [];
        if (recordSpecific === undefined) return [...actions].sort(this.sortActions);
        return actions.filter((a) => a.recordSpecific === recordSpecific).sort(this.sortActions);
    }

    /** Table-level actions (toolbar buttons), memoized for templates. */
    readonly tableActions = computed(() => {
        this.cacheService.appDataVersion();
        return this.getActions(false);
    });

    /** Record-specific actions (per-row buttons), memoized for templates. */
    readonly recordActions = computed(() => {
        this.cacheService.appDataVersion();
        return this.getActions(true);
    });

    private sortActions = (a: TableAction, b: TableAction) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0);

    /**
     * Authorization gate for a TableAction. Mirrors canRead/canCreate
     * etc. — looks up the caller's grant against (authorityObject,
     * authorityCheck) scoped to the table name. Returns true when the
     * action button should render.
     */
    canExecuteAction(action: TableAction): boolean {
        return this.cacheService.canExecute(action.authorityObject, action.authorityCheck, this.tableName());
    }

    /**
     * Fire a TableAction. Template method:
     *
     *   1. Authorization check + alert  (shared)
     *   2. Subclass-specific pre-flight guard via `beforeExecuteAction()` —
     *      returns false to abort silently (the hook has already shown its
     *      own alert).
     *   3. Optional confirm prompt from `action.confirmMessage`
     *   4. POST `{}` for table-level actions or `primaryKeyValues(record)`
     *      for record-specific actions
     *   5. On success, dispatch `onActionSuccess()` so subclasses can refresh
     *      their views; on error, log and alert.
     *
     * Subclasses typically only override the two hooks.
     */
    executeAction(action: TableAction, record?: Record<string, unknown>): void {
        if (!this.canExecuteAction(action)) {
            alert(`Missing authorization for action ${action.authorityObject}/${action.authorityCheck}`);
            return;
        }
        if (!this.beforeExecuteAction(action, record)) return;
        if (action.confirmMessage && !confirm(action.confirmMessage)) return;
        const body = action.recordSpecific && record ? this.primaryKeyValues(record) : {};
        this.backendService.executeAction<Record<string, unknown>>(action.method, body).subscribe({
            next: (resp) => {
                const url = resp?.['url'];
                // R = redirect: POST then follow the returned {url} (hosted checkout / portal).
                if (action.kind === 'R' && typeof url === 'string') {
                    window.location.href = url;
                    return;
                }
                // V = reveal: show the returned secret once (e.g. a freshly minted key).
                if (action.kind === 'V') {
                    this.#injector.get(MatDialog).open(RevealDialog, { data: resp ?? {}, width: '480px' });
                }
                this.onActionSuccess(action, record);
            },
            error: (err) => {
                console.error(`Action ${action.action} failed`, err);
                alert(err?.problem?.detail ?? err?.error?.detail ?? `Failed to ${action.caption}`);
            },
        });
    }

    /**
     * Pre-flight hook for `executeAction()`. Return false to abort the action
     * (the override should `alert()` or otherwise surface why). Default: allow.
     */
    protected beforeExecuteAction(_action: TableAction, _record?: Record<string, unknown>): boolean {
        return true;
    }

    /**
     * Post-success hook for `executeAction()`. Override to refresh the screen
     * — e.g. `TableList` re-fetches the row list. Default: no-op (screens
     * driven by parent state, like `TableDetail`, leave refresh to the parent).
     */
    protected onActionSuccess(_action: TableAction, _record?: Record<string, unknown>): void {
        // intentionally empty
    }

    /**
     * Pulls the primary-key column values off a record into a plain
     * object keyed by the columns' PascalName. Used as the request
     * body when a record-specific TableAction fires — the backend
     * handler receives the row's PK exactly the way generic CRUD
     * does for get / delete.
     */
    primaryKeyValues(record: Record<string, unknown>): Record<string, unknown> {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        const pk: Record<string, unknown> = {};
        if (!tableDef?.Keys) return pk;
        for (const key of tableDef.Keys) {
            pk[key.PascalName] = record[key.PascalName];
        }
        return pk;
    }

    /** @for track key: joined PK values; index when keys are missing/unset. */
    trackByRecord(index: number, record: Record<string, unknown>): string | number {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        if (!tableDef?.Keys?.length) return index;
        const values = tableDef.Keys.map((key) => record[key.PascalName]);
        if (values.some((v) => v === undefined || v === null || v === '')) return index;
        return values.join('_');
    }

    /** DefaultValue as a typed literal; undefined for expression defaults (`now()`, `nextval(...)`). */
    private literalDefault(field: TableColumn): unknown {
        const dv = field.DefaultValue;
        if (field.DataType === 'boolean') return dv === 'true';
        if (dv == null || dv === '' || dv.includes('(')) return undefined;
        if (field.DataType === 'integer' || field.DataType === 'float') {
            const n = Number(dv);
            return isNaN(n) ? undefined : n;
        }
        return dv;
    }

    emptyRecord(): Record<string, unknown> {
        const record: Record<string, unknown> = {[this.config.opField]: OpCode.Insert};
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        const tableOverride = this.config.tableOverrides?.[this.tableName()];
        const editableTimestamps = new Set(tableOverride?.editableTimestamps ?? []);

        if (tableDef) {
            if (tableDef.Columns) {
                tableDef.Columns.forEach((field) => {
                    if (field.SequenceName) {
                        return; // auto-generated by database sequence
                    }
                    // column_display_attribute modes (explicit, win over the
                    // timestamp heuristic). H/S/R/U are server-managed — omit so the
                    // DB default/keel stamp fills them. D = seed the column default.
                    if (field.DisplayMode === 'H' || field.DisplayMode === 'S'
                        || field.DisplayMode === 'R' || field.DisplayMode === 'U') {
                        return;
                    }
                    if (field.DisplayMode === 'D') {
                        record[field.PascalName] = this.literalDefault(field)
                            ?? (field.DataType === 'boolean' ? false : '');
                        return;
                    }
                    if (!field.DisplayMode && field.HasDefault && field.DataType === 'timestamp'
                        && !editableTimestamps.has(field.PascalName)) {
                        return; // audit column — server-managed, don't include
                    }
                    if (field.HasDefault && field.DataType !== 'timestamp') {
                        const dv = this.literalDefault(field);
                        record[field.PascalName] = dv !== undefined ? dv
                            : (field.DataType === 'boolean' ? false : '');
                    } else {
                        record[field.PascalName] = field.DataType === 'boolean' ? false : '';
                    }
                });
            }
            if (tableDef.Children) {
                tableDef.Children.forEach((child) => {
                    record[child.PascalName] = [];
                });
            }
            // Apply per-table default values from SailGuiConfig.tableOverrides (overrides DB defaults).
            // Values may be literals or zero-arg functions (evaluated now).
            const overrideDefaults = tableOverride?.defaultValues;
            if (overrideDefaults) {
                for (const [key, value] of Object.entries(overrideDefaults)) {
                    record[key] = typeof value === 'function' ? (value as () => unknown)() : value;
                }
            }
        }
        return record;
    }

    getDisplayedColumns(records: Record<string, unknown>[] = []): string[] {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        const tableOverride = this.config.tableOverrides?.[this.tableName()];
        const hidden = new Set([
            ...this.config.hiddenFields,
            ...(tableOverride?.hiddenFields ?? []),
        ]);
        const editableTimestamps = new Set(tableOverride?.editableTimestamps ?? []);
        if (tableDef && tableDef.Columns && tableDef.Columns.length > 0) {
            return tableDef.Columns
                // column_display_attribute: 'H' hidden and 'S' secret never render.
                .filter(col => col.DisplayMode !== 'H' && col.DisplayMode !== 'S')
                .filter(col => !(col.HasDefault && col.DataType === 'timestamp'
                                 && !editableTimestamps.has(col.PascalName)))
                .sort((a, b) => a.Order - b.Order)
                .map((field) => field.PascalName)
                .filter(name => !hidden.has(name));
        } else if (records.length > 0) {
            return Object.keys(records[0]).filter(name => !hidden.has(name));
        }
        return [];
    }

    getColumn(fieldName: string): TableColumn | undefined {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        if (tableDef && tableDef.Columns) {
            return tableDef.Columns.find((field) => field.PascalName === fieldName);
        }
        return undefined;
    }

    displayValue(fieldName: string, rawValue: unknown): string {
        if (rawValue === null || rawValue === undefined || rawValue === '') return '';
        const col = this.getColumn(fieldName);
        if (!col) return String(rawValue);
        if (col.LookupDomain) {
            const options = this.cacheService.getDomainValues(col.LookupDomain);
            const match = options?.find(o => o.Value === String(rawValue));
            if (match) return match.Caption ?? String(rawValue);
        }
        if (col.LookupTable && col.LookupStyle === LookupStyle.Dropdown) {
            const options = this.cacheService.getTableValues(col.LookupTable);
            const match = options?.find(o => o.Value === String(rawValue));
            if (match) return match.Caption ?? String(rawValue);
        }
        return String(rawValue);
    }

    /**
     * Temporal input kind for a field, or null if not temporal (metadata-driven
     * only — name-based guessing would corrupt text fields ending in "Time").
     */
    temporalKind(fieldName: string): 'time' | 'date' | 'datetime-local' | null {
        const col = this.getColumn(fieldName)
        if (!col) return null
        if (col.InputType === 'time') return 'time'
        if (col.InputType === 'date') return 'date'
        if (col.InputType === 'datetime-local') return 'datetime-local'
        // Fallback for column metadata predating keel's time/date split.
        if (col.DataType === 'timestamp') return 'datetime-local'
        return null
    }

    isTimeStamp(fieldName: string): boolean {
        return this.temporalKind(fieldName) !== null
    }

    isNumber(fieldName: string): boolean {
        const col = this.getColumn(fieldName)
        if (col) {
            return col.DataType === 'integer' || col.DataType === 'float';
        }
        return false;
    }

    isBoolean(fieldName: string): boolean {
        const col = this.getColumn(fieldName)
        if (col) {
            return col.DataType === 'boolean' || col.LookupDomain === 'BOOLEAN';
        }
        return false;
    }

    isKey(fieldName: string): boolean {
        const col = this.getColumn(fieldName)
        if (col) {
            return (col.IsKey);
        }
        return false;
    }

    isArray(value: unknown): boolean {
        return Array.isArray(value);
    }

    /** Backend value → form-input value. datetime-local inputs hold LOCAL wall-clock
     * time while keel timestamps are UTC ISO, so convert (don't slice). */
    formatTimeStamp(val: string, kind: 'time' | 'date' | 'datetime-local' = 'datetime-local'): string {
        if (val && typeof val === 'string') {
            if (kind === 'time') return val.slice(0, 5);    // HH:MM
            if (kind === 'date') return val.slice(0, 10);   // YYYY-MM-DD
            // Bare timestamps (no zone) from pre-ISO backends are treated as UTC.
            const iso = (val.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(val)) ? val : val + 'Z';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return val.slice(0, 16);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        return val;
    }

    formatRecordTimeStamp(record: Record<string, unknown>) {
        if (record) {
            for (const key of Object.keys(record)) {
                const kind = this.temporalKind(key);
                if (kind) {
                    record[key] = this.formatTimeStamp(record[key] as string, kind);
                }
            }
        }
    }

    /** Form-input value → backend wire value (local wall-clock → UTC ISO for datetime-local). */
    restoreTimeStamp(val: unknown, kind: 'time' | 'date' | 'datetime-local' = 'datetime-local'): unknown {
        // PostgreSQL can't cast '' to a temporal type — normalize empty to null.
        if (val === '' || val === undefined || val === null) return null;
        // TIME/DATE values are sent verbatim ('08:45', '2026-06-15').
        if (kind === 'time' || kind === 'date') return val;
        if (typeof val === 'string' && !val.endsWith('Z')) {
            const d = new Date(val); // no zone designator → parsed as LOCAL time
            if (isNaN(d.getTime())) return val;
            return d.toISOString();
        }
        return val;
    }

    restoreRecordTimeStamp(record: Record<string, unknown>) {
        if (record) {
            for (const key of Object.keys(record)) {
                const kind = this.temporalKind(key);
                if (kind) {
                    record[key] = this.restoreTimeStamp(record[key], kind);
                }
            }
        }
    }

    readyToSave(record: Record<string, unknown>, original?: Record<string, unknown> | null) {
        this.restoreRecordTimeStamp(record);
        const op = record[this.config.opField];
        if (op === OpCode.Insert || op === OpCode.Delete) return; // already marked
        // Original snapshot may carry display-formatted timestamps; restore both
        // sides to the same wire format before comparing, otherwise scalar
        // fields like Passdate look "modified" purely due to formatting.
        if (original) {
            const normalized = { ...original };
            this.restoreRecordTimeStamp(normalized);
            if (!this.isRecordDirty(record, normalized)) {
                record[this.config.opField] = OpCode.Readonly;
                return;
            }
        }
        record[this.config.opField] = OpCode.Update;
    }

    /** Equality tolerant of form coercion: number-vs-string by text, ISO timestamps by instant. */
    private valuesEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (a == null || b == null) return false; // one side set, the other not
        if (typeof a === 'number' || typeof b === 'number') return String(a) === String(b);
        if (typeof a === 'string' && typeof b === 'string'
            && ISO_PREFIX.test(a) && ISO_PREFIX.test(b)) {
            const ta = Date.parse(a), tb = Date.parse(b);
            if (!isNaN(ta) && !isNaN(tb)) return ta === tb;
        }
        return false;
    }

    /** Shallow compare of scalar fields over the union of keys; child arrays and op_code ignored. */
    isRecordDirty(current: Record<string, unknown>, original: Record<string, unknown>): boolean {
        const opField = this.config.opField;
        const keys = new Set([...Object.keys(current), ...Object.keys(original)]);
        for (const key of keys) {
            if (key === opField) continue;
            // Ignore child-relation arrays; those have their own op_code per row.
            if (Array.isArray(current[key]) || Array.isArray(original[key])) continue;
            if (!this.valuesEqual(current[key], original[key])) return true;
        }
        return false;
    }

    getDialogData(record: Record<string, unknown>, isNew: boolean, readOnlyColumns: string[] = []): Record<string, unknown> {
        return {record, tableName: this.tableName(), isNew, readOnlyColumns};
    }

    getTableName(fieldName: string): string {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        if (!tableDef) return '';
        const fk = tableDef.Children?.find((c) => c.PascalName === fieldName);
        return fk ? fk.ChildTable : '';
    }

    getOptions(fieldName: string): ConstantValue[] | undefined {
        if (this.fieldOptions[fieldName]) {
            return this.fieldOptions[fieldName];
        }
        const col = this.getColumn(fieldName)
        if (col && col.LookupDomain) {
            return this.cacheService.getDomainValues(col.LookupDomain);
        }
        if (col && col.LookupTable && col.LookupStyle === LookupStyle.Dropdown) {
            return this.cacheService.getTableValues(col.LookupTable);
        }
        return undefined;
    }

    getKeyFilters(record: Record<string, unknown>): {[key: string]: string} | undefined {
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        if (!tableDef || !tableDef.Keys || tableDef.Keys.length === 0) {
            return undefined;
        }
        const filters: {[key: string]: string} = {};
        for (const key of tableDef.Keys) {
            filters[key.PascalName] = String(record[key.PascalName] ?? '');
        }
        return filters;
    }

    getForeignKeyConfig(parentTable: string): {fk: ForeignKey, parent: TableDefinition} | null{
        if (!parentTable) return null;
        const tableDef = this.cacheService.getTableDefinition(this.tableName());
        const parent = this.cacheService.getTableDefinition(parentTable);
        if (!tableDef || !tableDef.Keys || !tableDef.Parents || !parent) return null;
        const fk = tableDef.Parents.find((parent) => parent.ParentTable === parentTable);
        if (!fk) return null;
        return {'fk': fk, 'parent': parent};
    }

    /** Seed FK columns from the parent's keys; returns the seeded (read-only) column names. */
    initializeForeignKeys(record: Record<string, unknown>, parentTable: string, parentRecord: Record<string, unknown>): string[] {
        const readOnlyColumns: string[] = [];
        const fkData = this.getForeignKeyConfig(parentTable);
        if (fkData && fkData.fk && fkData.parent) {
            if (fkData.fk.Columns.length !== fkData.parent.Keys.length) {
                console.error(`sail: FK ${fkData.fk.ConstraintName} has ${fkData.fk.Columns.length} columns but parent ${parentTable} has ${fkData.parent.Keys.length} keys; skipping FK seed`);
                return readOnlyColumns;
            }
            fkData.fk.Columns.forEach((column, index) => {
                record[column.PascalName] = parentRecord[fkData.parent.Keys[index].PascalName];
                readOnlyColumns.push(column.PascalName);
            });
        }
        return readOnlyColumns;
    }

    buildSearchTerms(record: {[key: string]: unknown}): {[key: string]: string} {
        const tableOverride = this.config.tableOverrides?.[this.tableName()];
        const hiddenSet = new Set([
            ...this.config.hiddenFields,
            ...(tableOverride?.hiddenFields ?? []),
        ]);
        const searchTerms: {[key: string]: string} = {};
        for (const key of Object.keys(record)) {
            if (hiddenSet.has(key)) continue;
            const val = record[key];
            if (val !== '' && val !== null && val !== undefined && !Array.isArray(val)) {
                searchTerms[key] = String(val);
            }
        }
        return searchTerms;
    }
}
