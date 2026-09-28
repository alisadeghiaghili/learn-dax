import { runDax, createEnv, setFilter, colId, parseDax, evaluate } from '../src/engine/index.js';

const env = createEnv();
setFilter(env.filterContext, colId('Products', 'Category'), 'in', ['Bikes']);
console.log('Products under bikes', runDax('COUNTROWS(Products)', env).value);
console.log('ALLEXCEPT raw', runDax('CALCULATETABLE(ALLEXCEPT(Products, Products[Category]))', env));
console.log(
  'CALC ALLEXCEPT',
  runDax('CALCULATE(COUNTROWS(Products), ALLEXCEPT(Products, Products[Category]))', env).value,
);
console.log('ALL products under bikes', runDax('CALCULATE(COUNTROWS(Products), ALL(Products))', env).value);
