import { runDax } from '../src/engine/index.js';

const n = (s) => {
  const v = runDax(s);
  console.log(s, '=>', v.kind === 'scalar' ? v.value : `${v.rows.length} rows`);
};

n('SUMX(FILTER(Sales, Products[Category] = "Bikes"), Sales[Amount])');
n('CALCULATE(SUM(Sales[Amount]), REMOVEFILTERS(Customer))');
n('RANKX(Products, CALCULATE(SUM(Sales[Amount])), CALCULATE(SUM(Sales[Amount])))');
n('CALCULATE(SUM(Sales[Amount]), DATESYTD(Calendar[Date]))');
n('LOOKUPVALUE(Products[Price], Products[ProductKey], 1)');
n('TREATAS({1,2}, Products[ProductKey])');
n('CALCULATE(SUM(Sales[Amount]), TREATAS({"Bikes"}, Products[Category]))');
