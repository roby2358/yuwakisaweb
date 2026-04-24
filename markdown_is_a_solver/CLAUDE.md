# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Markdown Is A Solver (MIAS) is a **browser-only** SMT playground. JSON facts + Markdown constraints → Z3 WASM → sat/unsat + model. No server, no data exfiltration. See `SPEC.md` for the authoritative spec and `PROBLEM_STATEMENT.md` for origin context.

Deploys as a subpath of a parent Cloudflare Pages project (`yuwakisaweb.pages.dev/markdown_is_a_solver/`) via `git push` — there is no MIAS-specific deploy script. The Z3 WASM (~32MB) lives on R2 (`mias-wasm` bucket), not in the repo.

## Commands

- `npm run serve` — local dev server on `http://localhost:8181` with COOP/COEP headers required for `SharedArrayBuffer`. Use this instead of IntelliJ's preview or any plain static server; without the headers, `solver.check()` fails at pthread creation.
- `npm run bundle` — regenerate `vendor/z3-bundle.js` from `scripts/entry.js` via esbuild. Only needed when bumping `z3-solver` or changing the entry shim. Also copies `z3-built.wasm` into `vendor/` for upload.
- `npm run upload` — run `scripts/upload.sh` to (re)upload the WASM to R2 with CORS + long-cache headers. Requires `wrangler login`.

No test suite, no linter. No runtime build step for application code.

## Architecture

The pipeline is a straight line: **parse → compile → solve**, with a uniform AST as the seam between parse and compile.

### AST shape (the contract between modules)

The shape is the same one MIAL (sibling `markdown_is_a_lisp`) uses: `{ value, children }`. Atoms have `children.length === 0`; compounds have `children.length > 0` and `value` is the operator name.

```
node(value, children)
  value: 'port'                 — symbol reference (string, no children)
  value: 443                    — Int literal (integer JS number, no children)
  value: 0.1                    — Real literal (fractional JS number, no children)
  value: true | false           — Bool literal
  value: { string: 'healthy' }  — String literal
  value: 'and', children: [...] — compound (string value + non-empty children)
```

Sort is not tagged onto literals — the compiler infers it from the JS type. Defined in `parser.js`. The compiler walks this shape and nothing else. JSON and Markdown halves compose cleanly because they produce the same shape.

### parser.js

Two halves merged into one program `{ declarations, assertions }`:
- **JSON half**: every primitive becomes a typed declared constant. Sort inferred from JSON shape; `_types` sibling object overrides per-field. Nested objects flatten with dot notation (`security_group.ingress.port`). Arrays and `null` are rejected in v1.
- **Markdown half**: sections `# declare`, `# assert`, `# check`. MIAL-style bullet trees — nesting IS the expression tree. A bullet line's first token is the node's value; further tokens on the same line are flat children (compact form); indented sub-bullets become additional children. Either `*` or `-` MAY be the bullet marker. Backticks wrap literals (`` `443` `` → Int, `` `0.1` `` → Real, `` `true` `` → Bool, `` `"hello"` `` or `` `0.0.0.0/0` `` → String). Declarations put the sort first: `* Int alice bob carol` declares three Ints. Each top-level bullet under `# assert` is exactly one assertion — sibling bullets are NOT implicitly conjoined (use an explicit `and`). Exactly one `# check` section, no bullets under it.

A name declared in both JSON and Markdown is a hard error (no silent shadowing).

### compiler.js

Tree walker that calls the **z3-solver direct API** — `ctx.Int.const`, `expr.eq`, `ctx.And`, `ctx.If`, `ctx.Distinct`, etc. **Never** `eval_smtlib2_string` or any SMT-LIB text entry point. This is the defining architectural property of the project.

Sort correctness and operator arity are validated **before** any solver call (there is no SMT-LIB round-trip to catch errors). Int auto-promotes to Real in mixed arithmetic, comparisons, equality, and `ite` branches; `mod` is Int-only.

Uses `solver.addAndTrack(expr, label)` for every JSON-derived equality and every Markdown assertion, so `solver.unsatCore()` can be rendered back as original source text via the `labels` map returned from `compile()`.

### index.js

UI glue: three-pane layout, example loading, Run button. Dynamic-imports the vendored Z3 bundle, passes `locateFile` pointing at `Z3_WASM_URL` from `config.js`, passes `mainScriptUrlOrBlob` pointing at the bundle's own URL. A fresh `Context('main')` is created per page load; see SPEC "Implementation Notes" for why a fresh context per Run was considered but isn't currently the case.

### vendor/z3-bundle.js (the tricky one)

Built by `scripts/bundle.mjs` from `scripts/entry.js`. Must be an **IIFE**, not an ES module — emscripten's pthread runtime spawns workers via plain `new Worker(url)` (no `{ type: 'module' }`), so `export` / `import.meta` would be syntax errors in the worker context. The IIFE exposes `init` on `globalThis.MiasZ3` and is loaded by `index.html` via a classic `<script>` tag **before** `index.js`.

The entry shim (`scripts/entry.js`) exists because the stock `z3-solver/build/browser.js` `init()` ignores module overrides — `locateFile` and `mainScriptUrlOrBlob` never reach emscripten through it. The shim calls the low-level init with a factory closure that carries the caller's overrides.

### Cross-origin isolation

The page requires `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` to get `SharedArrayBuffer`, which pthreaded Z3 needs. In production these come from the parent `yuwakisaweb/_headers` scoped to `/markdown_is_a_solver/*`. Locally they come from `scripts/serve.mjs`. Any server without these headers will appear to load fine and then fail opaquely at `solver.check()`.

## SMT subset (v1)

QF_LIRA + Bool + string equality. Sorts: `Int`, `Real`, `Bool`, `String`. Ops: `and/or/not/implies/iff/ite`, `=/distinct`, `+/-/*/mod/<,<=,>,>=`, `/` over Real. Arrays, bitvectors, UFs, datatypes, and quantifiers are deferred; the compiler's `buildOp` switch is structured so adding a sort or operator family is additive.

## Where things live that aren't obvious

- R2 WASM URL: `config.js` (non-secret, committed).
- Example JSON/Markdown fixtures: `examples.js`. Order matters — the nav renders them easy → hard.
- Future-work / deferred features: end of `SPEC.md`. Cloud-scale successor pitch: `docs/COMMERCIAL_SCALE.md`.

## Project conventions

- No tests — this project skips unit tests despite any general coding conventions that call for them.
- This project is standalone. Do **not** peek at sibling `yuwakisaweb/` apps (including `markdown_is_a_prolog`, the earlier prototype) when working here — build originally against this codebase.
