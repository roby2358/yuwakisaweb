# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

JSON Facts: a browser-based Prolog playground that converts JSON into facts and queries them with a Markdown-flavored Prolog syntax. No build step, no dependencies — open `index.html` in a browser.

## Architecture

Three files loaded in strict order via `<script>` tags (globals, not ES modules):

1. **interpreter.js** — The Prolog engine. Defines all core primitives (`node`, `isVar`, `deref`, `unify`), the Markdown parser (`parseMarkdown`), the solver (`makeSolver`), builtins (`makeBuiltins`), query execution, formatting, and the standard library (`STDLIB`). Everything else depends on this file.

2. **json_parser.js** — Converts JSON objects into the same `{ name, clauses }` entry format the Markdown parser produces. Depends on `node` and `buildConsList` from interpreter.js.

3. **index.js** — UI controller. Wires up DOM elements, manages examples, runs queries by combining JSON + Markdown entries into a unified database. Depends on everything above.

### Key Data Shape

All terms use `{ value, children }` nodes. Variables have `value: { var: 'Name' }`. Lists are cons cells: `node('.', [head, tail])` with `node('[]')` for empty. Substitutions are immutable `Map` instances.

Parsers (both JSON and Markdown) produce arrays of `{ name, clauses }` entries. Each clause has `{ headArgs, body }` (for rules/facts) or `{ goals }` (for queries). The database indexes by `name/arity` string keys.

## Development

No build, no tests, no linter. To develop: edit files, refresh browser.

## Conventions

- No build tooling — plain browser JS with global scope
- Script load order matters — do not reorder `<script>` tags or convert to ES modules without updating all three files
- Both parsers must produce the same entry shape so they merge seamlessly in `buildDatabase`
- Backtick literals in Markdown Prolog (`` `90000` ``) distinguish literal values from variable names
- The `#` heading in Markdown Prolog defines predicate names; `# ?` defines queries
