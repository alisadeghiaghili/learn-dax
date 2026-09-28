/**
 * Engine unit tests (node:test).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDax, collectFunctions, runDax, createEnv, DaxEvalError } from '../src/engine/index.js';
import { setFilter } from '../src/engine/context.js';
import { colId } from '../src/data/model.js';

/**
 * @param {string} src
 * @param {import('../src/engine/evaluator.js').Env} [env]
 */
function num(src, env) {
  const v = runDax(src, env);
  assert.equal(v.kind, 'scalar', `expected scalar for ${src}, got ${v.kind}`);
  return v.value;
}

test('parse SUM column', () => {
  const ast = parseDax('SUM(Sales[Amount])');
  assert.equal(ast.type, 'Call');
  assert.deepEqual(collectFunctions(ast), ['sum']);
});

test('grand total amount', () => {
  assert.equal(num('SUM(Sales[Amount])'), 18310);
});

test('amount minus discount', () => {
  assert.equal(num('SUM(Sales[Amount]) - SUM(Sales[Discount])'), 18040);
});

test('countrows sales', () => {
  assert.equal(num('COUNTROWS(Sales)'), 26);
});

test('distinct categories', () => {
  assert.equal(num('DISTINCTCOUNT(Products[Category])'), 2);
});

test('filter bikes via SUMX FILTER RELATED', () => {
  assert.equal(
    num('SUMX(FILTER(Sales, RELATED(Products[Category]) = "Bikes"), Sales[Amount])'),
    17440,
  );
});

test('CALCULATE with column predicate', () => {
  assert.equal(
    num('CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes")'),
    17440,
  );
});

test('CALCULATE city Seattle', () => {
  assert.equal(
    num('CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle")'),
    12600,
  );
});

test('values cities', () => {
  assert.equal(num('COUNTROWS(VALUES(Customer[City]))'), 3);
});

test('ratio Seattle / ALL', () => {
  const v = num(
    'DIVIDE(CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle"), CALCULATE(SUM(Sales[Amount]), ALL(Sales)))',
  );
  assert.ok(Math.abs(v - 12600 / 18310) < 1e-12);
});

test('SUMX amount * 2', () => {
  assert.equal(num('SUMX(Sales, Sales[Amount] * 2)'), 36620);
});

test('AVERAGEX amount', () => {
  const v = num('AVERAGEX(Sales, Sales[Amount])');
  assert.ok(Math.abs(v - 18310 / 26) < 1e-9);
});

test('EARLIER category count', () => {
  assert.equal(
    num('MAXX(Products, COUNTROWS(FILTER(ALL(Products), Products[Category] = EARLIER(Products[Category]))))'),
    3,
  );
});

test('bikes seattle', () => {
  assert.equal(
    num('CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes", Customer[City] = "Seattle")'),
    12290,
  );
});

test('VAR / RETURN', () => {
  assert.equal(num('VAR t = SUM(Sales[Amount]) RETURN t / 2'), 9155);
});

test('measure by name', () => {
  const env = createEnv();
  env.measures.set('totalsales', parseDax('SUM(Sales[Amount])'));
  assert.equal(num('TotalSales', env), 18310);
  assert.equal(num('[TotalSales]', env), 18310);
});

test('external filter on dim propagates', () => {
  const env = createEnv();
  setFilter(env.filterContext, colId('Products', 'Category'), 'in', ['Bikes']);
  assert.equal(num('SUM(Sales[Amount])', env), 17440);
});

test('context transition SUMX Products', () => {
  assert.equal(num('SUMX(Products, CALCULATE(SUM(Sales[Amount])))'), 18310);
});

test('unknown function throws', () => {
  assert.throws(() => runDax('FOOBAR(1)'), DaxEvalError);
});

test('syntax error throws', () => {
  assert.throws(() => parseDax('SUM(Sales[Amount]'), /Expected/);
});

test('IN list', () => {
  assert.equal(num('CALCULATE(SUM(Sales[Amount]), Products[Category] IN {"Bikes"})'), 17440);
});

test('KEEPFILTERS with enterprise Seattle', () => {
  const env = createEnv();
  setFilter(env.filterContext, colId('Customer', 'Segment'), 'in', ['Enterprise']);
  const v = num('CALCULATE(SUM(Sales[Amount]), KEEPFILTERS(Customer[City] = "Seattle"))', env);
  assert.equal(v, 7640);
});

test('TOPN city', () => {
  assert.equal(
    num('CALCULATE(SUM(Sales[Amount]), TOPN(1, VALUES(Customer[City]), CALCULATE(SUM(Sales[Amount]))))'),
    12600,
  );
});

test('DATEADD month', () => {
  assert.equal(num('CALCULATE(SUM(Sales[Amount]), DATEADD(Calendar[Date], 1, MONTH))'), 17310);
});

test('SAMEPERIODLASTYEAR', () => {
  assert.equal(num('CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Calendar[Date]))'), 2700);
});

test('TOTALYTD', () => {
  assert.equal(num('TOTALYTD(SUM(Sales[Amount]), Calendar[Date])'), 15610);
});

test('quantity weighted', () => {
  assert.equal(num('SUMX(Sales, Sales[Quantity] * Sales[Amount])'), 26410);
});

test('expanded table filter without RELATED', () => {
  assert.equal(
    num('SUMX(FILTER(Sales, Products[Category] = "Bikes"), Sales[Amount])'),
    17440,
  );
});

test('REMOVEFILTERS Customer', () => {
  assert.equal(num('CALCULATE(SUM(Sales[Amount]), REMOVEFILTERS(Customer))'), 18310);
});

test('TREATAS bridge', () => {
  assert.equal(
    num('CALCULATE(SUM(Sales[Amount]), TREATAS({"Bikes"}, Products[Category]))'),
    17440,
  );
});

test('DATESYTD filter', () => {
  assert.equal(num('CALCULATE(SUM(Sales[Amount]), DATESYTD(Calendar[Date]))'), 15610);
});

test('DATESMTD filter', () => {
  assert.equal(num('CALCULATE(SUM(Sales[Amount]), DATESMTD(Calendar[Date]))'), 1830);
});

test('LOOKUPVALUE', () => {
  assert.equal(num('LOOKUPVALUE(Products[Price], Products[ProductKey], 1)'), 1000);
});

test('ALLEXCEPT keeps category filter', () => {
  const env = createEnv();
  setFilter(env.filterContext, colId('Products', 'Category'), 'in', ['Bikes']);
  assert.equal(num('CALCULATE(COUNTROWS(Products), ALLEXCEPT(Products, Products[Category]))', env), 3);
});

test('dim column filter on Products', () => {
  const env = createEnv();
  setFilter(env.filterContext, colId('Products', 'Category'), 'in', ['Bikes']);
  assert.equal(num('COUNTROWS(Products)', env), 3);
});
