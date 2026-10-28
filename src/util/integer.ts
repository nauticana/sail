/**
 * A keel 64-bit integer (Go `int`, `int64`; a `bigint` column): keel sends it as a decimal
 * string because a JavaScript number loses digits above 2^53. Ids stay `Int64` end to end.
 */
export type Int64 = string;

const DECIMAL = /^-?(0|[1-9]\d*)$/;

/** True for the decimal text of an integer within the 64-bit signed range. */
export function isInt64(value: unknown): value is Int64 {
  if (typeof value !== 'string' || value.length > 20 || value === '-0' || !DECIMAL.test(value)) return false;
  const n = BigInt(value);
  return n >= -(2n ** 63n) && n < 2n ** 63n;
}

/** True for an `Int64` above zero: keel sends an unset id as `'0'` or omits it. */
export function isPresentId(value: Int64 | null | undefined): value is Int64 {
  return isInt64(value) && value !== '0' && !value.startsWith('-');
}

/** Orders two `Int64` values exactly (negative, zero or positive), as a sort comparator. */
export function compareInt64(a: Int64, b: Int64): number {
  const x = BigInt(a), y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** A count or amount keel sent as an `Int64`, as a number; throws unless it is a safe integer. */
export function toSafeInteger(value: Int64 | number): number {
  const n = typeof value === 'number' ? value : DECIMAL.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n)) throw new Error(`sail: ${value} is not a safe integer.`);
  return n;
}
