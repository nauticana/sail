/** A named set of `TableList` column filters. */
export interface SavedFilter {
    name: string;
    filters: Record<string, string>;
}

/** One user's `TableList` layout for a table, kept by `TablePreferences`. */
export interface TablePrefs {
    hidden?: string[];
    order?: string[];
    /** Column widths in CSS pixels. */
    widths?: Record<string, number>;
    compact?: boolean;
    filters?: SavedFilter[];
}
