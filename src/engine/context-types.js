/**
 * Shared context type stubs (avoid circular imports in JSDoc).
 * @typedef {object} ColumnFilter
 * @property {'in'|'all'} op
 * @property {unknown[]} values
 * @typedef {object} ContextLike
 * @property {Map<string, ColumnFilter>} filters
 * @property {Set<string>} keep
 */

/**
 * @param {unknown} v
 * @returns {string}
 */
export function scalarKey(v) {
  if (v === null || v === undefined) return '<null>';
  return String(v);
}

/**
 * Placeholder — real filterTableRows lives in context.js and is re-exported there.
 * @param {any} ctx
 * @param {string} table
 */
export function filterTableRows(ctx, table) {
  throw new Error('filterTableRows must be imported from context.js');
}
