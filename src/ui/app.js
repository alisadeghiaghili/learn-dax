/**
 * learnDax application shell: session, commands, level runner.
 */

import {
  parseDax,
  collectFunctions,
  runDax,
  evaluate,
  createEnv,
  setFilter,
  filterTableRows,
  emptyFilterContext,
  cloneFilterContext,
  toRaw,
  tables,
  getTable,
  colId,
} from '../engine/index.js';
import { levels, findLevel } from '../levels/definitions.js';
import { Terminal } from './terminal.js';
import { renderModelGraph } from './model-graph.js';
import { renderResult } from './result-view.js';
import { showLevelIntro, showLevelBrowser } from './levels-ui.js';

const PROGRESS_KEY = 'learnDax.progress';

/**
 * @typedef {object} Session
 * @property {ReturnType<typeof createEnv>} env
 * @property {{ type: string, payload: any }[]} undoStack
 * @property {any} level
 * @property {number} commands
 * @property {Record<string, number>} progress
 * @property {string} lastExpr
 */

/** @type {Session} */
const session = {
  env: createEnv(),
  undoStack: [],
  level: null,
  commands: 0,
  progress: loadProgress(),
  lastExpr: '',
};

/**
 * @returns {Record<string, number>}
 */
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(session.progress));
  } catch {
    /* ignore */
  }
}

const term = new Terminal(
  document.getElementById('term-out'),
  /** @type {HTMLInputElement} */ (document.getElementById('term-input')),
  handleLine,
);

const exprBox = /** @type {HTMLElement} */ (document.getElementById('expr-box'));
const resultRoot = /** @type {HTMLElement} */ (document.getElementById('result'));
const resultMeta = /** @type {HTMLElement} */ (document.getElementById('result-meta'));
const chipsRoot = /** @type {HTMLElement} */ (document.getElementById('filter-chips'));
const graphSvg = /** @type {SVGSVGElement} */ (document.getElementById('model-graph'));
const modeBadge = /** @type {HTMLElement} */ (document.getElementById('mode-badge'));

function refreshViz() {
  /** @type {Record<string, string[]>} */
  const filters = {};
  /** @type {Set<string>} */
  const activeTables = new Set();
  for (const [key, f] of session.env.filterContext.filters) {
    const table = key.includes('[') ? key.slice(0, key.indexOf('[')) : key;
    activeTables.add(table);
    if (f.op === 'all') {
      filters[key] = ['ALL'];
    } else {
      filters[key] = f.values.map((v) => (v === null ? 'BLANK' : String(v)));
    }
  }
  // dim filters also light the fact
  if (['Products', 'Customer', 'Calendar'].some((t) => activeTables.has(t))) {
    activeTables.add('Sales');
  }
  renderModelGraph(graphSvg, { filters, activeTables });

  chipsRoot.innerHTML = '';
  const entries = Object.entries(filters);
  if (!entries.length) {
    const span = document.createElement('span');
    span.className = 'chip all';
    span.textContent = 'no external filters';
    chipsRoot.appendChild(span);
  } else {
    for (const [key, vals] of entries) {
      const chip = document.createElement('span');
      chip.className = `chip${vals[0] === 'ALL' ? ' all' : ''}`;
      chip.textContent = `${key} ∈ {${vals.slice(0, 4).join(', ')}${vals.length > 4 ? ', …' : ''}}`;
      chipsRoot.appendChild(chip);
    }
  }
}

/**
 * @param {string} expr
 * @param {any} value
 * @param {string | null} error
 */
function showEval(expr, value, error) {
  session.lastExpr = expr;
  exprBox.textContent = expr;
  renderResult(resultRoot, resultMeta, value, error);
  refreshViz();
}

function banner() {
  term.print('learnDax — interactive DAX sandbox and challenges', 'ok');
  term.print('Inspired by learnGitBranching. Type help for commands, levels to start.', 'muted');
  term.print('', 'muted');
}

function helpText() {
  return [
    'Commands',
    '  eval <dax>                 evaluate a DAX expression',
    '  <dax>                      bare expression is treated as eval',
    '  measure Name = expr        define a measure',
    '  column Table[Col] = expr   define a calculated column',
    '  show model|tables|<Table>  inspect schema or rows',
    '  filter Table[Col] = value  external filter (visual filter context)',
    '  filter clear               clear external filters',
    '  levels                     list levels',
    '  level <n|name>             start a level',
    '  goal | hint                level goal / hint',
    '  undo | reset               history',
    '  help                       this text',
  ].join('\n');
}

/**
 * @param {string} line
 */
function handleLine(line) {
  session.commands += 1;
  const trimmed = line.trim();
  if (!trimmed) return;

  const lower = trimmed.toLowerCase();
  if (lower === 'help' || lower === '?') {
    term.printBlock(helpText());
    return;
  }
  if (lower === 'levels') {
    listLevels();
    return;
  }
  if (lower === 'undo') {
    doUndo();
    return;
  }
  if (lower === 'reset') {
    doReset();
    return;
  }
  if (lower === 'goal') {
    showGoal();
    return;
  }
  if (lower === 'hint') {
    showHint();
    return;
  }
  if (lower.startsWith('level ')) {
    startLevel(trimmed.slice(6).trim());
    return;
  }
  if (lower === 'level') {
    showLevelBrowser(levels, session.progress, (lv) => beginLevel(lv));
    return;
  }
  if (lower.startsWith('show ')) {
    doShow(trimmed.slice(5).trim());
    return;
  }
  if (lower.startsWith('filter ')) {
    doFilter(trimmed.slice(7).trim());
    return;
  }
  if (lower.startsWith('measure ')) {
    doMeasure(trimmed.slice(8).trim());
    return;
  }
  if (lower.startsWith('column ')) {
    doColumn(trimmed.slice(7).trim());
    return;
  }
  if (lower.startsWith('eval ')) {
    doEval(trimmed.slice(5).trim());
    return;
  }
  // bare DAX
  doEval(trimmed);
}

/**
 * @param {string} src
 */
function doEval(src) {
  try {
    const ast = parseDax(src);
    const value = evaluate(ast, session.env);
    showEval(src, value, null);
    if (value.kind === 'scalar') {
      const v = value.value;
      term.print(v === null || value.type === 'blank' ? 'BLANK' : String(v), 'ok');
    } else {
      term.print(`table · ${value.rows.length} row(s)`, 'ok');
    }
    checkGoal(src, ast, value);
  } catch (err) {
    showEval(src, null, err.message);
    term.print(err.message, 'err');
  }
}

/**
 * @param {string} rest
 */
function doMeasure(rest) {
  const m = /^("?)(.+?)\1\s*(?:=|:=)\s*([\s\S]+)$/.exec(rest);
  if (!m) {
    term.print('Usage: measure Name = <dax>', 'err');
    return;
  }
  const name = m[2].trim();
  const expr = m[3].trim();
  try {
    const ast = parseDax(expr);
    session.undoStack.push({
      type: 'measure',
      payload: {
        key: name.toLowerCase().replace(/\s+/g, ''),
        prev: session.env.measures.get(name.toLowerCase().replace(/\s+/g, '')),
      },
    });
    session.env.measures.set(name.toLowerCase().replace(/\s+/g, ''), ast);
    term.print(`measure ${name} := ${expr}`, 'ok');
    const value = evaluate(ast, session.env);
    showEval(`${name} := ${expr}`, value, null);
    checkGoal(expr, ast, value);
  } catch (err) {
    term.print(err.message, 'err');
  }
}

/**
 * @param {string} rest
 */
function doColumn(rest) {
  const m = /^(\w+)\[(.+?)\]\s*(?:=|:=)\s*([\s\S]+)$/.exec(rest);
  if (!m) {
    term.print('Usage: column Table[Col] = <dax>', 'err');
    return;
  }
  const table = m[1];
  const col = m[2];
  const expr = m[3].trim();
  try {
    const ast = parseDax(expr);
    const t = getTable(table);
    const env = session.env;
    const rows = filterTableRows(env.filterContext, t.name);
    /** @type {Record<string, unknown>[]} */
    const out = rows.map((row) => {
      const local = {
        ...env,
        rowContexts: [{ table: t.name, row }],
        filterContext: cloneFilterContext(env.filterContext),
      };
      const v = evaluate(ast, local);
      return { ...row, [col]: toRaw(v) };
    });
    const value = {
      kind: 'table',
      columns: [...t.columns.map((c) => colId(t.name, c.name)), col],
      rows: out.map((r) => {
        /** @type {Record<string, unknown>} */
        const o = {};
        for (const c of t.columns) o[colId(t.name, c.name)] = r[c.name];
        o[col] = r[col];
        return o;
      }),
    };
    showEval(`column ${t.name}[${col}] := ${expr}`, value, null);
    term.print(`calculated column ${t.name}[${col}] on ${rows.length} row(s)`, 'ok');
  } catch (err) {
    term.print(err.message, 'err');
  }
}

/**
 * @param {string} rest
 */
function doShow(rest) {
  const q = rest.toLowerCase();
  if (q === 'model' || q === 'tables') {
    for (const t of tables) {
      term.print(`${t.name} (${t.role}) · ${t.columns.map((c) => c.name).join(', ')}`, 'muted');
    }
    term.print('Relationships: Sales[ProductKey]→Products, Sales[CustomerKey]→Customer, Sales[Date]→Calendar', 'muted');
    return;
  }
  try {
    const t = getTable(rest);
    const rows = filterTableRows(session.env.filterContext, t.name);
    const columns = t.columns.map((c) => c.name);
    showEval(`show ${t.name}`, {
      kind: 'table',
      columns: columns.map((c) => colId(t.name, c)),
      rows: rows.map((r) => {
        /** @type {Record<string, unknown>} */
        const o = {};
        for (const c of t.columns) o[colId(t.name, c.name)] = r[c.name];
        return o;
      }),
    }, null);
    term.print(`${t.name} · ${rows.length} row(s) under current filters`, 'ok');
  } catch (err) {
    term.print(err.message, 'err');
  }
}

/**
 * @param {string} rest
 */
function doFilter(rest) {
  if (rest.toLowerCase() === 'clear') {
    session.undoStack.push({ type: 'filter', payload: cloneFilterContext(session.env.filterContext) });
    session.env.filterContext = emptyFilterContext();
    refreshViz();
    term.print('filters cleared', 'ok');
    return;
  }
  const m = /^(\w+\[.+?\])\s*=\s*(.+)$/.exec(rest);
  if (!m) {
    term.print('Usage: filter Table[Col] = value   |   filter clear', 'err');
    return;
  }
  const key = m[1];
  let raw = m[2].trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  } else if (!Number.isNaN(Number(raw))) {
    raw = Number(raw);
  }
  try {
    session.undoStack.push({ type: 'filter', payload: cloneFilterContext(session.env.filterContext) });
    setFilter(session.env.filterContext, key, 'in', [raw]);
    refreshViz();
    term.print(`filter ${key} = ${JSON.stringify(raw)}`, 'ok');
  } catch (err) {
    term.print(err.message, 'err');
  }
}

function listLevels() {
  levels.forEach((lv, i) => {
    const mark = session.progress[lv.id] ? `✓ ${session.progress[lv.id]}` : ' ';
    term.print(`${String(i + 1).padStart(2)} ${mark}  ${lv.series.padEnd(18)} ${lv.name}`, 'muted');
  });
}

/**
 * @param {string} q
 */
function startLevel(q) {
  const lv = findLevel(q);
  if (!lv) {
    term.print(`Unknown level '${q}'`, 'err');
    return;
  }
  beginLevel(lv);
}

/**
 * @param {any} lv
 */
function beginLevel(lv) {
  session.level = lv;
  session.commands = 0;
  session.env = createEnv();
  session.undoStack = [];
  if (lv.setupFilters) {
    for (const [k, v] of Object.entries(lv.setupFilters)) {
      setFilter(session.env.filterContext, k, 'in', [v]);
    }
  }
  modeBadge.textContent = `level · ${lv.name}`;
  modeBadge.classList.add('level');
  refreshViz();
  showLevelIntro({
    series: lv.series,
    name: lv.name,
    intro: lv.intro,
    why: lv.why,
    hint: lv.hint,
    index: levels.indexOf(lv) + 1,
    total: levels.length,
    onStart: () => {
      term.print(`— level: ${lv.name} —`, 'ok');
      term.print(lv.intro, 'muted');
      if (lv.why) term.print(`why: ${lv.why}`, 'muted');
      term.print('Type goal to restate, hint for a nudge.', 'muted');
    },
    onHint: () => {
      term.print(`hint: ${lv.hint}`, 'ok');
    },
  });
}

function showGoal() {
  if (!session.level) {
    term.print('No active level. Try levels.', 'muted');
    return;
  }
  const lv = session.level;
  term.print(`${lv.name} — ${lv.intro}`, 'muted');
  term.print(`expected: ${JSON.stringify(lv.goal.expected)}`, 'ok');
}

function showHint() {
  if (!session.level) {
    term.print('No active level.', 'muted');
    return;
  }
  term.print(`hint: ${session.level.hint}`, 'ok');
}

/**
 * @param {string} src
 * @param {any} ast
 * @param {any} value
 */
function checkGoal(src, ast, value) {
  const lv = session.level;
  if (!lv) return;
  const fns = collectFunctions(ast);
  if (lv.goal.requires) {
    const missing = lv.goal.requires.filter((r) => !fns.includes(r.toLowerCase()));
    if (missing.length) {
      term.print(`missing function(s): ${missing.join(', ')}`, 'muted');
    }
  }
  let actual;
  if (value && value.kind === 'scalar') {
    actual = value.value;
  } else if (value && value.kind === 'table' && value.rows.length === 1 && value.columns.length === 1) {
    actual = value.rows[0][value.columns[0]];
  } else {
    term.print('goal expects a scalar (or 1×1 table)', 'muted');
    return;
  }
  const expected = lv.goal.expected;
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(expected - actual) < 1e-9
      : expected === actual;

  if (!ok) {
    term.print(`got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`, 'err');
    return;
  }
  if (lv.goal.requires) {
    const missing = lv.goal.requires.filter((r) => !fns.includes(r.toLowerCase()));
    if (missing.length) {
      term.print('value matches, but required functions are missing', 'err');
      return;
    }
  }
  const cmds = session.commands;
  const prev = session.progress[lv.id];
  if (!prev || cmds < prev) session.progress[lv.id] = cmds;
  saveProgress();
  term.print(`LEVEL CLEAR · ${lv.name} · ${cmds} command(s)${lv.par ? ` (par ${lv.par})` : ''}`, 'ok');
  modeBadge.textContent = 'sandbox';
  modeBadge.classList.remove('level');
  session.level = null;
}

function doUndo() {
  const last = session.undoStack.pop();
  if (!last) {
    term.print('nothing to undo', 'muted');
    return;
  }
  if (last.type === 'filter') {
    session.env.filterContext = last.payload;
    refreshViz();
    term.print('undid filter', 'ok');
    return;
  }
  if (last.type === 'measure') {
    if (last.payload.prev) session.env.measures.set(last.payload.key, last.payload.prev);
    else session.env.measures.delete(last.payload.key);
    term.print('undid measure', 'ok');
    return;
  }
  term.print('undid', 'ok');
}

function doReset() {
  session.env = createEnv();
  session.undoStack = [];
  session.commands = 0;
  if (session.level && session.level.setupFilters) {
    for (const [k, v] of Object.entries(session.level.setupFilters)) {
      setFilter(session.env.filterContext, k, 'in', [v]);
    }
  }
  showEval('// reset', null, null);
  term.print('reset', 'ok');
}

// top bar
document.getElementById('btn-levels')?.addEventListener('click', () => {
  showLevelBrowser(levels, session.progress, (lv) => beginLevel(lv));
});
document.getElementById('btn-help')?.addEventListener('click', () => {
  term.printBlock(helpText());
  term.focus();
});
document.getElementById('btn-guide')?.addEventListener('click', () => {
  term.printBlock(helpText());
  term.print('', 'muted');
  term.print('Guide: start with levels 1-4 (Basics), then Filter context and CALCULATE.', 'muted');
  term.print('Watch the gold chips — that is filter context. Expanded dim columns sit on Sales.', 'muted');
  term.focus();
});
document.getElementById('btn-lesson')?.addEventListener('click', () => {
  if (!session.level) {
    term.print('No active lesson. Open Levels and pick one.', 'muted');
    showLevelBrowser(levels, session.progress, (lv) => beginLevel(lv));
    return;
  }
  const lv = session.level;
  showLevelIntro({
    series: lv.series,
    name: lv.name,
    intro: lv.intro,
    why: lv.why,
    hint: lv.hint,
    index: levels.indexOf(lv) + 1,
    total: levels.length,
    onStart: () => term.focus(),
    onHint: () => {
      term.print(`hint: ${lv.hint}`, 'ok');
    },
  });
});
document.getElementById('btn-hint')?.addEventListener('click', () => {
  showHint();
  term.focus();
});
document.getElementById('btn-solution')?.addEventListener('click', () => {
  if (!session.level) {
    term.print('No active level — solution is only available inside a lesson.', 'muted');
    return;
  }
  term.print(`solution: ${session.level.hint}`, 'ok');
  term.print('Paste it in the terminal as an expression. That is the par path.', 'muted');
  term.focus();
});
document.getElementById('btn-undo')?.addEventListener('click', () => {
  doUndo();
  term.focus();
});
document.getElementById('btn-reset')?.addEventListener('click', () => {
  doReset();
  term.focus();
});
document.getElementById('btn-sandbox')?.addEventListener('click', () => {
  session.level = null;
  session.commands = 0;
  session.env = createEnv();
  session.undoStack = [];
  modeBadge.textContent = 'sandbox';
  modeBadge.classList.remove('level');
  refreshViz();
  showEval('// sandbox', null, null);
  term.print('sandbox mode — free play', 'ok');
  term.focus();
});

banner();
refreshViz();
term.focus();

// optional ?command= support (learnGitBranching-style)
const params = new URLSearchParams(location.search);
if (params.get('NODEMO') === null && params.get('command')) {
  // still run command
}
const cmd = params.get('command');
if (cmd) {
  for (const part of cmd.split(';')) {
    if (part.trim()) handleLine(part.trim());
  }
}
