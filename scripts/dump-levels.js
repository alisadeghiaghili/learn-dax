import { runDax, createEnv, setFilter, colId } from '../src/engine/index.js';

const n = (s, env) => {
  const v = runDax(s, env || createEnv());
  return v.kind === 'scalar' ? v.value : v.rows.length;
};

console.log('MAX-MIN', n('MAX(Sales[Amount]) - MIN(Sales[Amount])'));
console.log('Bikes rows', n('COUNTROWS(FILTER(Sales, Products[Category] = "Bikes"))'));
console.log('AVERAGEX cust', n('AVERAGEX(Customer, CALCULATE(SUM(Sales[Amount])))'));
console.log('DATESYTD count', n('COUNTROWS(DATESYTD(Calendar[Date]))'));
console.log('DATESMTD amt', n('CALCULATE(SUM(Sales[Amount]), DATESMTD(Calendar[Date]))'));
console.log('DATESQTD amt', n('CALCULATE(SUM(Sales[Amount]), DATESQTD(Calendar[Date]))'));
console.log('ALLEXCEPT bikes', n('CALCULATE(COUNTROWS(Products), ALLEXCEPT(Products, Products[Category]))'));

const e1 = createEnv();
setFilter(e1.filterContext, colId('Products', 'ProductKey'), 'in', [1]);
console.log('RANKX p1', n('RANKX(ALL(Products), CALCULATE(SUM(Sales[Amount])), CALCULATE(SUM(Sales[Amount])))', e1));
console.log('P1 amt', n('CALCULATE(SUM(Sales[Amount]))', e1));

const e2 = createEnv();
setFilter(e2.filterContext, colId('Products', 'Category'), 'in', ['Bikes']);
console.log('ALLEXCEPT under Bikes', n('CALCULATE(COUNTROWS(Products), ALLEXCEPT(Products, Products[Category]))', e2));

console.log('Cust bikes', n('COUNTAX(Customer, IF(CALCULATE(SUM(FILTER(Sales, Products[Category] = "Bikes")[Amount])) > 0, 1))'));
console.log('Accessories share', n('DIVIDE(CALCULATE(SUM(Sales[Amount]), Products[Category] = "Accessories"), SUM(Sales[Amount]))'));
console.log('2024-2023', n('CALCULATE(SUM(Sales[Amount]), Calendar[Year] = 2024) - CALCULATE(SUM(Sales[Amount]), Calendar[Year] = 2023)'));
console.log('Seattle spread', n('CALCULATE(MAX(Sales[Amount]) - MIN(Sales[Amount]), Customer[City] = "Seattle")'));
