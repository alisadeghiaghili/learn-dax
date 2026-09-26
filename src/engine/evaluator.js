/**
 * DAX evaluator (teaching subset).
 */

import {
  getTable,
  getColumn,
  colId,
  parseColId,
  manySideRelationships,
} from '../data/model.js';
import {
  emptyFilterContext,
  cloneFilterContext,
  setFilter,
  intersectFilters,
  filterTableRows,
  rowToFilterContext,
  lookupRowColumn,
  scalarKey,
} from './context.js';
import {
  eagerFunctions,
  scalar,
  blank,
  isBlank,
  toNumber,
  toJsString,
  toJsBool,
  toRaw,
  expectTable,
  modelTableValue,
  singleColumnTable,
  tableColumn,
  valueEquals,
  DaxEvalError,
  SUPPORTED_FUNCTIONS,
} from './functions.js';

export { DaxEvalError, SUPPORTED_FUNCTIONS };

/**
 * @typedef {import('./functions.js').Value} Value
 * @typedef {import('./context.js').FilterContext} FilterContext
 * @typedef {import('./context.js').RowFrame} RowFrame
 */

/**
 * @typedef {object} Env
 * @property {FilterContext} filterContext
 * @property {RowFrame[]} rowContexts
 * @property {Map<string, any>} measures
 * @property {Map<string, Value>} variables
 */

/**
 * @returns {Env}
 */
export function createEnv() {
  return {
    filterContext: emptyFilterContext(),
    rowContexts: [],
    measures: new Map(),
    variables: new Map(),
  };
}

/**
 * Evaluate a parsed DAX AST.
 * @param {import('./parser.js').Ast} ast
 * @param {Env} env
 * @returns {Value}
 */
export function evaluate(ast, env) {
  switch (ast.type) {
    case 'Number':
      return scalar('number', ast.value);
    case 'String':
      return scalar('string', ast.value);
    case 'Boolean':
      return scalar('boolean', ast.value);
    case 'Date':
      return scalar('date', ast.value);
    case 'Blank':
      return blank();
    case 'ColumnRef':
      return evalColumnRef(ast.name, env);
    case 'Name':
      return evalName(ast.name, env);
    case 'Binary':
      return evalBinary(ast, env);
    case 'Unary':
      return evalUnary(ast, env);
    case 'Call':
      return evalCall(ast, env);
    case 'List':
    case 'TableConstructor': {
      const values = (ast.items || []).map((item) => toRaw(evaluate(item, env)));
      return singleColumnTable('Value', values);
    }
    case 'VarReturn': {
      /** @type {Env} */
      const local = {
        ...env,
        variables: new Map(env.variables),
      };
      for (const decl of ast.vars) {
        local.variables.set(decl.name.toLowerCase(), evaluate(decl.expr, local));
      }
      return evaluate(ast.body, local);
    }
    default:
      throw new DaxEvalError(`Unsupported expression node '${ast.type}'`);
  }
}

/**
 * @param {unknown} v
 * @returns {'blank'|'number'|'boolean'|'string'}
 */
function inferType(v) {
  if (v === null || v === undefined) return 'blank';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'string';
}

/**
 * @param {string} table
 * @param {string} column
 * @param {Env} env
 * @returns {Value}
 */
function asColumnTable(table, column, env) {
  const t = getTable(table);
  const c = getColumn(table, column);
  const rows = filterTableRows(env.filterContext, t.name);
  const id = colId(t.name, c.name);
  return {
    kind: 'table',
    columns: [id],
    rows: rows.map((r) => ({ [id]: r[c.name] })),
  };
}

/**
 * @param {string} name
 * @param {Env} env
 * @returns {Value}
 */
function evalColumnRef(name, env) {
  if (name.startsWith('[')) {
    const measureName = name.slice(1, -1);
    const lower = measureName.toLowerCase();
    const squashed = lower.replace(/\s+/g, '');
    if (env.measures.has(lower)) {
      return evaluate(env.measures.get(lower), env);
    }
    if (env.measures.has(squashed)) {
      return evaluate(env.measures.get(squashed), env);
    }
    if (env.variables.has(lower) || env.variables.has(squashed)) {
      return env.variables.get(lower) ?? env.variables.get(squashed);
    }
    const hit = lookupRowColumn(env.rowContexts, name);
    if (hit.hit) return scalar(inferType(hit.value), hit.value);
    throw new DaxEvalError(`Cannot resolve column '${name}' — no row context`);
  }

  const { table, column } = parseColId(name);
  const t = getTable(table);
  const c = getColumn(t.name, column);
  const id = colId(t.name, c.name);

  for (let i = env.rowContexts.length - 1; i >= 0; i -= 1) {
    const frame = env.rowContexts[i];
    if (frame.table.toLowerCase() !== t.name.toLowerCase()) continue;
    if (c.name in frame.row) {
      return scalar(inferType(frame.row[c.name]), frame.row[c.name]);
    }
  }

  // Column reference outside row context → single-column table (for aggregators).
  return asColumnTable(t.name, c.name, env);
}

/**
 * @param {string} name
 * @param {Env} env
 * @returns {Value}
 */
function evalName(name, env) {
  const lower = name.toLowerCase();

  if (env.variables.has(lower)) {
    return env.variables.get(lower);
  }
  if (env.measures.has(lower)) {
    return evaluate(env.measures.get(lower), env);
  }
  // Allow measure names with spaces referenced without brackets by stripping spaces.
  const squashed = lower.replace(/\s+/g, '');
  if (env.measures.has(squashed)) {
    return evaluate(env.measures.get(squashed), env);
  }

  for (const t of ['Calendar', 'Products', 'Customer', 'Sales']) {
    if (t.toLowerCase() === lower) {
      return modelTableValue(
        (tableName) => filterTableRows(env.filterContext, tableName),
        t,
      );
    }
  }

  const rowHit = lookupRowColumn(env.rowContexts, `[${name}]`);
  if (rowHit.hit) return scalar(inferType(rowHit.value), rowHit.value);

  throw new DaxEvalError(`Unknown name '${name}'`);
}

/**
 * @param {any} ast
 * @param {Env} env
 */
function evalUnary(ast, env) {
  const v = evaluate(ast.expr, env);
  if (ast.op === '-') {
    const n = toNumber(v);
    return scalar('number', n === null ? null : -n);
  }
  if (ast.op === '!') {
    return scalar('boolean', !toJsBool(v));
  }
  throw new DaxEvalError(`Unsupported unary '${ast.op}'`);
}

/**
 * @param {any} ast
 * @param {Env} env
 */
function evalBinary(ast, env) {
  const op = ast.op;

  if (op === '&&') {
    if (!toJsBool(evaluate(ast.left, env))) return scalar('boolean', false);
    return scalar('boolean', toJsBool(evaluate(ast.right, env)));
  }
  if (op === '||') {
    if (toJsBool(evaluate(ast.left, env))) return scalar('boolean', true);
    return scalar('boolean', toJsBool(evaluate(ast.right, env)));
  }
  if (op === 'IN') {
    const left = toRaw(evaluate(ast.left, env));
    const listVal = evaluate(ast.right, env);
    expectTable(listVal);
    const key = listVal.columns[0];
    return scalar(
      'boolean',
      listVal.rows.some((r) => scalarKey(r[key]) === scalarKey(left)),
    );
  }

  const left = evaluate(ast.left, env);
  const right = evaluate(ast.right, env);

  if (['+', '-', '*', '/', '^'].includes(op)) {
    const a = toNumber(left);
    const b = toNumber(right);
    if (a === null || b === null) return blank();
    if (op === '+') return scalar('number', a + b);
    if (op === '-') return scalar('number', a - b);
    if (op === '*') return scalar('number', a * b);
    if (op === '/') return b === 0 ? blank() : scalar('number', a / b);
    return scalar('number', a ** b);
  }
  if (op === '=') return scalar('boolean', valueEquals(left, right));
  if (op === '<>') return scalar('boolean', !valueEquals(left, right));
  if (['<', '>', '<=', '>='].includes(op)) {
    const a = toNumber(left);
    const b = toNumber(right);
    if (a === null || b === null) return scalar('boolean', false);
    if (op === '<') return scalar('boolean', a < b);
    if (op === '>') return scalar('boolean', a > b);
    if (op === '<=') return scalar('boolean', a <= b);
    return scalar('boolean', a >= b);
  }
  throw new DaxEvalError(`Unsupported operator '${op}'`);
}

/**
 * @param {Value} table
 * @param {Record<string, unknown>} row
 * @param {Env} env
 * @returns {RowFrame}
 */
function resolveFrame(table, row, env) {
  for (const col of table.columns) {
    if (col.startsWith('[')) continue;
    try {
      const { table: tn } = parseColId(col);
      const t = getTable(tn);
      /** @type {Record<string, unknown>} */
      const bare = {};
      for (const c of t.columns) {
        const id = colId(t.name, c.name);
        if (id in row) bare[c.name] = row[id];
        else if (c.name in row) bare[c.name] = row[c.name];
      }
      return { table: t.name, row: bare };
    } catch {
      /* synthetic */
    }
  }
  /** @type {Record<string, unknown>} */
  const bare = {};
  for (const col of table.columns) {
    const short = col.includes('[') ? col.slice(col.indexOf('[') + 1, -1) : col;
    bare[short] = row[col];
  }
  return { table: '_expr', row: bare };
}

/**
 * @param {any} ast
 * @param {Env} env
 * @returns {Value}
 */
function evalCall(ast, env) {
  const name = String(ast.name).toUpperCase();
  const args = ast.args || [];

  switch (name) {
    case 'SUM':
    case 'AVERAGE':
    case 'MIN':
    case 'MAX': {
      const col = evaluate(args[0], env);
      expectTable(col);
      if (col.columns.length !== 1) {
        throw new DaxEvalError(`${name} expects a single column`);
      }
      const key = col.columns[0];
      /** @type {number[]} */
      const nums = [];
      for (const r of col.rows) {
        const raw = r[key];
        if (raw === null || raw === undefined) continue;
        const n = Number(raw);
        if (!Number.isNaN(n)) nums.push(n);
      }
      if (!nums.length) return blank();
      if (name === 'SUM') return scalar('number', nums.reduce((a, b) => a + b, 0));
      if (name === 'AVERAGE') {
        return scalar('number', nums.reduce((a, b) => a + b, 0) / nums.length);
      }
      if (name === 'MIN') return scalar('number', Math.min(...nums));
      return scalar('number', Math.max(...nums));
    }

    case 'COUNT':
    case 'COUNTA':
    case 'DISTINCTCOUNT': {
      const col = evaluate(args[0], env);
      expectTable(col);
      const key = col.columns[0];
      const vals = col.rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
      if (name === 'DISTINCTCOUNT') {
        return scalar('number', new Set(vals.map(scalarKey)).size);
      }
      return scalar('number', vals.length);
    }

    case 'COUNTROWS': {
      const t = evaluate(args[0], env);
      expectTable(t);
      return scalar('number', t.rows.length);
    }

    case 'SUMX':
    case 'AVERAGEX':
    case 'MINX':
    case 'MAXX':
    case 'COUNTX':
    case 'COUNTAX': {
      const table = evaluate(args[0], env);
      expectTable(table);
      return evalIterator(name, table, args[1], env);
    }

    case 'FILTER': {
      const table = evaluate(args[0], env);
      expectTable(table);
      /** @type {Record<string, unknown>[]} */
      const rows = [];
      for (const row of table.rows) {
        const frame = resolveFrame(table, row, env);
        const local = { ...env, rowContexts: [...env.rowContexts, frame] };
        if (toJsBool(evaluate(args[1], local))) rows.push(row);
      }
      return { kind: 'table', columns: table.columns, rows };
    }

    case 'ALL':
      return evalAll(args, env);

    case 'ALLEXCEPT':
      return evalAllExcept(args, env);

    case 'VALUES':
    case 'DISTINCT':
      return evalValues(args, env, name === 'DISTINCT');

    case 'SELECTCOLUMNS':
      return evalSelectColumns(args, env);

    case 'ADDCOLUMNS':
      return evalAddColumns(args, env);

    case 'SUMMARIZE':
      return evalSummarize(args, env);

    case 'CROSSJOIN': {
      const a = evaluate(args[0], env);
      const b = evaluate(args[1], env);
      expectTable(a);
      expectTable(b);
      const rows = [];
      for (const ra of a.rows) {
        for (const rb of b.rows) rows.push({ ...ra, ...rb });
      }
      return { kind: 'table', columns: [...a.columns, ...b.columns], rows };
    }

    case 'TOPN':
      return evalTopN(args, env);

    case 'GENERATESERIES':
      return evalGenerateSeries(args, env);

    case 'RELATED':
      return evalRelated(args, env);

    case 'RELATEDTABLE':
      return evalRelatedTable(args, env);

    case 'CALCULATE':
      return evalCalculate(args, env, false);

    case 'CALCULATETABLE':
      return evalCalculate(args, env, true);

    case 'KEEPFILTERS': {
      const t = evaluate(args[0], env);
      if (t && t.kind === 'table') {
        for (const col of t.columns) {
          if (col.includes('[')) env.filterContext.keep.add(col);
        }
      }
      return t;
    }

    case 'EARLIER':
    case 'EARLIEST': {
      // EARLIER jumps `levels` parent row contexts up (default 1).
      const levels = args[1] ? (toNumber(evaluate(args[1], env)) || 1) : 1;
      let frame;
      if (name === 'EARLIEST') {
        frame = env.rowContexts[0];
      } else {
        frame = env.rowContexts[env.rowContexts.length - 1 - levels];
      }
      if (!frame) throw new DaxEvalError(`${name} requires an outer row context`);
      return evaluate(args[0], {
        ...env,
        rowContexts: [frame],
      });
    }

    case 'DATEADD':
    case 'SAMEPERIODLASTYEAR':
    case 'TOTALYTD':
    case 'DATESBETWEEN':
      return evalTimeIntel(name, args, env);

    default: {
      if (eagerFunctions[name]) {
        return eagerFunctions[name](args.map((a) => evaluate(a, env)), env);
      }
      throw new DaxEvalError(`Unsupported function '${ast.name}'`);
    }
  }
}

/**
 * @param {string} name
 * @param {Value} table
 * @param {any} exprAst
 * @param {Env} env
 * @returns {Value}
 */
function evalIterator(name, table, exprAst, env) {
  /** @type {number[]} */
  const nums = [];
  let count = 0;

  for (const row of table.rows) {
    const frame = resolveFrame(table, row, env);
    const v = evaluate(exprAst, { ...env, rowContexts: [...env.rowContexts, frame] });
    count += 1;
    if (name === 'COUNTAX') {
      if (!isBlank(v)) nums.push(1);
      continue;
    }
    if (name === 'COUNTX') {
      if (v && v.kind === 'scalar' && !isBlank(v)) nums.push(1);
      continue;
    }
    const n = toNumber(v);
    if (n !== null) nums.push(n);
  }

  if (name === 'COUNTX' || name === 'COUNTAX') return scalar('number', nums.length);
  if (!nums.length) return blank();
  if (name === 'SUMX') return scalar('number', nums.reduce((a, b) => a + b, 0));
  if (name === 'AVERAGEX') {
    return scalar('number', nums.reduce((a, b) => a + b, 0) / nums.length);
  }
  if (name === 'MINX') return scalar('number', Math.min(...nums));
  return scalar('number', Math.max(...nums));
}

/**
 * @param {any[]} args
 * @param {Env} env
 * @returns {Value}
 */
function evalAll(args, env) {
  if (args.length === 0) {
    return { kind: 'table', columns: [], rows: [], __all: true, __allTables: true };
  }

  if (args[0].type === 'Name') {
    const t = getTable(args[0].name);
    return modelTableValue(() => t.rows.map((r) => ({ ...r })), t.name);
  }
  if (args[0].type === 'ColumnRef') {
    const { table, column } = parseColId(args[0].name);
    const t = getTable(table);
    const c = getColumn(table, column);
    const id = colId(t.name, c.name);
    return singleColumnTable(id, t.rows.map((r) => r[c.name]));
  }
  const t = evaluate(args[0], env);
  expectTable(t);
  return t;
}

/**
 * @param {any[]} args
 * @param {Env} env
 */
function evalAllExcept(args, env) {
  const tableArg = args[0];
  const keepCols = args.slice(1).map((a) => {
    if (a.type !== 'ColumnRef') {
      throw new DaxEvalError('ALLEXCEPT columns must be column references');
    }
    return canonicalCol(a.name);
  });

  if (tableArg.type === 'Name') {
    const t = getTable(tableArg.name);
    const full = modelTableValue(() => t.rows.map((r) => ({ ...r })), t.name);
    return { ...full, __allExcept: keepCols };
  }
  const t = evaluate(tableArg, env);
  expectTable(t);
  return t;
}

/**
 * @param {string} name
 * @returns {string}
 */
function canonicalCol(name) {
  try {
    const { table, column } = parseColId(name);
    const t = getTable(table);
    const c = getColumn(t.name, column);
    return colId(t.name, c.name);
  } catch {
    return name;
  }
}

/**
 * @param {any[]} args
 * @param {Env} env
 * @param {boolean} distinct
 */
function evalValues(args, env, distinct) {
  const arg = args[0];
  if (arg.type === 'Name') {
    const t = getTable(arg.name);
    const rows = filterTableRows(env.filterContext, t.name);
    const columns = t.columns.map((c) => colId(t.name, c.name));
    const projected = rows.map((r) => {
      /** @type {Record<string, unknown>} */
      const o = {};
      for (const c of t.columns) o[colId(t.name, c.name)] = r[c.name];
      return o;
    });
    return { kind: 'table', columns, rows: projected };
  }
  const v = evaluate(arg, env);
  expectTable(v);
  const key = v.columns[0];
  const vals = v.rows.map((r) => r[key]);
  if (!vals.length && !distinct) {
    return singleColumnTable(key, [null]);
  }
  return singleColumnTable(key, vals);
}

/**
 * @param {any} nameVal
 * @returns {string}
 */
function nameArg(nameVal) {
  if (nameVal.type === 'String') return nameVal.value;
  if (nameVal.type === 'Name') return nameVal.name;
  throw new DaxEvalError('Column name must be a string');
}

function evalSelectColumns(args, env) {
  const table = evaluate(args[0], env);
  expectTable(table);
  /** @type {{ name: string, ast: any }[]} */
  const projections = [];
  for (let i = 1; i < args.length; i += 2) {
    projections.push({ name: nameArg(args[i]), ast: args[i + 1] });
  }
  const columns = projections.map((p) => p.name);
  const rows = table.rows.map((row) => {
    const frame = resolveFrame(table, row, env);
    const local = { ...env, rowContexts: [...env.rowContexts, frame] };
    /** @type {Record<string, unknown>} */
    const o = {};
    for (const p of projections) {
      o[p.name] = toRaw(evaluate(p.ast, local));
    }
    return o;
  });
  return { kind: 'table', columns, rows };
}

function evalAddColumns(args, env) {
  const table = evaluate(args[0], env);
  expectTable(table);
  /** @type {{ name: string, ast: any }[]} */
  const projections = [];
  for (let i = 1; i < args.length; i += 2) {
    projections.push({ name: nameArg(args[i]), ast: args[i + 1] });
  }
  const columns = [...table.columns, ...projections.map((p) => p.name)];
  const rows = table.rows.map((row) => {
    const frame = resolveFrame(table, row, env);
    const local = { ...env, rowContexts: [...env.rowContexts, frame] };
    const o = { ...row };
    for (const p of projections) {
      o[p.name] = toRaw(evaluate(p.ast, local));
    }
    return o;
  });
  return { kind: 'table', columns, rows };
}

function evalSummarize(args, env) {
  const table = evaluate(args[0], env);
  expectTable(table);
  /** @type {string[]} */
  const groupCols = [];
  /** @type {{ name: string, ast: any }[]} */
  const ext = [];

  for (let i = 1; i < args.length; i += 1) {
    const a = args[i];
    if (a.type === 'ColumnRef') {
      groupCols.push(a.name);
    } else if (a.type === 'String' || a.type === 'Name') {
      ext.push({ name: nameArg(a), ast: args[i + 1] });
      i += 1;
    }
  }

  /** @type {string[]} */
  const groupKeys = groupCols.map((gc) => {
    const short = gc.includes('[') ? gc.slice(gc.indexOf('[') + 1, -1) : gc;
    return tableColumn(table, short);
  });

  /** @type {Map<string, { row: Record<string, unknown>, members: Record<string, unknown>[] }>} */
  const groups = new Map();
  for (const row of table.rows) {
    const key = groupKeys.map((k) => scalarKey(row[k])).join('||');
    if (!groups.has(key)) {
      /** @type {Record<string, unknown>} */
      const g = {};
      groupCols.forEach((col, idx) => {
        g[col] = row[groupKeys[idx]];
      });
      groups.set(key, { row: g, members: [row] });
    } else {
      groups.get(key).members.push(row);
    }
  }

  const columns = [...groupCols, ...ext.map((e) => e.name)];
  const rows = [...groups.values()].map(({ row, members }) => {
    const o = { ...row };
    for (const p of ext) {
      o[p.name] = toRaw(evalOverRows(p.ast, members, table, env));
    }
    return o;
  });
  return { kind: 'table', columns, rows };
}

/**
 * Evaluate expression with fact rows restricted to `rows`.
 * @param {any} ast
 * @param {Record<string, unknown>[]} rows
 * @param {Value} parent
 * @param {Env} env
 */
function evalOverRows(ast, rows, parent, env) {
  const keyCol = parent.columns.find((c) => c.toLowerCase().includes('[saleid]'))
    || parent.columns.find((c) => c.toLowerCase().includes('key'))
    || parent.columns[0];
  const values = rows.map((r) => r[keyCol]).filter((v) => v !== undefined && v !== null);
  const fc = cloneFilterContext(env.filterContext);
  try {
    const { table, column } = parseColId(keyCol);
    setFilter(fc, colId(table, column), 'in', values);
  } catch {
    /* synthetic table */
  }
  return evaluate(ast, {
    ...env,
    filterContext: fc,
    rowContexts: env.rowContexts,
  });
}

function evalTopN(args, env) {
  const n = toNumber(evaluate(args[0], env)) ?? 0;
  const table = evaluate(args[1], env);
  expectTable(table);
  const orderDesc = args[3] ? toJsBool(evaluate(args[3], env)) : true;
  const decorated = table.rows.map((row) => {
    const frame = resolveFrame(table, row, env);
    const v = toNumber(evaluate(args[2], { ...env, rowContexts: [...env.rowContexts, frame] }));
    return { row, v: v === null ? -Infinity : v };
  });
  decorated.sort((x, y) => (orderDesc ? y.v - x.v : x.v - y.v));
  return {
    kind: 'table',
    columns: table.columns,
    rows: decorated.slice(0, Math.max(0, n)).map((d) => d.row),
  };
}

function evalGenerateSeries(args, env) {
  const start = toNumber(evaluate(args[0], env)) ?? 0;
  const end = toNumber(evaluate(args[1], env)) ?? 0;
  const step = args[2] ? toNumber(evaluate(args[2], env)) ?? 1 : 1;
  if (step === 0) throw new DaxEvalError('GENERATESERIES step cannot be zero');
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  if (step > 0) {
    for (let x = start; x <= end + 1e-9; x += step) rows.push({ Value: x });
  } else {
    for (let x = start; x >= end - 1e-9; x += step) rows.push({ Value: x });
  }
  return { kind: 'table', columns: ['Value'], rows };
}

function evalRelated(args, env) {
  const arg = args[0];
  if (arg.type !== 'ColumnRef') {
    throw new DaxEvalError('RELATED expects a column reference');
  }
  const { table, column } = parseColId(arg.name);
  const target = getTable(table);
  const col = getColumn(target.name, column);
  const frame = env.rowContexts[env.rowContexts.length - 1];
  if (!frame) throw new DaxEvalError('RELATED requires a row context');

  const rel = manySideRelationships(frame.table).find(
    (r) => r.toTable.toLowerCase() === target.name.toLowerCase(),
  );
  if (!rel) {
    throw new DaxEvalError(`No relationship from '${frame.table}' to '${target.name}'`);
  }

  const fk = frame.row[rel.fromColumn];
  const match = target.rows.find((r) => scalarKey(r[rel.toColumn]) === scalarKey(fk));
  if (!match) return blank();
  return scalar(inferType(match[col.name]), match[col.name]);
}

function evalRelatedTable(args, env) {
  const arg = args[0];
  if (arg.type !== 'Name') {
    throw new DaxEvalError('RELATEDTABLE expects a table name');
  }
  const target = getTable(arg.name);
  const frame = env.rowContexts[env.rowContexts.length - 1];
  if (!frame) throw new DaxEvalError('RELATEDTABLE requires a row context');

  // Expand dim → fact across a relationship where current table is the one-side.
  const rel = manySideRelationships(target.name).find(
    (r) => r.toTable.toLowerCase() === frame.table.toLowerCase(),
  );
  if (!rel) {
    throw new DaxEvalError(`No relationship from '${frame.table}' to '${target.name}'`);
  }

  const rows = target.rows.filter(
    (r) => scalarKey(r[rel.fromColumn]) === scalarKey(frame.row[rel.toColumn]),
  );
  const columns = target.columns.map((c) => colId(target.name, c.name));
  const projected = rows.map((r) => {
    /** @type {Record<string, unknown>} */
    const o = {};
    for (const c of target.columns) o[colId(target.name, c.name)] = r[c.name];
    return o;
  });
  return { kind: 'table', columns, rows: projected };
}

/**
 * @param {any[]} args
 * @param {Env} env
 * @param {boolean} asTable
 * @returns {Value}
 */
function evalCalculate(args, env, asTable) {
  const exprAst = args[0];
  const filterAsts = args.slice(1);

  let base = cloneFilterContext(env.filterContext);
  for (const frame of env.rowContexts) {
    base = rowToFilterContext(frame, base);
  }

  const outer = {
    ...env,
    filterContext: cloneFilterContext(env.filterContext),
    rowContexts: env.rowContexts,
  };

  const applied = emptyFilterContext();
  /** @type {boolean} */
  let clearAll = false;

  for (const fAst of filterAsts) {
    const res = applyFilterArg(fAst, outer, base);
    if (res.clearAll) clearAll = true;
    intersectFilters(applied, res.filters);
    for (const k of res.keep) {
      applied.keep.add(k);
      base.keep.add(k);
    }
    if (res.clearAll) {
      applied.__clearAll = true;
    }
  }

  if (clearAll) {
    const next = emptyFilterContext();
    for (const [k, v] of applied.filters) {
      if (v.op === 'all') continue;
      next.filters.set(k, v);
    }
    for (const k of applied.keep) next.keep.add(k);
    for (const [k, v] of base.filters) {
      if (base.keep.has(k) && v.op === 'in') {
        // KEEPFILTERS preserves prior
        next.filters.set(k, v);
      }
    }
    base = next;
  } else {
    intersectFilters(base, applied);
  }

  return evaluate(exprAst, {
    ...env,
    filterContext: base,
    rowContexts: [],
    variables: env.variables,
  });
}

/**
 * @param {any} fAst
 * @param {Env} outer
 * @param {FilterContext} base
 * @returns {{ filters: FilterContext, keep: Set<string>, clearAll: boolean }}
 */
function applyFilterArg(fAst, outer, base) {
  const filters = emptyFilterContext();
  const keep = new Set();
  let clearAll = false;

  if (fAst.type === 'Call' && fAst.name.toUpperCase() === 'KEEPFILTERS') {
    const inner = applyFilterArg(fAst.args[0], outer, base);
    intersectFilters(filters, inner.filters);
    for (const k of inner.filters.filters.keys()) keep.add(k);
    for (const k of inner.keep) keep.add(k);
    clearAll = inner.clearAll;
    return { filters, keep, clearAll };
  }

  if (fAst.type === 'Call' && fAst.name.toUpperCase() === 'ALL') {
    const args = fAst.args || [];
    if (args.length === 0) {
      return { filters, keep, clearAll: true };
    }
    for (const arg of args) {
      if (arg.type === 'Name') {
        const t = getTable(arg.name);
        for (const c of t.columns) {
          filters.filters.set(colId(t.name, c.name), { op: 'all', values: [] });
        }
      } else if (arg.type === 'ColumnRef') {
        filters.filters.set(canonicalCol(arg.name), { op: 'all', values: [] });
      } else {
        const t = evaluate(arg, outer);
        expectTable(t);
        for (const col of t.columns) {
          if (col.includes('[')) {
            filters.filters.set(canonicalCol(col), { op: 'all', values: [] });
          }
        }
      }
    }
    return { filters, keep, clearAll };
  }

  if (fAst.type === 'Call' && fAst.name.toUpperCase() === 'ALLEXCEPT') {
    const tableArg = fAst.args[0];
    const keepCols = fAst.args.slice(1).map((a) => canonicalCol(a.name));
    if (tableArg.type === 'Name') {
      const t = getTable(tableArg.name);
      for (const c of t.columns) {
        const id = colId(t.name, c.name);
        if (!keepCols.some((k) => k.toLowerCase() === id.toLowerCase())) {
          filters.filters.set(id, { op: 'all', values: [] });
        }
      }
    }
    return { filters, keep, clearAll };
  }

  // Boolean predicate like Table[Col] = "x" — evaluate left as column table, compare.
  if (fAst.type === 'Binary' && ['=', '<>', '<', '>', '<=', '>=', 'IN'].includes(fAst.op)) {
    const colRes = columnFromPredicate(fAst, outer);
    if (colRes) {
      const { key, values } = colRes;
      filters.filters.set(key, { op: 'in', values });
      return { filters, keep, clearAll };
    }
  }

  const val = evaluate(fAst, outer);
  if (val.kind === 'scalar') {
    return { filters, keep, clearAll };
  }

  expectTable(val);
  if (val.__all) return { filters, keep, clearAll: true };

  for (const col of val.columns) {
    if (!col.includes('[')) continue;
    const key = canonicalCol(col);
    /** @type {unknown[]} */
    const uniq = [];
    const seen = new Set();
    for (const r of val.rows) {
      const v = r[col];
      const k = scalarKey(v);
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(v);
    }
    // Date-column filters replace the whole Calendar slice (time intelligence).
    try {
      const parts = parseColId(key);
      if (parts.table === 'Calendar' && parts.column === 'Date') {
        for (const c of getTable('Calendar').columns) {
          const id = colId('Calendar', c.name);
          if (id === key) continue;
          filters.filters.set(id, { op: 'all', values: [] });
        }
      }
    } catch {
      /* ignore */
    }
    filters.filters.set(key, { op: 'in', values: uniq });
  }
  return { filters, keep, clearAll };
}

/**
 * Recognize `Table[Col] op value` / `value op Table[Col]` / `Table[Col] IN {…}`.
 * @param {any} fAst
 * @param {Env} outer
 * @returns {{ key: string, values: unknown[] } | null}
 */
function columnFromPredicate(fAst, outer) {
  const op = fAst.op;

  if (op === 'IN') {
    const left = fAst.left;
    if (left.type !== 'ColumnRef') return null;
    const key = canonicalCol(left.name);
    const listVal = evaluate(fAst.right, outer);
    expectTable(listVal);
    const c = listVal.columns[0];
    return { key, values: listVal.rows.map((r) => r[c]) };
  }

  if (op === '=') {
    if (fAst.left.type === 'ColumnRef' && fAst.right.type !== 'ColumnRef') {
      const v = toRaw(evaluate(fAst.right, outer));
      return { key: canonicalCol(fAst.left.name), values: [v] };
    }
    if (fAst.right.type === 'ColumnRef' && fAst.left.type !== 'ColumnRef') {
      const v = toRaw(evaluate(fAst.left, outer));
      return { key: canonicalCol(fAst.right.name), values: [v] };
    }
    return null;
  }

  // inequality — expand to matching values from full column
  if (['<', '>', '<=', '>=', '<>'].includes(op)) {
    let colRef;
    let other;
    let flip = false;
    if (fAst.left.type === 'ColumnRef') {
      colRef = fAst.left;
      other = fAst.right;
    } else if (fAst.right.type === 'ColumnRef') {
      colRef = fAst.right;
      other = fAst.left;
      flip = true;
    } else {
      return null;
    }
    const key = canonicalCol(colRef.name);
    const threshold = toRaw(evaluate(other, outer));
    const { table, column } = parseColId(key);
    const t = getTable(table);
    const c = getColumn(table, column);
    /** @type {unknown[]} */
    const values = [];
    for (const row of t.rows) {
      const v = row[c.name];
      const ok = compareOp(v, threshold, flip ? flipOp(op) : op);
      if (ok) values.push(v);
    }
    return { key, values: [...new Set(values.map((v) => `${typeof v}:${v}` && v))] };
  }

  return null;
}

/**
 * @param {string} op
 */
function flipOp(op) {
  return { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '<>': '<>' }[op] || op;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {string} op
 */
function compareOp(a, b, op) {
  const na = Number(a);
  const nb = Number(b);
  const bothNum = !Number.isNaN(na) && !Number.isNaN(nb)
    && typeof a !== 'boolean' && typeof b !== 'boolean'
    && a !== null && b !== null && a !== '' && b !== '';
  if (op === '<>') {
    return scalarKey(a) !== scalarKey(b);
  }
  if (op === '=') return scalarKey(a) === scalarKey(b);
  if (bothNum) {
    if (op === '<') return na < nb;
    if (op === '>') return na > nb;
    if (op === '<=') return na <= nb;
    return na >= nb;
  }
  const sa = String(a);
  const sb = String(b);
  if (op === '<') return sa < sb;
  if (op === '>') return sa > sb;
  if (op === '<=') return sa <= sb;
  return sa >= sb;
}

/**
 * Time intelligence over Calendar[Date].
 * @param {string} name
 * @param {any[]} args
 * @param {Env} env
 * @returns {Value}
 */
function evalTimeIntel(name, args, env) {
  if (name === 'SAMEPERIODLASTYEAR') {
    const dates = evaluate(args[0], env);
    expectTable(dates);
    const key = dates.columns[0];
    const shifted = dates.rows.map((r) => shiftDate(r[key], -1, 'YEAR')).filter(Boolean);
    return singleColumnTable(key, shifted);
  }

  if (name === 'DATEADD') {
    const dates = evaluate(args[0], env);
    expectTable(dates);
    const n = toNumber(evaluate(args[1], env)) ?? 0;
    let interval = 'DAY';
    if (args[2]) {
      if (args[2].type === 'Name') interval = args[2].name.toUpperCase();
      else interval = (toJsString(evaluate(args[2], env)) || 'DAY').toUpperCase();
    }
    const key = dates.columns[0];
    const shifted = dates.rows.map((r) => shiftDate(r[key], n, interval)).filter(Boolean);
    return singleColumnTable(key, shifted);
  }

  if (name === 'DATESBETWEEN') {
    const col = evaluate(args[0], env);
    expectTable(col);
    const start = toJsString(evaluate(args[1], env));
    const end = toJsString(evaluate(args[2], env));
    const key = col.columns[0];
    const rows = col.rows
      .map((r) => r[key])
      .filter((d) => d && (!start || d >= start) && (!end || d <= end));
    return singleColumnTable(key, rows);
  }

  if (name === 'TOTALYTD') {
    const expr = args[0];
    const dates = args[1]
      ? evaluate(args[1], env)
      : modelTableValue((t) => filterTableRows(env.filterContext, t), 'Calendar');
    expectTable(dates);
    const key = dates.columns[0];
    const vals = dates.rows.map((r) => r[key]).filter(Boolean);
    if (!vals.length) return blank();
    const maxDate = vals.reduce((a, b) => (a > b ? a : b));
    const year = String(maxDate).slice(0, 4);
    const inYear = vals.filter((d) => String(d).slice(0, 4) === year);
    const fc = cloneFilterContext(env.filterContext);
    setFilter(fc, colId('Calendar', 'Date'), 'in', inYear);
    return evaluate(expr, { ...env, filterContext: fc, rowContexts: [] });
  }

  throw new DaxEvalError(`Unsupported time function '${name}'`);
}

/**
 * @param {unknown} date
 * @param {number} n
 * @param {string} [interval]
 * @returns {string | null}
 */
function shiftDate(date, n, interval = 'MONTH') {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (interval === 'YEAR') return fmt(y + n, m, d);
  if (interval === 'DAY') {
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, d);
}

/**
 * @param {number} y
 * @param {number} m
 * @param {number} d
 */
function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
