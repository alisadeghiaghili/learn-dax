# learnDax — Design Notes

## Product model (from learnGitBranching)

learnGitBranching teaches git by making invisible repository state visible. A command
stream mutates a graph; levels constrain the graph to a goal; sandbox is free play.

learnDax applies the same loop to DAX:

| LGB | learnDax |
| --- | --- |
| Commit tree | Star-schema model + filter context + evaluation result |
| `git` commands | DAX expressions + meta-commands (`eval`, `show`, `levels`, …) |
| Levels / target tree | Levels with expected scalar/table + optional required functions |
| Git golf | Command golf (fewest evals / meta-commands) |
| Sandbox | Free evaluation on the sample Contoso-lite model |
| undo / reset | undo / reset |

100% client-side. No backend. Static `index.html` + ES modules.

## Scope of the DAX engine

Full DAX is out of scope. The engine implements a teaching subset that covers
the concepts that actually confuse people:

- Scalars, identifiers (`Table[Col]`, measures), operators, `IN`
- Aggregators: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `DISTINCTCOUNT`, `COUNTROWS`
- Iterators: `SUMX`, `AVERAGEX`, `MINX`, `MAXX`, `COUNTX`, `COUNTAX`
- Table functions: `FILTER`, `ALL`, `ALLEXCEPT`, `VALUES`, `DISTINCT`, `SELECTCOLUMNS`,
  `ADDCOLUMNS`, `SUMMARIZE`, `CROSSJOIN`, `TOPN`, `GENERATESERIES`, `RELATED`, `RELATEDTABLE`
- Context: `CALCULATE`, `CALCULATETABLE`, `KEEPFILTERS`
- Row: `EARLIER`, `EARLIEST` (row-context stack)
- Logic: `IF`, `SWITCH`, `NOT`, `&&`, `||`, `IN`, `NOT IN`
- Math/string: `DIVIDE`, `ABS`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `INT`,
  `CONCATENATE`, `UPPER`, `LOWER`, `LEN`, `FORMAT` (minimal)
- Time: `DATE`, `YEAR`, `MONTH`, `DAY`, `DATEADD`, `DATESBETWEEN`, `TOTALYTD`,
  `SAMEPERIODLASTYEAR`
- `VAR` / `RETURN`
- Measures (`Name := expr` or `Name = expr` via `measure`)
- Calculated columns (`column Table[Col] = expr`)

Deliberately omitted: `LOOKUPVALUE`, `RANKX` (partial via `TOPN` only), windowing,
`PATH`, `TREATAS` (stated as unsupported), full blank-propagation semantics,
auto-exist, bidirectional cross-filter.

## Data model (Contoso-lite)

Star schema with deterministic rows so every level has a fixed expected value:

- `Calendar` (1) — `Date`, `Year`, `Month`, `MonthName`, `Quarter`
- `Products` (1) — `ProductKey`, `Product`, `Category`, `Subcategory`, `Price`
- `Customer` (1) — `CustomerKey`, `Customer`, `Segment`, `City`
- `Sales` (*) — `SaleID`, `Date`, `ProductKey`, `CustomerKey`, `Quantity`, `Amount`, `Discount`

Relationships (single direction, dim → fact):

- `Sales[ProductKey]` → `Products[ProductKey]`
- `Sales[CustomerKey]` → `Customer[CustomerKey]`
- `Sales[Date]` → `Calendar[Date]`

## Evaluation model

- **Filter context** — map `Table[Column] → {op, values}` plus explicit `ALL` marks.
  Propagates across relationships dim → fact before touching fact rows.
- **Row context** — stack of current rows (iterators, `FILTER`, calculated columns).
  `CALCULATE` performs context transition: the current row becomes filters.
- **Values** — JavaScript numbers, strings, booleans, `BLANK` (`null`), or a table
  `{columns, rows}`.

## UI system

Style anchor: analytical console × puzzle game — Power BI model view precision,
LGB's terminal-and-graph loop, typographic density of a market terminal.

Palette: background `#0A0F1A`, surface `#111827`, ink `#E8EEF8`, muted `#8B9BB4`,
accent gold `#F2C811` (Power BI), signal cyan `#3DC9F5`, row-context `#6C8CFF`,
filter-context `#FFB020`, success `#3DDC97`, error `#FF6B6B`.

Type: `Segoe UI` / `Inter` / system-ui for chrome; `Cascadia Code` / `JetBrains Mono` /
`ui-monospace` for DAX and terminal.

Layout: top bar → split (model graph + filter chips | result + expression) →
bottom terminal. Spacing 4/8/12/16/24/32. Dense grids, generous viz chrome.

Signature moments:

1. **Filter pulse** — filters fly onto the star schema; relationship edges light gold
   along the path to `Sales`.
2. **Result materialize** — scalars settle; table rows stagger in.

## Level series

1. Basics — column refs, `SUM`, arithmetic
2. Filter context — `FILTER`, `VALUES`, `ALL`
3. `CALCULATE` — filter arguments, context transition
4. Iterators — `SUMX`, row context, `EARLIER`
5. Time intelligence — `DATEADD`, `SAMEPERIODLASTYEAR`, `TOTALYTD`
6. Challenges — mixed business questions

Each level: `id`, `name`, `intro`, `hint`, `setup` (optional external filters /
seed measures), `goal` with `expected` and optional `requires` (function names).

## Commands

```
help
levels
level <n>
eval <dax>          # also: just paste a DAX expression
measure Name = expr
column Table[Col] = expr
show model|tables|<Table>
filter Table[Col] = value | filter clear
goal
hint
undo
reset
```

## Tests

Node's built-in `node:test` over the engine (lexer/parser/eval, filter propagation,
`CALCULATE`, iterators). UI is exercised manually / via static preview.

## Non-goals

- Production-grade DAX parity with SSAS / Power BI
- Persistence across devices (localStorage only for solved levels / golf)
- i18n (English UI copy; Persian conversation is outside the repo)
