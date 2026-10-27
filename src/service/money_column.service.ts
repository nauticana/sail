import { Injectable, inject, signal } from '@angular/core';
import { TableColumn } from '../model/appdata';
import { BaseAuthService } from './auth.service';
import { CurrencyService } from './currency.service';
import { BackendService } from './rest_service';
import { Int64 } from '../util/integer';

/** The row a child grid or form is nested under. */
export interface ParentRow {
  tableName: string;
  record: Record<string, unknown>;
}

/**
 * Resolves a money column's currency along keel's `TableColumn.CurrencyPath`: a sibling column, or
 * foreign keys up to the ancestor row holding it. An ancestor the view does not supply is fetched
 * once through generic REST and cached in a signal, so a template re-renders when it arrives.
 */
@Injectable({ providedIn: 'root' })
export class MoneyColumnService {
  private readonly auth = inject(BaseAuthService);
  private readonly backend = inject(BackendService);
  private readonly currencies = inject(CurrencyService);
  private readonly rows = signal(new Map<string, Record<string, unknown>>());
  private readonly requested = new Set<string>();

  constructor() {
    // Rows belong to the session and metadata that loaded them.
    this.auth.getMenus().subscribe(() => {
      this.rows.set(new Map());
      this.requested.clear();
    });
  }

  /** Formatted amount; '' while the currency or the catalog is still loading, or when the path cannot be resolved. */
  display(tableName: string, column: TableColumn, minor: Int64 | number, record: Record<string, unknown>, parent?: ParentRow): string {
    const currency = this.currency(tableName, column, record, parent);
    return currency ? this.currencies.formatLazy(minor, currency) : '';
  }

  /** The row's currency code, or undefined while unresolved. */
  currency(tableName: string, column: TableColumn, record: Record<string, unknown>, parent?: ParentRow): string | undefined {
    const path = (column.CurrencyPath ?? '').split('.');
    let table = this.auth.getTableDefinition(tableName);
    let row: Record<string, unknown> | undefined = record;
    for (const name of path.slice(0, -1)) {
      const fk = table?.Parents.find((p) => p.ParentTable === name);
      const parentDef = this.auth.getTableDefinition(name);
      if (!fk || !parentDef || !row || fk.ParentColumns?.length !== fk.Columns.length) return undefined;
      const current: Record<string, unknown> = row;
      const filter: Record<string, string> = {};
      fk.ParentColumns.forEach((key, i) => { filter[key.PascalName] = String(field(current, fk.Columns[i]) ?? ''); });
      row = parent?.tableName === name ? parent.record : this.parentRow(name, filter);
      table = parentDef;
    }
    const col = table?.Columns.find((c) => c.ColumnName === path.at(-1));
    const value = col && row ? field(row, col) : undefined;
    return typeof value === 'string' && value ? value : undefined;
  }

  private parentRow(tableName: string, filter: Record<string, string>): Record<string, unknown> | undefined {
    if (Object.values(filter).includes('')) return undefined;
    const key = tableName + JSON.stringify(filter);
    const cached = this.rows().get(key);
    if (cached || this.requested.has(key)) return cached;
    const apiName = this.auth.apiNameFor(tableName);
    if (!apiName) throw new Error(`sail: no API serves ${tableName}, needed by a currency path.`);
    this.requested.add(key);
    this.backend.get<Record<string, unknown> | Record<string, unknown>[]>(apiName, filter).subscribe({
      next: (result) => this.rows.update((rows) => new Map(rows).set(key, Array.isArray(result) ? result[0] : result)),
      error: (err) => console.error(`sail: could not load ${tableName} for a currency path`, err),
    });
    return undefined;
  }
}

/** A generic REST row is keyed by PascalName, a report row by the SQL column name. */
function field(row: Record<string, unknown>, col: TableColumn): unknown {
  return row[col.PascalName] ?? row[col.ColumnName];
}
