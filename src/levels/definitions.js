/**
 * Level definitions for the Contoso-lite model.
 * Expected values match tests/engine.test.js (deterministic rows).
 */

/**
 * @typedef {object} LevelGoal
 * @property {number|string|boolean|null} expected
 * @property {string[]} [requires]
 */

/**
 * @typedef {object} Level
 * @property {string} id
 * @property {string} name
 * @property {string} series
 * @property {string} intro
 * @property {string} hint
 * @property {LevelGoal} goal
 * @property {number} [par]
 * @property {Record<string, string>} [setupFilters]
 */

/** @type {Level[]} */
export const levels = [
  {
    id: 'basics-1',
    name: 'First sum',
    series: 'Basics',
    intro: 'Return the grand total of Sales[Amount].',
    hint: 'SUM(Sales[Amount])',
    goal: { expected: 18310, requires: ['sum'] },
    par: 1,
  },
  {
    id: 'basics-2',
    name: 'Column arithmetic',
    series: 'Basics',
    intro: 'Return total Amount minus total Discount.',
    hint: 'SUM(Sales[Amount]) - SUM(Sales[Discount])',
    goal: { expected: 18040, requires: ['sum'] },
    par: 1,
  },
  {
    id: 'basics-3',
    name: 'Row count',
    series: 'Basics',
    intro: 'How many rows does Sales have?',
    hint: 'COUNTROWS(Sales)',
    goal: { expected: 26, requires: ['countrows'] },
    par: 1,
  },
  {
    id: 'basics-4',
    name: 'Distinct categories',
    series: 'Basics',
    intro: 'Count distinct values in Products[Category].',
    hint: 'DISTINCTCOUNT(Products[Category])',
    goal: { expected: 2, requires: ['distinctcount'] },
    par: 1,
  },

  {
    id: 'filter-1',
    name: 'Iterate and filter',
    series: 'Filter context',
    intro:
      'Total Amount for Bikes only, using FILTER + RELATED + SUMX (the long road — next level is the short one).',
    hint: 'SUMX(FILTER(Sales, RELATED(Products[Category]) = "Bikes"), Sales[Amount])',
    goal: { expected: 17440, requires: ['sumx', 'filter'] },
    par: 1,
  },
  {
    id: 'filter-2',
    name: 'VALUES',
    series: 'Filter context',
    intro: 'Count distinct customer cities with COUNTROWS(VALUES(...)).',
    hint: 'COUNTROWS(VALUES(Customer[City]))',
    goal: { expected: 3, requires: ['values', 'countrows'] },
    par: 1,
  },
  {
    id: 'filter-3',
    name: 'ALL and ratio',
    series: 'Filter context',
    intro: 'Seattle Amount divided by grand total. Use DIVIDE, CALCULATE, and ALL(Sales).',
    hint: 'DIVIDE(CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle"), CALCULATE(SUM(Sales[Amount]), ALL(Sales)))',
    goal: { expected: 12600 / 18310, requires: ['divide', 'calculate', 'all'] },
    par: 1,
  },

  {
    id: 'calc-1',
    name: 'Filter argument',
    series: 'CALCULATE',
    intro: 'Total Amount for Products[Category] = "Bikes" using CALCULATE.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes")',
    goal: { expected: 17440, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'calc-2',
    name: 'Context transition',
    series: 'CALCULATE',
    intro:
      'Prove context transition: SUMX over Products of CALCULATE(SUM(Sales[Amount])) must equal the grand total.',
    hint: 'SUMX(Products, CALCULATE(SUM(Sales[Amount])))',
    goal: { expected: 18310, requires: ['calculate', 'sumx'] },
    par: 1,
  },
  {
    id: 'calc-3',
    name: 'Intersect filters',
    series: 'CALCULATE',
    intro:
      'Set an external filter first: filter Customer[Segment] = "Enterprise". Then compute Amount for City = "Seattle" (Contoso only). KEEPFILTERS is optional — AND already intersects.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle")  with filter Customer[Segment] = "Enterprise"',
    goal: { expected: 7640, requires: ['calculate', 'sum'] },
    par: 2,
  },

  {
    id: 'iter-1',
    name: 'SUMX',
    series: 'Iterators',
    intro: 'Total of Amount * 2 over every sales row.',
    hint: 'SUMX(Sales, Sales[Amount] * 2)',
    goal: { expected: 36620, requires: ['sumx'] },
    par: 1,
  },
  {
    id: 'iter-2',
    name: 'EARLIER',
    series: 'Iterators',
    intro:
      'MAX over products of: how many products share that product’s category. Use MAXX, FILTER, ALL, EARLIER.',
    hint: 'MAXX(Products, COUNTROWS(FILTER(ALL(Products), Products[Category] = EARLIER(Products[Category]))))',
    goal: { expected: 3, requires: ['maxx', 'earlier', 'filter', 'all'] },
    par: 1,
  },
  {
    id: 'iter-3',
    name: 'AVERAGEX',
    series: 'Iterators',
    intro: 'Average Amount per sales row.',
    hint: 'AVERAGEX(Sales, Sales[Amount])',
    goal: { expected: 18310 / 26, requires: ['averagex'] },
    par: 1,
  },

  {
    id: 'time-1',
    name: 'Same period last year',
    series: 'Time intelligence',
    intro:
      'Amount in the same dates one year earlier (2023 slice that lines up with the calendar). Use SAMEPERIODLASTYEAR(Calendar[Date]) inside CALCULATE.',
    hint: 'CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Calendar[Date]))',
    goal: { expected: 2700, requires: ['calculate', 'sameperiodlastyear'] },
    par: 1,
  },
  {
    id: 'time-2',
    name: 'Dateadd months',
    series: 'Time intelligence',
    intro: 'Total Amount for every calendar date shifted +1 month.',
    hint: 'CALCULATE(SUM(Sales[Amount]), DATEADD(Calendar[Date], 1, MONTH))',
    goal: { expected: 17310, requires: ['dateadd', 'calculate'] },
    par: 1,
  },
  {
    id: 'time-3',
    name: 'Total YTD',
    series: 'Time intelligence',
    intro: 'Year-to-date Amount relative to the latest date in context.',
    hint: 'TOTALYTD(SUM(Sales[Amount]), Calendar[Date])',
    goal: { expected: 15610, requires: ['totalytd'] },
    par: 1,
  },

  {
    id: 'chal-1',
    name: 'Bikes in Seattle',
    series: 'Challenges',
    intro: 'Amount for Bikes sold to Seattle customers.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes", Customer[City] = "Seattle")',
    goal: { expected: 12290, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'chal-2',
    name: 'Quantity-weighted',
    series: 'Challenges',
    intro: 'SUMX of Quantity * Amount (an anti-pattern — do it, then know why it is wrong).',
    hint: 'SUMX(Sales, Sales[Quantity] * Sales[Amount])',
    goal: { expected: 26410, requires: ['sumx'] },
    par: 1,
  },
  {
    id: 'chal-3',
    name: 'Top city',
    series: 'Challenges',
    intro: 'Amount for the customer city with the highest total. TOPN + CALCULATE.',
    hint: 'CALCULATE(SUM(Sales[Amount]), TOPN(1, VALUES(Customer[City]), CALCULATE(SUM(Sales[Amount]))))',
    goal: { expected: 12600, requires: ['topn', 'calculate', 'sum'] },
    par: 1,
  },
];

/**
 * @param {string | number} idOrName
 * @returns {Level | undefined}
 */
export function findLevel(idOrName) {
  const q = String(idOrName).toLowerCase();
  return (
    levels.find((l) => l.id.toLowerCase() === q) ||
    levels.find((l) => l.name.toLowerCase() === q) ||
    levels.find((l) => l.name.toLowerCase().includes(q)) ||
    levels[Number(idOrName) - 1]
  );
}

/**
 * @returns {string[]}
 */
export function seriesNames() {
  return [...new Set(levels.map((l) => l.series))];
}
