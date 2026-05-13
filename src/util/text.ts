/**
 * Convert a snake_case / lower_case identifier to Title Case.
 *
 *   titleCase('user_payment_method') -> 'User Payment Method'
 *   titleCase('UserId')              -> 'Userid'   (no camelCase split)
 *
 * Used as the fallback label for tables and columns when no explicit
 * caption is set in `basis.table_header.Caption` / `basis.column.Caption`.
 * Mirrors keel's `common.PascalCase`-style helpers on the frontend side
 * so caption rendering is consistent across consumers.
 */
export function titleCase(str: string): string {
  return str
    .replaceAll('_', ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
