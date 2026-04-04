# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MarkdownIsAPrologue — a Prolog interpreter that uses Markdown as its source syntax. Companion to MarkdownIsALISP. Runs entirely in-browser with no build step, no dependencies, no frameworks.

## Running

Open `index.html` in a browser. No build, no server required. Ctrl+Enter runs the program from the editor.

## Architecture

Two files, mirroring MIAL's structure:

- **`interpreter.js`** — the complete Prolog engine: parser, unifier, solver, builtins, stdlib. Exposes `runMarkdownIsAPrologue(code, logFn, traceFn)` as the single entry point. Loaded as a plain script (not ES module despite the spec saying so).
- **`index.js`** — UI controller. Wires up the editor, example programs, console output, and trace panel. Calls `runMarkdownIsAPrologue` on run.

### Interpreter internals

All terms use the same `{ value, children }` node shape as MIAL. Variables are `{ value: { var: 'X' }, children: [] }`. Lists are cons cells: `node('.', [head, tail])` with `node('[]')` for empty.

Key sections in `interpreter.js` (top to bottom):
1. **Nodes & helpers** — `node()`, `isVar()`, `NUM_RE`
2. **Parser** — `parseMarkdown()` turns Markdown into predicate entries. `splitAtDepth0` handles nesting-aware splitting. `parseTerm`/`parseGoal`/`parseArgList` handle inline syntax.
3. **Unification** — immutable substitution maps (Map). `deref` walks binding chains, `deepDeref` fully resolves, `unify` returns new Map or null.
4. **Variable freshening** — `freshenClause` renames variables with `__N` suffixes per clause attempt.
5. **Formatting** — `formatTerm`/`formatGoal` for output display.
6. **Database** — `buildDatabase` groups clauses by `name/arity` key.
7. **Arithmetic** — `evalArith` walks term trees as expression trees. `ARITH_OPS` for `+`, `-`, `*`, `//`, `mod`.
8. **Builtins** — `makeBuiltins(logFn)` returns a Map of `key → (args, subst) → subst|null`. Builtins access `.value` directly on terms, no unwrapper functions.
9. **Solver** — generator-based (`function*`) depth-first search. `makeSolver` returns a function that yields substitutions. Cut sets a flag checked by the clause loop. Not uses negation-as-failure.
10. **Stdlib** — `append`, `member`, `length` defined as Markdown Prolog, prepended to user code.
11. **Runner** — `runMarkdownIsAPrologue` parses stdlib+user code, builds DB, runs queries.

### Markdown-to-Prolog mapping

- `# heading` → predicate name
- Top-level `*` bullet → clause (multiple = disjunction)
- Bullet content → head arguments (predicate name comes from heading)
- Sub-bullets → body goals (conjunction)
- `# ?` section → queries (each bullet is a query)
- Body goal syntax: first word = predicate name, rest = arguments

## Conventions

- No tests in this project
- Vanilla JS, no build tools, no npm
- Named `const` arrow functions with separate `addEventListener` binding (not inline anonymous handlers)
- Builtins access `.value` directly on node terms — no universal unwrapper/helper functions
- Prefer the simplest clean fix over broader structural changes
