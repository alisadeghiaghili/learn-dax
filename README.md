# learnDax

An interactive DAX visualizer, sandbox, and series of tutorial challenges.
Inspired by the teaching loop of [learnGitBranching](https://github.com/pcottle/learnGitBranching):
make invisible state visible, then play levels against a goal.

**Live:** https://alisadeghiaghili.github.io/learn-dax/

100% client-side. No backend. Open `index.html` locally, or use the GitHub Pages link above.

## What you get

- **Sandbox** — type DAX against a Contoso-lite star schema and watch the evaluation
  result update the model graph and filter context.
- **Levels** — challenges that force the concept (filter context, `CALCULATE`,
  iterators, time intelligence). Expected values are fixed on deterministic data.
- **Golf** — fewest commands to clear a level.
- **undo / reset** — same muscle memory as learnGitBranching.

## Commands

| Command | Meaning |
| --- | --- |
| `help` | List commands |
| `levels` | List levels and solve state |
| `level <n>` | Start a level |
| `eval <dax>` | Evaluate a DAX expression |
| `measure Name = expr` | Define a measure |
| `column Table[Col] = expr` | Define a calculated column |
| `show model` \| `show <Table>` | Show schema or table rows |
| `filter Table[Col] = value` | Set an external filter (visual filter context) |
| `filter clear` | Clear external filters |
| `goal` | Restate the level goal |
| `hint` | Reveal a hint |
| `undo` | Undo last mutating command |
| `reset` | Reset model / level state |

You can also paste a raw DAX expression; it is treated as `eval`.

## Engine scope

Teaching subset of DAX (see `DESIGN.md`): aggregators, iterators, `FILTER`/`ALL`/`VALUES`,
`CALCULATE` / context transition, `EARLIER`, basic time intelligence, `VAR`/`RETURN`,
measures and calculated columns.

This is not a Power BI / SSAS replacement. Blank semantics, auto-exist, and several
table functions are simplified or omitted.

## Development

```bash
npm test          # engine unit tests (node:test)
npm run dev       # static file server on :5173
```

## Project layout

```
index.html
src/
  data/model.js       sample model + relationships
  engine/             lexer, parser, context, functions, evaluator
  levels/definitions.js
  ui/                 terminal, model graph, result, levels, app
  styles/app.css
tests/engine.test.js
docs/architecture.md
```

## License

MIT
