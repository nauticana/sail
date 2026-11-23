import { Injectable } from "@angular/core";
import { SavedFilter, TablePrefs } from "../model/table_prefs";

const KEY_PREFIX = 'sail.table.';

/** Keeps `TableList` layouts in this browser's localStorage; provide a subclass to store them elsewhere. */
@Injectable({ providedIn: 'root' })
export class TablePreferences {
    read(tableName: string): TablePrefs {
        try {
            return this.normalize(JSON.parse(localStorage.getItem(KEY_PREFIX + tableName) ?? '{}'));
        } catch {
            return {};
        }
    }

    write(tableName: string, prefs: TablePrefs): void {
        try {
            localStorage.setItem(KEY_PREFIX + tableName, JSON.stringify(prefs));
        } catch (err) {
            console.warn('sail: table preferences were not saved', err);
        }
    }

    /** Drops whatever does not have the stored shape, so an edited or stale entry cannot break the list. */
    protected normalize(value: unknown): TablePrefs {
        const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
        const strings = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : undefined;
        const record = <T>(v: unknown, ok: (x: unknown) => x is T) => v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x))) as Record<string, T> : undefined;
        const isWidth = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
        const isText = (x: unknown): x is string => typeof x === 'string';
        const filters = Array.isArray(raw['filters']) ? raw['filters']
            .filter((f): f is SavedFilter => typeof f?.name === 'string' && !!record(f.filters, isText))
            .map((f) => ({ name: f.name, filters: record(f.filters, isText)! })) : undefined;
        return {
            hidden: strings(raw['hidden']),
            order: strings(raw['order']),
            widths: record(raw['widths'], isWidth),
            compact: raw['compact'] === true,
            filters,
        };
    }
}
