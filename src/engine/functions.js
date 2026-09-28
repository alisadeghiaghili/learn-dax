/**
 * Built-in DAX function implementations (teaching subset).
 *
 * Functions receive `(args, ctx)` where args are already-evaluated Values,
 * unless the function is marked `lazy` / iterator / context-modifying and
 * is handled in the evaluator.
 */

import { getTable, colId, getColumn, manySideRelationships } from '../data/model.js';
import { expandRow } from './expanded.js';
import {
  filterTableRows,
  scalarKey,
  cloneFilterContext,
  setFilter,
  intersectFilters,
} from './context.js';

/** @typedef {{ kind: 'scalar', type: string, value: unknown }} Scalar */
/** @typedef {{ kind: 'table', columns: string[], rows: Record<string, unknown>[] }} TableValue */
/** @typedef {Scalar | TableValue} Value */

export class DaxEvalError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'DaxEvalError';
  }
}

/**
 * @param {unknown} v
 * @returns {Scalar}
 */
export function scalar(type, value) {
  return { kind: 'scalar', type, value };
}

/**
 * @returns {Scalar}
 */
export function blank() {
  return { kind: 'scalar', type: 'blank', value: null };
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
export function isBlank(v) {
  return !v || v.kind !== 'scalar' || v.type === 'blank' || v.value === null || v.value === undefined;
}

/**
 * @param {Value} v
 * @returns {number | null}
 */
export function toNumber(v) {
  if (!v || v.kind !== 'scalar' || v.type === 'blank' || v.value === null) return null;
  if (typeof v.value === 'number') return v.value;
  if (typeof v.value === 'boolean') return v.value ? 1 : 0;
  const n = Number(v.value);
  return Number.isNaN(n) ? null : n;
}

/**
 * @param {Value} v
 * @returns {string | null}
 */
export function toJsString(v) {
  if (!v || v.kind !== 'scalar' || v.type === 'blank' || v.value === null) return null;
  return String(v.value);
}

/**
 * @param {Value} v
 * @returns {boolean}
 */
export function toJsBool(v) {
  if (!v || v.kind !== 'scalar') return false;
  if (v.type === 'blank') return false;
  if (v.type === 'boolean') return Boolean(v.value);
  if (v.type === 'number') return v.value !== 0;
  return Boolean(v.value);
}

/**
 * Coerce a scalar Value to a raw JS value for filters / rows.
 * @param {Value} v
 */
export function toRaw(v) {
  if (!v || v.kind !== 'scalar') return null;
  return v.value === undefined ? null : v.value;
}

/**
 * @param {Value} v
 * @returns {asserts v is TableValue}
 */
export function expectTable(v) {
  if (!v || v.kind !== 'table') {
    throw new DaxEvalError('Expected a table expression');
  }
}

/**
 * @param {Value} v
 */
export function expectScalar(v) {
  if (v && v.kind === 'table') {
    throw new DaxEvalError('Expected a scalar expression');
  }
}

/**
 * @param {TableValue} t
 * @param {string} colName
 */
export function tableColumn(t, colName) {
  const hit = t.columns.find((c) => c.toLowerCase() === colName.toLowerCase()
    || c.toLowerCase().endsWith(`[${colName.toLowerCase()}]`));
  if (!hit) {
    throw new DaxEvalError(`Column '${colName}' not found in table expression`);
  }
  return hit;
}

/**
 * Project model table under filter context into a TableValue.
 * @param {(tableName: string) => Record<string, unknown>[]} filterRows
 * @param {string} tableName
 * @returns {TableValue}
 */
export function modelTableValue(filterRows, tableName) {
  const t = getTable(tableName);
  const rows = filterRows(t.name);
  /** @type {string[]} */
  const columns = t.columns.map((c) => colId(t.name, c.name));
  if (t.role === 'fact') {
    for (const rel of manySideRelationships(t.name)) {
      const dim = getTable(rel.toTable);
      for (const c of dim.columns) {
        const id = colId(dim.name, c.name);
        if (!columns.includes(id)) columns.push(id);
      }
    }
  }
  const projected = rows.map((r) => expandRow(t.name, r));
  return { kind: 'table', columns, rows: projected };
}

/**
 * Unique single-column table.
 * @param {string} columnName
 * @param {unknown[]} values
 * @returns {TableValue}
 */
export function singleColumnTable(columnName, values) {
  const seen = new Set();
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  for (const v of values) {
    const k = scalarKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ [columnName]: v });
  }
  return { kind: 'table', columns: [columnName], rows };
}

/**
 * Numeric column aggregate over raw rows.
 * @param {Record<string, unknown>[]} rows
 * @param {string} column
 * @param {(nums: number[]) => number | null} agg
 */
function aggNumber(rows, column, agg) {
  /** @type {number[]} */
  const nums = [];
  for (const r of rows) {
    const v = r[column];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isNaN(n)) nums.push(n);
  }
  return agg(nums);
}

/**
 * @param {number[]} nums
 */
const sum = (nums) => nums.reduce((a, b) => a + b, 0);
const average = (nums) => (nums.length ? sum(nums) / nums.length : null);
const minNum = (nums) => (nums.length ? Math.min(...nums) : null);
const maxNum = (nums) => (nums.length ? Math.max(...nums) : null);

/**
 * Non-iterator builtins evaluated with concrete args.
 * Iterators / CALCULATE live in the evaluator.
 * @type {Record<string, (args: Value[], ctx: any) => Value>}
 */
export const eagerFunctions = {
  ABS(args) {
    const n = toNumber(args[0]);
    return scalar('number', n === null ? null : Math.abs(n));
  },
  INT(args) {
    const n = toNumber(args[0]);
    return scalar('number', n === null ? null : Math.floor(n));
  },
  ROUND(args) {
    const n = toNumber(args[0]);
    const d = toNumber(args[1]) ?? 0;
    if (n === null) return blank();
    const f = 10 ** d;
    return scalar('number', Math.round(n * f) / f);
  },
  ROUNDUP(args) {
    const n = toNumber(args[0]);
    const d = toNumber(args[1]) ?? 0;
    if (n === null) return blank();
    const f = 10 ** d;
    return scalar('number', Math.ceil(n * f) / f);
  },
  ROUNDDOWN(args) {
    const n = toNumber(args[0]);
    const d = toNumber(args[1]) ?? 0;
    if (n === null) return blank();
    const f = 10 ** d;
    return scalar('number', Math.floor(n * f) / f);
  },
  DIVIDE(args) {
    const a = toNumber(args[0]);
    const b = toNumber(args[1]);
    const alt = args[2] ? toNumber(args[2]) : null;
    if (a === null || b === null || b === 0) {
      return alt === null ? blank() : scalar('number', alt);
    }
    return scalar('number', a / b);
  },
  IF(args) {
    return toJsBool(args[0]) ? args[1] : (args[2] ?? blank());
  },
  SWITCH(args) {
    // SWITCH(expr, v1, r1, v2, r2, ..., [default])
    const value = args[0];
    let i = 1;
    while (i + 1 < args.length) {
      const cmp = valueEquals(value, args[i]);
      if (cmp) return args[i + 1];
      i += 2;
    }
    if (i < args.length) return args[i];
    return blank();
  },
  NOT(args) {
    return scalar('boolean', !toJsBool(args[0]));
  },
  CONCATENATE(args) {
    const a = toJsString(args[0]) ?? '';
    const b = toJsString(args[1]) ?? '';
    return scalar('string', a + b);
  },
  UPPER(args) {
    const s = toJsString(args[0]);
    return s === null ? blank() : scalar('string', s.toUpperCase());
  },
  LOWER(args) {
    const s = toJsString(args[0]);
    return s === null ? blank() : scalar('string', s.toLowerCase());
  },
  LEN(args) {
    const s = toJsString(args[0]) ?? '';
    return scalar('number', s.length);
  },
  FORMAT(args) {
    const n = toNumber(args[0]);
    const fmt = toJsString(args[1]) ?? 'G';
    if (n === null) return blank();
    if (fmt.toLowerCase() === 'yyyy') return scalar('string', String(n));
    return scalar('string', String(n));
  },
  DATE(args) {
    const y = toNumber(args[0]);
    const m = toNumber(args[1]);
    const d = toNumber(args[2]);
    if (y === null || m === null || d === null) return blank();
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return scalar('date', `${y}-${mm}-${dd}`);
  },
  YEAR(args) {
    const v = args[0];
    const s = toJsString(v);
    if (s === null) return blank();
    return scalar('number', Number(s.slice(0, 4)));
  },
  MONTH(args) {
    const s = toJsString(args[0]);
    if (s === null) return blank();
    return scalar('number', Number(s.slice(5, 7)));
  },
  DAY(args) {
    const s = toJsString(args[0]);
    if (s === null) return blank();
    return scalar('number', Number(s.slice(8, 10)));
  },
};

/**
 * @param {Value} a
 * @param {Value} b
 */
export function valueEquals(a, b) {
  if (isBlank(a) && isBlank(b)) return true;
  if (isBlank(a) || isBlank(b)) return false;
  if (a.kind !== 'scalar' || b.kind !== 'scalar') return false;
  if (a.type === 'number' || b.type === 'number') {
    const na = toNumber(a);
    const nb = toNumber(b);
    if (na === null || nb === null) return false;
    return na === nb;
  }
  return String(a.value).toLowerCase() === String(b.value).toLowerCase();
}

/**
 * Aggregator over a column of model rows or table rows.
 * @param {Value[]} args
 * @param {any} ctx
 * @param {(rows: Record<string, unknown>[], column: string) => number | null} agg
 * @param {string} fnName
 */
function columnAggregator(args, ctx, agg, fnName) {
  const col = args[0];
  if (!col || col.kind !== 'table') {
    // Could be column ref evaluated as column table
    throw new DaxEvalError(`${fnName} expects a column`);
  }
  if (col.columns.length !== 1) {
    throw new DaxEvalError(`${fnName} expects a single column`);
  }
  const column = col.columns[0];
  // bare column name for row keys
  const short = column.includes('[') ? column.slice(column.indexOf('[') + 1, -1) : column;
  const nums = col.rows.map((r) => r[column]);
  /** @type {Record<string, unknown>[]} */
  const rows = nums.map((v) => ({ v }));
  return scalar('number', agg(rows, 'v'));
}

/**
 * Resolve a table arg to rows with short or full column names.
 * @param {Value} t
 */
export function tableRows(t) {
  expectTable(t);
  return t.rows;
}

/**
 * @param {TableValue} t
 * @param {string} name
 */
export function getColumnValues(t, name) {
  const c = tableColumn(t, name);
  return t.rows.map((r) => r[c]);
}

/** Function name registry for docs / help */
export const SUPPORTED_FUNCTIONS = [
  'ABS', 'ADDCOLUMNS', 'ALLEXCEPT', 'ALL', 'AVERAGE', 'AVERAGEX',
  'CALCULATE', 'CALCULATETABLE', 'COUNT', 'COUNTA', 'COUNTAX', 'COUNTROWS', 'COUNTX',
  'CROSSJOIN', 'DATE', 'DATEADD', 'DATESBETWEEN', 'DAY', 'DISTINCTCOUNT', 'DISTINCT',
  'DIVIDE', 'EARLIER', 'EARLIEST', 'FILTER', 'FORMAT', 'GENERATESERIES', 'IF', 'INT',
  'KEEPFILTERS', 'LEN', 'LOWER', 'MAX', 'MAXX', 'MIN', 'MINX', 'MONTH',
  'NOT', 'RELATED', 'RELATEDTABLE', 'ROUND', 'ROUNDDOWN', 'ROUNDUP',
  'SAMEPERIODLASTYEAR', 'SELECTCOLUMNS', 'SUM', 'SUMMARIZE', 'SUMX', 'SWITCH',
  'TOPN', 'TOTALYTD', 'UPPER', 'VALUES', 'YEAR',
];
