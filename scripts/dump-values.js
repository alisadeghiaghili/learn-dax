import { runDax, createEnv, setFilter, colId, parseDax, collectFunctions } from '../src/engine/index.js';

const n = (s, env) => {
  const v = runDax(s, env || createEnv());
  return v.kind === 'scalar' ? v.value : { kind: v.kind, rows: v.rows.length };
};

const rows = [
  ['SUM Amount', 'SUM(Sales[Amount])'],
  ['SUM A-D', 'SUM(Sales[Amount]) - SUM(Sales[Discount])'],
  ['COUNTROWS', 'COUNTROWS(Sales)'],
  ['DISTINCTCAT', 'DISTINCTCOUNT(Products[Category])'],
  ['Bikes SUMX', 'SUMX(FILTER(Sales, RELATED(Products[Category]) = "Bikes"), Sales[Amount])'],
  ['Bikes CALC', 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes")'],
  ['Seattle', 'CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle")'],
  ['Cities', 'COUNTROWS(VALUES(Customer[City]))'],
  ['Ratio', 'DIVIDE(CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle"), CALCULATE(SUM(Sales[Amount]), ALL(Sales)))'],
  ['SUMX*2', 'SUMX(Sales, Sales[Amount] * 2)'],
  ['AVERAGEX', 'AVERAGEX(Sales, Sales[Amount])'],
  ['EARLIER', 'MAXX(Products, COUNTROWS(FILTER(ALL(Products), Products[Category] = EARLIER(Products[Category]))))'],
  ['Bikes Seattle', 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes", Customer[City] = "Seattle")'],
  ['VAR half', 'VAR t = SUM(Sales[Amount]) RETURN t / 2'],
  ['TOPN city', 'CALCULATE(SUM(Sales[Amount]), TOPN(1, VALUES(Customer[City]), CALCULATE(SUM(Sales[Amount]))))'],
  ['DATEADD', 'CALCULATE(SUM(Sales[Amount]), DATEADD(Calendar[Date], 1, MONTH))'],
  ['SPLY', 'CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Calendar[Date]))'],
  ['TOTALYTD', 'TOTALYTD(SUM(Sales[Amount]), Calendar[Date])'],
  ['QTY*AMT', 'SUMX(Sales, Sales[Quantity] * Sales[Amount])'],
  ['SUMX Products CALC', 'SUMX(Products, CALCULATE(SUM(Sales[Amount])))'],
  ['2023', 'CALCULATE(SUM(Sales[Amount]), Calendar[Year] = 2023)'],
];

for (const [label, src] of rows) {
  console.log(label, n(src));
}

const env = createEnv();
setFilter(env.filterContext, colId('Customer', 'Segment'), 'in', ['Enterprise']);
console.log('Ent+Seattle', n('CALCULATE(SUM(Sales[Amount]), KEEPFILTERS(Customer[City] = "Seattle"))', env));
console.log('Ent only', n('SUM(Sales[Amount])', env));

const env2 = createEnv();
setFilter(env2.filterContext, colId('Calendar', 'Year'), 'in', [2024]);
console.log('SPLY y2024', n('CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Calendar[Date]))', env2));
console.log('DATEADD y2024', n('CALCULATE(SUM(Sales[Amount]), DATEADD(Calendar[Date], 1, MONTH))', env2));
console.log('TOTALYTD y2024', n('TOTALYTD(SUM(Sales[Amount]), Calendar[Date])', env2));
console.log('2024 only', n('SUM(Sales[Amount])', env2));
