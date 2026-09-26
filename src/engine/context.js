/**
 * Filter context and row context (expanded-table aware).
 */

import { getTable, canonicalColId, colId, parseColId, manySideRelationships } from '../data/model.js';
import { expandRow, rowMatchesFilter, filterAppliesTo } from './expanded.js';

/**
 * @typedef {object} ColumnFilter
 * @property {'in'|'all'} op
 * @property {unknown[]} values
 */

/**
 * @typedef {object} FilterContext
 * @property {Map<string, ColumnFilter>} filters
 * @property {Set<string>} keep
 * @property {Array<{ from: string, to: string }>} [inactiveRel]
 */

export function emptyFilterContext() {
  return { filters: new Map(), keep: new Set() };
}

export function cloneFilterContext(ctx) {
  const filters = new Map();
  for (const [k, v] of ctx.filters) {
    filters.set(k, { op: v.op, values: [...v.values] });
  }
  return { filters, keep: new Set(ctx.keep) };
}

export function setFilter(ctx, col, op, values = []) {
  const key = canonicalColId(col);
  ctx.filters.set(key, { op, values: [...values] });
}

/**
 * @param {unknown} v
 * @returns {string}
 */
export function scalarKey(v) {
  if (v === null || v === undefined) return '<null>';
  return String(v);
}

export function intersectFilters(base, incoming) {
  for (const [key, f] of incoming.filters) {
    if (f.op === 'all') {
      if (!base.keep.has(key)) {
        base.filters.set(key, { op: 'all', values: [] });
      }
      continue;
    }
    const existing = base.filters.get(key);
    if (!existing || existing.op === 'all') {
      base.filters.set(key, { op: 'in', values: [...f.values] });
      continue;
    }
    const set = new Set(existing.values.map(scalarKey));
    const vals = f.values.filter((v) => set.has(scalarKey(v)));
    base.filters.set(key, { op: 'in', values: vals });
  }
}

/**
 * Filter table rows under filter context (expansion-aware).
 * @param {FilterContext} ctx
 * @param {string} tableName
 * @returns {Record<string, unknown>[]}
 */
export function filterTableRows(ctx, tableName) {
  const t = getTable(tableName);
  return t.rows.filter((row) => {
    for (const [col, f] of ctx.filters) {
      if (f.op === 'all') continue;
      if (!filterAppliesTo(col, t.name)) continue;
      if (!rowMatchesFilter(t.name, col, f, row)) return false;
    }
    return true;
  });
}

/**
 * @typedef {object} RowFrame
 * @property {string} table
 * @property {Record<string, unknown>} row   may be expanded
 */

export function rowToFilterContext(frame, base) {
  const ctx = cloneFilterContext(base);
  const t = getTable(frame.table);
  const expanded = expandRow(frame.table, frame.row);
  for (const c of t.columns) {
    if (!(c.name in frame.row)) continue;
    setFilter(ctx, colId(t.name, c.name), 'in', [frame.row[c.name]]);
  }
  // expanded dim columns become filters (context transition over expanded table)
  for (const rel of manySideRelationships(t.name)) {
    const dim = getTable(rel.toTable);
    for (const c of dim.columns) {
      const id = colId(dim.name, c.name);
      if (id in expanded) {
        setFilter(ctx, id, 'in', [expanded[id]]);
      }
    }
  }
  return ctx;
}

/**
 * @param {RowFrame[]} stack
 * @param {string} col
 */
export function lookupRowColumn(stack, col) {
  const bare = col.startsWith('[');
  let table = '';
  let column = '';
  if (bare) column = col.slice(1, -1);
  else {
    const p = parseColId(col);
    table = p.table;
    column = p.column;
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const frame = stack[i];
    const expanded = expandRow(frame.table, frame.row);
    if (bare) {
      if (column in expanded) return { hit: true, value: expanded[column], table: frame.table };
      const short = column.toLowerCase();
      for (const k of Object.keys(expanded)) {
        const s = k.includes('[') ? k.slice(k.indexOf('[') + 1, -1) : k;
        if (s.toLowerCase() === short) return { hit: true, value: expanded[k], table: frame.table };
      }
      continue;
    }
    const id = colId(table, column);
    if (id in expanded) return { hit: true, value: expanded[id], table };
    // physical
    if (frame.table.toLowerCase() === table.toLowerCase() && column in frame.row) {
      return { hit: true, value: frame.row[column], table };
    }
    // expanded dim column matching table[Col]
    try {
      const t = getTable(frame.table);
      if (t.role === 'fact') {
        for (const rel of manySideRelationships(t.name)) {
          if (rel.toTable.toLowerCase() !== table.toLowerCase()) continue;
          const dim = getTable(rel.toTable);
          const c = dim.columns.find((x) => x.name.toLowerCase() === column.toLowerCase());
          if (!c) continue;
          const dimId = colId(dim.name, c.name);
          if (dimId in expanded) {
            return { hit: true, value: expanded[dimId], table: dim.name };
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { hit: false };
}
