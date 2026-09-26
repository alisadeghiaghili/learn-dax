/**
 * Contoso-lite star schema with deterministic rows.
 *
 * Tables: Calendar, Products, Customer (dims) → Sales (fact).
 * Relationships are single-direction (dim → fact).
 */

/**
 * @typedef {object} ColumnDef
 * @property {string} name
 * @property {'number'|'string'|'date'} type
 * @property {boolean} [isKey]
 */

/**
 * @typedef {object} TableDef
 * @property {string} name
 * @property {'fact'|'dim'} role
 * @property {ColumnDef[]} columns
 * @property {Record<string, unknown>[]} rows
 */

/**
 * @typedef {object} RelationshipDef
 * @property {string} fromTable
 * @property {string} fromColumn
 * @property {string} toTable
 * @property {string} toColumn
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** @returns {string} ISO date */
function iso(y, m, d) {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function buildCalendar() {
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  const months = [];
  for (let y = 2023; y <= 2024; y += 1) {
    const lastM = y === 2024 ? 6 : 12;
    for (let m = 1; m <= lastM; m += 1) months.push([y, m]);
  }
  for (const [y, m] of months) {
    for (const d of [1, 8, 15, 22, 28]) {
      rows.push({
        Date: iso(y, m, d),
        Year: y,
        Month: m,
        MonthName: MONTHS[m - 1],
        Quarter: `Q${Math.ceil(m / 3)}`,
      });
    }
  }
  return rows;
}

const products = [
  { ProductKey: 1, Product: 'Road-100 Red', Category: 'Bikes', Subcategory: 'Road', Price: 1000 },
  { ProductKey: 2, Product: 'Road-200 Blue', Category: 'Bikes', Subcategory: 'Road', Price: 800 },
  { ProductKey: 3, Product: 'Mountain-100', Category: 'Bikes', Subcategory: 'Mountain', Price: 700 },
  { ProductKey: 4, Product: 'Cable Lock', Category: 'Accessories', Subcategory: 'Locks', Price: 20 },
  { ProductKey: 5, Product: 'Sport-100 Helmet', Category: 'Accessories', Subcategory: 'Helmets', Price: 50 },
];

const customers = [
  { CustomerKey: 1, Customer: 'Contoso', Segment: 'Enterprise', City: 'Seattle' },
  { CustomerKey: 2, Customer: 'Litware', Segment: 'SMB', City: 'Portland' },
  { CustomerKey: 3, Customer: 'Fabrikam', Segment: 'SMB', City: 'Seattle' },
  { CustomerKey: 4, Customer: 'Northwind', Segment: 'SMB', City: 'Chicago' },
];

/**
 * Deterministic sales fact table.
 * Amount is Quantity * unit-ish price so goals stay exact.
 * @returns {Record<string, unknown>[]}
 */
function buildSales() {
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  let id = 1;
  // (date, product, customer, qty, unit, discount)
  /** @type {[string, number, number, number, number, number][]} */
  const plan = [
    [iso(2023, 1, 8), 1, 1, 1, 1000, 0],
    [iso(2023, 2, 15), 2, 1, 2, 800, 0],
    [iso(2023, 2, 22), 5, 2, 2, 50, 0],
    [iso(2024, 1, 8), 1, 2, 1, 1000, 50],
    [iso(2024, 1, 15), 3, 3, 1, 700, 0],
    [iso(2024, 1, 22), 4, 4, 3, 20, 0],
    [iso(2024, 2, 1), 2, 1, 1, 800, 0],
    [iso(2024, 2, 8), 5, 3, 4, 50, 10],
    [iso(2024, 2, 15), 1, 4, 1, 1000, 0],
    [iso(2024, 2, 22), 3, 1, 2, 700, 0],
    [iso(2024, 3, 1), 4, 2, 5, 20, 0],
    [iso(2024, 3, 8), 2, 3, 1, 800, 40],
    [iso(2024, 3, 15), 1, 1, 1, 1000, 0],
    [iso(2024, 3, 22), 5, 4, 2, 50, 0],
    [iso(2024, 4, 1), 3, 2, 1, 700, 0],
    [iso(2024, 4, 8), 1, 3, 2, 1000, 100],
    [iso(2024, 4, 15), 2, 4, 1, 800, 0],
    [iso(2024, 4, 22), 4, 1, 2, 20, 0],
    [iso(2024, 5, 1), 5, 2, 3, 50, 0],
    [iso(2024, 5, 8), 1, 4, 1, 1000, 0],
    [iso(2024, 5, 15), 3, 3, 2, 700, 70],
    [iso(2024, 5, 22), 2, 1, 1, 800, 0],
    [iso(2024, 6, 1), 4, 3, 4, 20, 0],
    [iso(2024, 6, 8), 1, 1, 1, 1000, 0],
    [iso(2024, 6, 15), 5, 4, 1, 50, 0],
    [iso(2024, 6, 22), 3, 2, 1, 700, 0],
  ];

  for (const [date, productKey, customerKey, qty, unit, discount] of plan) {
    const amount = qty * unit - discount;
    rows.push({
      SaleID: id,
      Date: date,
      ProductKey: productKey,
      CustomerKey: customerKey,
      Quantity: qty,
      Amount: amount,
      Discount: discount,
    });
    id += 1;
  }
  return rows;
}

/** @type {TableDef[]} */
export const tables = [
  {
    name: 'Calendar',
    role: 'dim',
    columns: [
      { name: 'Date', type: 'date', isKey: true },
      { name: 'Year', type: 'number' },
      { name: 'Month', type: 'number' },
      { name: 'MonthName', type: 'string' },
      { name: 'Quarter', type: 'string' },
    ],
    rows: buildCalendar(),
  },
  {
    name: 'Products',
    role: 'dim',
    columns: [
      { name: 'ProductKey', type: 'number', isKey: true },
      { name: 'Product', type: 'string' },
      { name: 'Category', type: 'string' },
      { name: 'Subcategory', type: 'string' },
      { name: 'Price', type: 'number' },
    ],
    rows: products.map((r) => ({ ...r })),
  },
  {
    name: 'Customer',
    role: 'dim',
    columns: [
      { name: 'CustomerKey', type: 'number', isKey: true },
      { name: 'Customer', type: 'string' },
      { name: 'Segment', type: 'string' },
      { name: 'City', type: 'string' },
    ],
    rows: customers.map((r) => ({ ...r })),
  },
  {
    name: 'Sales',
    role: 'fact',
    columns: [
      { name: 'SaleID', type: 'number', isKey: true },
      { name: 'Date', type: 'date' },
      { name: 'ProductKey', type: 'number' },
      { name: 'CustomerKey', type: 'number' },
      { name: 'Quantity', type: 'number' },
      { name: 'Amount', type: 'number' },
      { name: 'Discount', type: 'number' },
    ],
    rows: buildSales(),
  },
];

/** @type {RelationshipDef[]} */
export const relationships = [
  { fromTable: 'Sales', fromColumn: 'ProductKey', toTable: 'Products', toColumn: 'ProductKey' },
  { fromTable: 'Sales', fromColumn: 'CustomerKey', toTable: 'Customer', toColumn: 'CustomerKey' },
  { fromTable: 'Sales', fromColumn: 'Date', toTable: 'Calendar', toColumn: 'Date' },
];

/**
 * @param {string} name
 * @returns {TableDef}
 */
export function getTable(name) {
  const t = tables.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  if (!t) {
    throw new Error(`Unknown table '${name}'`);
  }
  return t;
}

/**
 * @param {string} table
 * @param {string} column
 * @returns {ColumnDef}
 */
export function getColumn(table, column) {
  const t = getTable(table);
  const c = t.columns.find((x) => x.name.toLowerCase() === String(column).toLowerCase());
  if (!c) {
    throw new Error(`Unknown column '${table}[${column}]'`);
  }
  return c;
}

/**
 * Relationships where `table` is on the many (from) side.
 * @param {string} table
 * @returns {RelationshipDef[]}
 */
export function manySideRelationships(table) {
  return relationships.filter((r) => r.fromTable.toLowerCase() === table.toLowerCase());
}

/**
 * Relationships where `table` is on the one (to/dim) side.
 * @param {string} table
 * @returns {RelationshipDef[]}
 */
export function oneSideRelationships(table) {
  return relationships.filter((r) => r.toTable.toLowerCase() === table.toLowerCase());
}

/**
 * Full column identity `Table[Column]`.
 * @param {string} table
 * @param {string} column
 * @returns {string}
 */
export function colId(table, column) {
  return `${table}[${column}]`;
}

/**
 * Parse `Table[Column]` into parts. Case-insensitive table/column match later.
 * @param {string} id
 * @returns {{ table: string, column: string }}
 */
export function parseColId(id) {
  const m = /^(.+)\[(.+)\]$/.exec(id.trim());
  if (!m) {
    throw new Error(`Invalid column reference '${id}'`);
  }
  return { table: m[1], column: m[2] };
}

/**
 * Resolve a possibly case-variant column id to canonical `Table[Column]`.
 * @param {string} id
 * @returns {string}
 */
export function canonicalColId(id) {
  const { table, column } = parseColId(id);
  const t = getTable(table);
  const c = getColumn(t.name, column);
  return colId(t.name, c.name);
}
