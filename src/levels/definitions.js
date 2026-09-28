/**
 * learnDax curriculum.
 *
 * Expected values match tests/engine.test.js and scripts/dump-values.js
 * on the deterministic Contoso-lite model.
 *
 * Depth target: SQLBI / Definitive Guide of DAX syllabus coverage with
 * teaching text, not just a goal number.
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
 * @property {string} why
 * @property {string} hint
 * @property {LevelGoal} goal
 * @property {number} [par]
 * @property {Record<string, string>} [setupFilters]
 */

/** @type {Level[]} */
export const levels = [
  // ══════════════════════════════ BASICS ══════════════════════════════
  {
    id: 'basics-1',
    name: 'First sum',
    series: 'Basics',
    intro: 'Return the grand total of Sales[Amount].',
    why: 'SUM is a filter-context aggregator: it sums a column over the rows that survive the current filter context. There is no row context here — only a single scalar.',
    hint: 'SUM(Sales[Amount])',
    goal: { expected: 18310, requires: ['sum'] },
    par: 1,
  },
  {
    id: 'basics-2',
    name: 'Column arithmetic',
    series: 'Basics',
    intro: 'Return total Amount minus total Discount.',
    why: 'Two aggregators subtracted. Each SUM is independent. This is NOT SUMX(Sales, Amount-Discount) — that would sum (Amount-Discount) per row, which happens to be equal here only because both are linear. Know the difference.',
    hint: 'SUM(Sales[Amount]) - SUM(Sales[Discount])',
    goal: { expected: 18040, requires: ['sum'] },
    par: 1,
  },
  {
    id: 'basics-3',
    name: 'Row count',
    series: 'Basics',
    intro: 'How many rows does Sales have?',
    why: 'COUNTROWS counts rows in a table expression after filter context. COUNT(Sales[Amount]) counts non-blank numbers in that column — different when blanks exist.',
    hint: 'COUNTROWS(Sales)',
    goal: { expected: 26, requires: ['countrows'] },
    par: 1,
  },
  {
    id: 'basics-4',
    name: 'Distinct categories',
    series: 'Basics',
    intro: 'Count distinct values in Products[Category].',
    why: 'DISTINCTCOUNT ignores blanks in real DAX. Our engine does too (null filtered). Use it instead of COUNTROWS(VALUES(...)) when you only need the number.',
    hint: 'DISTINCTCOUNT(Products[Category])',
    goal: { expected: 2, requires: ['distinctcount'] },
    par: 1,
  },
  {
    id: 'basics-5',
    name: 'DIVIDE, not slash',
    series: 'Basics',
    intro: 'Seattle Amount / grand total using DIVIDE.',
    why: 'DIVIDE(numerator, denominator, [alternate]) is the safe divide. In real DAX 1/0 raises an error; DIVIDE returns BLANK (or alternate). Prefer DIVIDE in every ratio measure.',
    hint: 'DIVIDE(CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle"), SUM(Sales[Amount]))',
    goal: { expected: 12600 / 18310, requires: ['divide'] },
    par: 1,
  },
  {
    id: 'basics-6',
    name: 'MIN / MAX / AVERAGE',
    series: 'Basics',
    intro: 'Return MAX(Sales[Amount]) - MIN(Sales[Amount]) — the spread of line amounts.',
    why: 'MIN/MAX/AVERAGE are column aggregators. AVERAGE is not a weighted average: it averages rows, not product prices.',
    hint: 'MAX(Sales[Amount]) - MIN(Sales[Amount])',
    goal: { expected: 1860, requires: ['max', 'min'] },
    par: 1,
  },
  {
    id: 'basics-7',
    name: 'VAR and RETURN',
    series: 'Basics',
    intro: 'Use VAR to store grand total, then RETURN half of it.',
    why: 'VAR freezes a value once. Reusing VAR avoids re-evaluation and makes intent readable. VAR is not a lambda — it is a named snapshot of a scalar/table.',
    hint: 'VAR t = SUM(Sales[Amount]) RETURN t / 2',
    goal: { expected: 9155, requires: [] },
    par: 1,
  },

  // ══════════════════════════ MODEL & EXPANSION ══════════════════════
  {
    id: 'model-1',
    name: 'RELATED',
    series: 'Model & expansion',
    intro: 'Total Amount for Bikes using FILTER(Sales, RELATED(Products[Category]) = "Bikes") and SUMX.',
    why: 'RELATED walks many→one inside a row context. It is the explicit form of what expansion does implicitly.',
    hint: 'SUMX(FILTER(Sales, RELATED(Products[Category]) = "Bikes"), Sales[Amount])',
    goal: { expected: 17440, requires: ['sumx', 'filter', 'related'] },
    par: 1,
  },
  {
    id: 'model-2',
    name: 'Expanded table',
    series: 'Model & expansion',
    intro: 'Same result WITHOUT RELATED: FILTER(Sales, Products[Category] = "Bikes").',
    why: 'Sales is expanded with Products, Customer, and Calendar columns. A predicate on Products[Category] filters the fact table. This is why SUMX(FILTER(Sales, Products[Category]="Bikes"), Sales[Amount]) works.',
    hint: 'SUMX(FILTER(Sales, Products[Category] = "Bikes"), Sales[Amount])',
    goal: { expected: 17440, requires: ['sumx', 'filter'] },
    par: 1,
  },
  {
    id: 'model-3',
    name: 'RELATEDTABLE',
    series: 'Model & expansion',
    intro: 'For Contoso, count sales rows: COUNTROWS(RELATEDTABLE(Sales)) inside SUMX(Customer, ...).',
    why: 'RELATEDTABLE is the one→many expansion. It returns the fact rows matching the current dim row.',
    hint: 'SUMX(FILTER(Customer, Customer[Customer] = "Contoso"), COUNTROWS(RELATEDTABLE(Sales)))',
    goal: { expected: 8, requires: ['sumx', 'filter', 'relatedtable', 'countrows'] },
    par: 1,
  },
  {
    id: 'model-4',
    name: 'LOOKUPVALUE',
    series: 'Model & expansion',
    intro: 'Price of product key 1 via LOOKUPVALUE (row context not required).',
    why: 'LOOKUPVALUE is a bidirectional lookup without needing a row context — useful in calculated columns and measures that must not depend on relationships.',
    hint: 'LOOKUPVALUE(Products[Price], Products[ProductKey], 1)',
    goal: { expected: 1000, requires: ['lookupvalue'] },
    par: 1,
  },

  // ═══════════════════════════ FILTER CONTEXT ═══════════════════════
  {
    id: 'filter-1',
    name: 'VALUES',
    series: 'Filter context',
    intro: 'Count distinct customer cities with COUNTROWS(VALUES(...)).',
    why: 'VALUES returns the distinct values of a column in the current filter context — including a blank row if the set is empty. DISTINCT is similar but never adds that blank row.',
    hint: 'COUNTROWS(VALUES(Customer[City]))',
    goal: { expected: 3, requires: ['values', 'countrows'] },
    par: 1,
  },
  {
    id: 'filter-2',
    name: 'ALL on a column',
    series: 'Filter context',
    intro: 'Number of products ignoring any Category filter: COUNTROWS(ALL(Products[Category])) is 2 — wrong tool. Use COUNTROWS(ALL(Products)).',
    why: 'ALL(Table) removes filters from that table. ALL(Table[Col]) removes filters from that column and yields the column\'s values. Know which you need.',
    hint: 'COUNTROWS(ALL(Products))',
    goal: { expected: 5, requires: ['all', 'countrows'] },
    par: 1,
  },
  {
    id: 'filter-3',
    name: 'ALL and ratio',
    series: 'Filter context',
    intro: 'Seattle / grand total where the denominator uses ALL(Sales).',
    why: 'Pattern: CALCULATE(SUM(...), cityFilter) / CALCULATE(SUM(...), ALL(dim)). ALL(Sales) is overkill here (no filter on Sales yet) but is the standard "ignore slicers" form.',
    hint: 'DIVIDE(CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle"), CALCULATE(SUM(Sales[Amount]), ALL(Sales)))',
    goal: { expected: 12600 / 18310, requires: ['divide', 'calculate', 'all'] },
    par: 1,
  },
  {
    id: 'filter-4',
    name: 'ALLEXCEPT',
    series: 'Filter context',
    intro: 'Under filter Products[Category] = "Bikes", count products keeping only Category filters cleared except Category… Better: compute COUNTROWS(ALL(Products[Product])) with Category filter still on — use ALLEXCEPT(Products, Products[Category]).',
    why: 'ALLEXCEPT(Table, Col1, Col2) removes all filters from Table except those columns. It is the "keep these, drop the rest" form of ALL.',
    hint: 'CALCULATE(COUNTROWS(Products), ALLEXCEPT(Products, Products[Category]))  with filter Category=Bikes',
    goal: { expected: 3, requires: ['calculate', 'allexcept', 'countrows'] },
    par: 2,
    setupFilters: { 'Products[Category]': 'Bikes' },
  },
  {
    id: 'filter-5',
    name: 'REMOVEFILTERS',
    series: 'Filter context',
    intro: 'Grand total with any City filter removed: CALCULATE(SUM(Sales[Amount]), REMOVEFILTERS(Customer)).',
    why: 'REMOVEFILTERS is the modern name of ALL as a filter modifier. ALL(Table) as a modifier and REMOVEFILTERS(Table) are the same; REMOVEFILTERS reads clearer in CALCULATE.',
    hint: 'CALCULATE(SUM(Sales[Amount]), REMOVEFILTERS(Customer))',
    goal: { expected: 18310, requires: ['calculate', 'removefilters', 'sum'] },
    par: 1,
  },
  {
    id: 'filter-6',
    name: 'TREATAS',
    series: 'Filter context',
    intro: 'Use TREATAS({"Bikes"}, Products[Category]) to force a filter without a relationship.',
    why: 'TREATAS maps an arbitrary table onto a column\'s lineage — the bridge for disconnected tables and CSV slicers.',
    hint: 'CALCULATE(SUM(Sales[Amount]), TREATAS({"Bikes"}, Products[Category]))',
    goal: { expected: 17440, requires: ['treatas', 'calculate', 'sum'] },
    par: 1,
  },

  // ═════════════════════════════ CALCULATE ═══════════════════════════
  {
    id: 'calc-1',
    name: 'Filter argument',
    series: 'CALCULATE',
    intro: 'Total Amount for Products[Category] = "Bikes" using CALCULATE.',
    why: 'CALCULATE evaluates filter arguments in the outer context, then runs the body in the modified context. A boolean equality on a column is the most common filter argument.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes")',
    goal: { expected: 17440, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'calc-2',
    name: 'Context transition',
    series: 'CALCULATE',
    intro: 'SUMX(Products, CALCULATE(SUM(Sales[Amount]))) must equal grand total.',
    why: 'CALCULATE turns the current row into a filter. Summing per-product totals reconstructs the grand total — the fundamental identity of context transition.',
    hint: 'SUMX(Products, CALCULATE(SUM(Sales[Amount])))',
    goal: { expected: 18310, requires: ['calculate', 'sumx'] },
    par: 1,
  },
  {
    id: 'calc-3',
    name: 'Two filter arguments',
    series: 'CALCULATE',
    intro: 'Bikes sold to Seattle customers.',
    why: 'Multiple filter arguments AND together. Order does not matter for AND; each is evaluated in the same outer context.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes", Customer[City] = "Seattle")',
    goal: { expected: 12290, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'calc-4',
    name: 'Intersect filters',
    series: 'CALCULATE',
    intro: 'Set filter Customer[Segment] = "Enterprise", then CALCULATE Amount for City = "Seattle".',
    why: 'CALCULATE filter arguments intersect with the existing filter context by default (AND). Enterprise ∩ Seattle = Contoso only.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Customer[City] = "Seattle")  with filter Segment=Enterprise',
    goal: { expected: 7640, requires: ['calculate', 'sum'] },
    par: 2,
  },
  {
    id: 'calc-5',
    name: 'KEEPFILTERS',
    series: 'CALCULATE',
    intro: 'Same as calc-4 but written with KEEPFILTERS(Customer[City] = "Seattle").',
    why: 'KEEPFILTERS intersects the argument with the existing filter instead of replacing it on that column. For equality filters the result is the same as default AND. It matters for ranges and ALL-inside-KEEPFILTERS.',
    hint: 'CALCULATE(SUM(Sales[Amount]), KEEPFILTERS(Customer[City] = "Seattle"))  with filter Segment=Enterprise',
    goal: { expected: 7640, requires: ['calculate', 'keepfilters', 'sum'] },
    par: 2,
  },
  {
    id: 'calc-6',
    name: 'ALL inside CALCULATE',
    series: 'CALCULATE',
    intro: 'Ratio of Bikes to everything, using ALL(Sales) on the denominator.',
    why: 'CALCULATE(expr, ALL(Table)) ignores filters on Table. This is how you build % of total that survives slicers.',
    hint: 'DIVIDE(CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes"), CALCULATE(SUM(Sales[Amount]), ALL(Products)))',
    goal: { expected: 17440 / 18310, requires: ['divide', 'calculate', 'all'] },
    par: 1,
  },
  {
    id: 'calc-7',
    name: 'CALCULATETABLE',
    series: 'CALCULATE',
    intro: 'Count rows of CALCULATETABLE(Sales, Products[Category] = "Bikes").',
    why: 'CALCULATETABLE is CALCULATE returning a table. Use it when a later expression needs a filtered table, not a scalar.',
    hint: 'COUNTROWS(CALCULATETABLE(Sales, Products[Category] = "Bikes"))',
    goal: { expected: 17, requires: ['calculatetable', 'countrows'] },
    par: 1,
  },
  {
    id: 'calc-8',
    name: 'Nested CALCULATE',
    series: 'CALCULATE',
    intro: 'Inside SUMX(Products, ...), return CALCULATE(SUM(Sales[Amount])) but only for products with Category = "Bikes" — filter the outer Products table.',
    why: 'Filter before iterating. SUMX(FILTER(Products, ...), CALCULATE(SUM(...))) beats filtering inside CALCULATE when the grain is the product.',
    hint: 'SUMX(FILTER(Products, Products[Category] = "Bikes"), CALCULATE(SUM(Sales[Amount])))',
    goal: { expected: 17440, requires: ['sumx', 'filter', 'calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'calc-9',
    name: 'Boolean OR filter',
    series: 'CALCULATE',
    intro: 'Amount for Seattle OR Portland using IN {…}.',
    why: 'IN {a, b} is a single filter argument. Two separate equality arguments would AND, not OR.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Customer[City] IN {"Seattle", "Portland"})',
    goal: { expected: 12600 + 2700, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'calc-10',
    name: 'Context transition cost',
    series: 'CALCULATE',
    intro: 'AVERAGEX(Customer, CALCULATE(SUM(Sales[Amount]))) — average of per-customer totals.',
    why: 'This is NOT AVERAGE(Sales[Amount]). Context transition produces one total per customer, then you average those totals.',
    hint: 'AVERAGEX(Customer, CALCULATE(SUM(Sales[Amount])))',
    goal: { expected: 4577.5, requires: ['averagex', 'calculate', 'sum'] },
    par: 1,
  },

  // ══════════════════════════════ ITERATORS ══════════════════════════
  {
    id: 'iter-1',
    name: 'SUMX',
    series: 'Iterators',
    intro: 'Total of Amount * 2 over every sales row.',
    why: 'SUMX iterates a table with a row context and sums a scalar expression per row.',
    hint: 'SUMX(Sales, Sales[Amount] * 2)',
    goal: { expected: 36620, requires: ['sumx'] },
    par: 1,
  },
  {
    id: 'iter-2',
    name: 'AVERAGEX',
    series: 'Iterators',
    intro: 'Average Amount per sales row.',
    why: 'AVERAGEX(Sales, Sales[Amount]) equals AVERAGE(Sales[Amount]) when the expression is just the column. It diverges when the expression is a formula.',
    hint: 'AVERAGEX(Sales, Sales[Amount])',
    goal: { expected: 18310 / 26, requires: ['averagex'] },
    par: 1,
  },
  {
    id: 'iter-3',
    name: 'EARLIER',
    series: 'Iterators',
    intro: 'MAX over products of: how many products share that product\'s category.',
    why: 'EARLIER(expr) evaluates expr in the parent row context. Without it, both sides of = would be the same (inner) row and FILTER would keep every row.',
    hint: 'MAXX(Products, COUNTROWS(FILTER(ALL(Products), Products[Category] = EARLIER(Products[Category]))))',
    goal: { expected: 3, requires: ['maxx', 'earlier', 'filter', 'all'] },
    par: 1,
  },
  {
    id: 'iter-4',
    name: 'Quantity-weighted anti-pattern',
    series: 'Iterators',
    intro: 'SUMX(Sales, Sales[Quantity] * Sales[Amount]) — do it, then know why it is wrong for revenue.',
    why: 'Amount is already extended (qty * unit - discount). Multiplying by Quantity again double-counts volume. This level exists so you feel the footgun.',
    hint: 'SUMX(Sales, Sales[Quantity] * Sales[Amount])',
    goal: { expected: 26410, requires: ['sumx'] },
    par: 1,
  },
  {
    id: 'iter-5',
    name: 'MINX / MAXX',
    series: 'Iterators',
    intro: 'MAXX over products of total Amount per product (the top product total).',
    why: 'MAXX evaluates the expression per row and takes the max of those scalars — not MAX of a column.',
    hint: 'MAXX(Products, CALCULATE(SUM(Sales[Amount])))',
    goal: { expected: 7640, requires: ['maxx', 'calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'iter-6',
    name: 'COUNTAX',
    series: 'Iterators',
    intro: 'COUNTAX of products whose Amount > 0 (via CALCULATE).',
    why: 'COUNTAX counts rows where the expression is non-blank. Pair it with CALCULATE inside for "how many products sell".',
    hint: 'COUNTAX(Products, IF(CALCULATE(SUM(Sales[Amount])) > 0, 1))',
    goal: { expected: 5, requires: ['countax', 'calculate'] },
    par: 1,
  },

  // ════════════════════════════════ TIME ═════════════════════════════
  {
    id: 'time-1',
    name: 'SAMEPERIODLASTYEAR',
    series: 'Time intelligence',
    intro: 'Amount in the same dates one year earlier.',
    why: 'SAMEPERIODLASTYEAR replaces the date filter with dates shifted -1 year. Empty context over our calendar yields the 2023 slice that lines up.',
    hint: 'CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Calendar[Date]))',
    goal: { expected: 2700, requires: ['calculate', 'sameperiodlastyear'] },
    par: 1,
  },
  {
    id: 'time-2',
    name: 'DATEADD',
    series: 'Time intelligence',
    intro: 'Total Amount for every calendar date shifted +1 month.',
    why: 'DATEADD(dates, n, DAY|MONTH|YEAR) is the general shifter. Prefer it when the offset is not exactly one year.',
    hint: 'CALCULATE(SUM(Sales[Amount]), DATEADD(Calendar[Date], 1, MONTH))',
    goal: { expected: 17310, requires: ['dateadd', 'calculate'] },
    par: 1,
  },
  {
    id: 'time-3',
    name: 'TOTALYTD',
    series: 'Time intelligence',
    intro: 'Year-to-date Amount relative to the latest date in context.',
    why: 'TOTALYTD(expr, dates) filters dates to year-start…max(date). Our latest date is in 2024, so YTD is the 2024 sales slice.',
    hint: 'TOTALYTD(SUM(Sales[Amount]), Calendar[Date])',
    goal: { expected: 15610, requires: ['totalytd'] },
    par: 1,
  },
  {
    id: 'time-4',
    name: 'DATESYTD',
    series: 'Time intelligence',
    intro: 'COUNTROWS(DATESYTD(Calendar[Date])) — how many calendar dates in the YTD window.',
    why: 'DATESYTD returns a table of dates. Put it inside CALCULATE when you need a filter, or COUNTROWS it to inspect the window.',
    hint: 'COUNTROWS(DATESYTD(Calendar[Date]))',
    goal: { expected: 30, requires: ['datesytd', 'countrows'] },
    par: 1,
  },
  {
    id: 'time-5',
    name: 'DATESMTD',
    series: 'Time intelligence',
    intro: 'Amount using DATESMTD(Calendar[Date]) as the filter.',
    why: 'MTD is the month of the max date in context. Max date is 2024-06-28, so June 2024 sales.',
    hint: 'CALCULATE(SUM(Sales[Amount]), DATESMTD(Calendar[Date]))',
    goal: { expected: 1830, requires: ['datesmtd', 'calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'time-6',
    name: 'DATESQTD',
    series: 'Time intelligence',
    intro: 'Amount using DATESQTD(Calendar[Date]).',
    why: 'QTD of max date 2024-06-28 is Q2 2024 (Apr–Jun).',
    hint: 'CALCULATE(SUM(Sales[Amount]), DATESQTD(Calendar[Date]))',
    goal: { expected: 8550, requires: ['datesqtd', 'calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'time-7',
    name: 'Prior-year total',
    series: 'Time intelligence',
    intro: 'Using Year=2024 as external filter, return SPLY amount (should be the 2023 slice).',
    why: 'With Year=2024 on Calendar, SPLY still replaces the date column and lands on 2023. This is the classic "was same-period last year" measure.',
    hint: 'CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Calendar[Date]))  with filter Calendar[Year]=2024',
    goal: { expected: 2700, requires: ['calculate', 'sameperiodlastyear', 'sum'] },
    par: 2,
    setupFilters: { 'Calendar[Year]': 2024 },
  },

  // ═════════════════════════════ RANKING ═════════════════════════════
  {
    id: 'rank-1',
    name: 'RANKX basic',
    series: 'Ranking',
    intro: 'Inside SUMX(Products, ...) return RANKX(ALL(Products), CALCULATE(SUM(Sales[Amount]))) for Contoso\'s top product — simpler: rank of product key 1 by amount.',
    why: 'RANKX(table, expr, [value], [order]) ranks the current row\'s expression value within table. Use ALL to ignore outer filters on the ranking set.',
    hint: 'RANKX(ALL(Products), CALCULATE(SUM(Sales[Amount])), CALCULATE(SUM(Sales[Amount])))  with filter Products[ProductKey]=1',
    goal: { expected: 1, requires: ['rankx', 'all', 'calculate'] },
    par: 2,
    setupFilters: { 'Products[ProductKey]': 1 },
  },
  {
    id: 'rank-2',
    name: 'TOPN city',
    series: 'Ranking',
    intro: 'Amount for the customer city with the highest total.',
    why: 'TOPN(1, VALUES(city), orderByExpr) + CALCULATE is the classic "top N" pattern. ORDER is DESC by default.',
    hint: 'CALCULATE(SUM(Sales[Amount]), TOPN(1, VALUES(Customer[City]), CALCULATE(SUM(Sales[Amount]))))',
    goal: { expected: 12600, requires: ['topn', 'calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'rank-3',
    name: 'Top product amount',
    series: 'Ranking',
    intro: 'The amount of the best-selling product (by Amount).',
    why: 'MAXX(Products, CALCULATE(SUM(...))) equals the top product total — often simpler than TOPN+CALCULATE.',
    hint: 'MAXX(Products, CALCULATE(SUM(Sales[Amount])))',
    goal: { expected: 7640, requires: ['maxx', 'calculate', 'sum'] },
    par: 1,
  },

  // ═══════════════════════════ VERTIPAQ ══════════════════════════════
  {
    id: 'vpq-1',
    name: 'Why star schema',
    series: 'VertiPaq & model',
    intro: 'Count rows of Sales only for the Bikes category using the expanded table — then state (in your head) why a star beats a single flat table for this.',
    why: 'VertiPaq compresses columns, not rows. Narrow dimension tables + integer FKs beat a single fat table. Filter propagation along relationships is cheap; crossfilter is not.',
    hint: 'COUNTROWS(FILTER(Sales, Products[Category] = "Bikes"))',
    goal: { expected: 17, requires: ['countrows', 'filter'] },
    par: 1,
  },
  {
    id: 'vpq-2',
    name: 'Prefer columns to rows',
    series: 'VertiPaq & model',
    intro: 'DISTINCTCOUNT of CustomerKey on Sales vs COUNTROWS(VALUES(Customer[CustomerKey])) — use DISTINCTCOUNT on the fact FK.',
    why: 'Value counts on a highly compressed column are cheap. Scanning many rows of strings is not. When the fact already has the key, aggregate it there.',
    hint: 'DISTINCTCOUNT(Sales[CustomerKey])',
    goal: { expected: 4, requires: ['distinctcount'] },
    par: 1,
  },

  // ═══════════════════════════ CHALLENGES ════════════════════════════
  {
    id: 'chal-1',
    name: 'Bikes in Seattle',
    series: 'Challenges',
    intro: 'Amount for Bikes sold to Seattle customers.',
    why: 'Two dimensions, one CALCULATE. If you need RELATED or FILTER, you are working harder than necessary.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Products[Category] = "Bikes", Customer[City] = "Seattle")',
    goal: { expected: 12290, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'chal-2',
    name: 'Accessories share',
    series: 'Challenges',
    intro: 'Share of Amount from Accessories.',
    why: 'DIVIDE + two CALCULATEs. Remember Accessories is the small slice (~870).',
    hint: 'DIVIDE(CALCULATE(SUM(Sales[Amount]), Products[Category] = "Accessories"), SUM(Sales[Amount]))',
    goal: { expected: 870 / 18310, requires: ['divide', 'calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'chal-3',
    name: 'Seattle product spread',
    series: 'Challenges',
    intro: 'MAX Amount - MIN Amount within Seattle only.',
    why: 'Same as basics-6 but under a CALCULATE filter. Aggregators respect filter context automatically — no SUMX required.',
    hint: 'CALCULATE(MAX(Sales[Amount]) - MIN(Sales[Amount]), Customer[City] = "Seattle")',
    goal: { expected: 1860, requires: ['calculate', 'max', 'min'] },
    par: 1,
  },
  {
    id: 'chal-4',
    name: 'Enterprise Contoso total',
    series: 'Challenges',
    intro: 'Amount for Contoso (Enterprise, Seattle) — verify it equals the Enterprise∩Seattle number.',
    why: 'Sanity checks are a skill. If two paths disagree, your mental model of filters is wrong.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Customer[Customer] = "Contoso")',
    goal: { expected: 7640, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'chal-5',
    name: '2023 vs 2024',
    series: 'Challenges',
    intro: '2024 Amount minus 2023 Amount.',
    why: 'Year intelligence via Calendar[Year] filter arguments, not string dates. The date table is the filter engine.',
    hint: 'CALCULATE(SUM(Sales[Amount]), Calendar[Year] = 2024) - CALCULATE(SUM(Sales[Amount]), Calendar[Year] = 2023)',
    goal: { expected: 12910, requires: ['calculate', 'sum'] },
    par: 1,
  },
  {
    id: 'chal-6',
    name: 'Customers with bikes',
    series: 'Challenges',
    intro: 'How many customers bought at least one Bike?',
    why: 'Iterate Customer with context transition, then test the related fact. COUNTAX counts non-blank results.',
    hint: 'COUNTAX(Customer, IF(CALCULATE(SUMX(FILTER(Sales, Products[Category] = "Bikes"), Sales[Amount])) > 0, 1))',
    goal: { expected: 4, requires: ['countax', 'calculate', 'filter', 'sumx'] },
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
