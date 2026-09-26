# Architecture

## Overview

```
UI (terminal, graph, result)
        │
        ▼
Session  ── commands, undo stack, level runner
        │
        ▼
Engine   ── parse → evaluate(DAX AST, FilterContext, RowContext stack)
        │
        ▼
Model    ── tables, rows, relationships
```

## Engine contracts

### `parseDax(source: string) -> Ast`

Raises `DaxSyntaxError` with `position` and `message`.

### `evaluate(ast, env) -> Value`

`Env`:

```js
{
  model,               // immutable schema + row data
  filterContext,       // FilterContext
  rowContexts,         // RowContext[] (stack, top is current)
  measures,            // Map<string, Ast>
  variables            // Map<string, Value> (VAR scope)
}
```

`Value` is one of:

- `{ kind: 'scalar', type: 'number'|'string'|'boolean'|'date'|'blank', value }`
- `{ kind: 'table', columns: string[], rows: object[] }`  
  column names are `Table[Column]` when produced from model tables

### FilterContext

```js
{
  filters: Map<'Table[Column]', { op: 'in'|'all', values: any[] }>,
  keep: Set<'Table[Column]'>   // KEEPFILTERS markers (intersection semantics)
}
```

Propagation: before reading `Sales`, walk relationships and intersect
many-side filters with dim filters.

### Context transition (`CALCULATE`)

1. Snapshot filter context.
2. For each `rowContext` frame, push `Table[Column] = value` filters.
3. Evaluate each filter argument in the *original* filter context (boolean or table).
4. Intersect (or replace for `ALL(...)` / bare `ALL`) those filters.
5. Evaluate the body under the new filter context with an empty row stack (unless
   `KEEPFILTERS` keeps prior filters).

## Level runner

```js
{
  id, name, intro, hint,
  setup?: { filters?, measures? },
  goal: {
    expression?: string,     // DAX to evaluate after student work
    expected: ValueSnapshot, // scalar number/string/bool or table hash
    requires?: string[],     // AST must contain these function names (case-insensitive)
  },
  par?: number               // golf: target command count
}
```

Solve condition: student's submitted expression (or named measure result) matches
`expected`, and `requires` functions appear in the submitted AST when specified.

## Persistence

`localStorage['learnDax.progress']` → `{ solved: { [levelId]: { commands, best } } }`.

## Error model

- `DaxSyntaxError` — parse failure
- `DaxEvalError` — unknown identifier, type error, unsupported function
- `CommandError` — meta-command misuse

All print to the terminal in error style; evaluation state is not mutated on failure
for `eval`, but mutating commands (`measure`, `column`, `filter`, `level`) snapshot
into the undo stack only after success.
