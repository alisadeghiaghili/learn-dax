/**
 * Expanded tables (star schema): fact rows virtually include dim columns.
 */

import { getTable, getColumn, colId, parseColId, manySideRelationships } from '../data/model.js';

/**
 * @param {unknown} v
 * @returns {string}
 */
function key(v) {
  if (v === null || v === undefined) return '<null>';
  return String(v);
}

/**
 * Expand a fact row with one-level dim attributes.
 * @param {string} factTable
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function expandRow(factTable, row) {
  const t = getTable(factTable);
  const out = { ...row };
  if (t.role !== 'fact') return out;
  for (const rel of manySideRelationships(t.name)) {
    const dim = getTable(rel.toTable);
    const fk = row[rel.fromColumn];
    const dimRow = dim.rows.find((r) => key(r[rel.toColumn]) === key(fk));
    for (const c of dim.columns) {
      out[colId(dim.name, c.name)] = dimRow ? dimRow[c.name] : null;
    }
  }
  return out;
}

/**
 * Expand columns of a model table value.
 * @param {{ columns: string[], rows: Record<string, unknown>[] }} table
 * @param {string} tableName
 */
export function expandTableValue(table, tableName) {
  const t = getTable(tableName);
  if (t.role !== 'fact') return table;
  /** @type {string[]} */
  const columns = [...table.columns];
  for (const rel of manySideRelationships(t.name)) {
    const dim = getTable(rel.toTable);
    for (const c of dim.columns) {
      const id = colId(dim.name, c.name);
      if (!columns.includes(id)) columns.push(id);
    }
  }
  const rows = table.rows.map((r) => expandRow(t.name, r));
  return { columns, rows };
}

/**
 * Read a value from an expanded row by `Table[Col]` or bare column name.
 * @param {Record<string, unknown>} expanded
 * @param {string} col
 */
export function readExpanded(expanded, col) {
  if (col in expanded) return expanded[col];
  if (col.includes('[')) {
    try {
      const { table, column } = parseColId(col);
      const id = colId(table, column);
      if (id in expanded) return expanded[id];
      // expanded rows may use bare column names
      if (column in expanded) return expanded[column];
    } catch {
      /* fall through */
    }
  }
  const bare = col.includes('[') ? col.slice(col.indexOf('[') + 1, -1) : col;
  const lower = bare.toLowerCase();
  if (lower in expanded) return expanded[lower];
  for (const k of Object.keys(expanded)) {
    const short = k.includes('[') ? k.slice(k.indexOf('[') + 1, -1) : k;
    if (short.toLowerCase() === lower) return expanded[k];
  }
  return undefined;
}

/**
 * @param {string} tableName
 * @param {string} col
 * @param {{ op: string, values: unknown[] }} f
 * @param {Record<string, unknown>} row  raw (unexpanded) fact row
 * @returns {boolean}
 */
export function rowMatchesFilter(tableName, col, f, row) {
  if (f.op === 'all') return true;
  const expanded = expandRow(tableName, row);
  const v = readExpanded(expanded, col);
  return f.values.some((x) => key(x) === key(v));
}

/**
 * Does a filter on `col` apply to `tableName` (ownership or expansion)?
 * @param {string} col
 * @param {string} tableName
 */
export function filterAppliesTo(col, tableName) {
  const t = getTable(tableName);
  try {
    const { table } = parseColId(col.includes('[') ? col : `_x[${col}]`);
    if (t.name.toLowerCase() === table.toLowerCase()) return true;
    if (t.role === 'fact') {
      return manySideRelationships(t.name).some(
        (r) => r.toTable.toLowerCase() === table.toLowerCase(),
      );
    }
    return false;
  } catch {
    // bare column — applies if table has that column or expansion has it
    const bare = col.replace(/[\[\]]/g, '').toLowerCase();
    return t.columns.some((c) => c.name.toLowerCase() === bare)
      || (t.role === 'fact' && manySideRelationships(t.name).some((r) => {
        const dim = getTable(r.toTable);
        return dim.columns.some((c) => c.name.toLowerCase() === bare);
      }));
  }
}

export { getTable, colId, parseColId, manySideRelationships, getColumn };
