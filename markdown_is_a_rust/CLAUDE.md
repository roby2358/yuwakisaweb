# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MarkdownIsARust (MIAR) — a statically-checked language where Markdown is the surface syntax. Part of the "Markdown is a X" family (siblings: `markdown_is_a_lisp`, `markdown_is_a_solver`). Browser-only, no build step.

Read `RUST.md` first — it is the founding design doc and defines what "a Rust" means here. `SPEC.md` is the authoritative surface-syntax and checker reference. `MIAR_USER.md` is the rules-not-prose reference for *generating* valid MIAR programs (matches the implementation, not aspirational). `COMPILE.md` is a feasibility note on a future WASM backend — design only, not a commitment.

## The defining inversion (don't lose this)

The other family members are **structural**: Markdown's bullet tree *is* the semantics, so the parser carries the weight and the evaluator just walks the tree. MarkdownIsARust is **analytic**: Markdown is merely the surface, and the semantics lives in a static checker run over the tree.

Concretely:
- The parser is small and unremarkable (same family trick — Markdown hands over the tree).
- **The borrow checker is the project.** That is where the design effort and the correctness bar belong.
- The deliverable that earns the name is an **error message** (a rejected program), not an output. A MarkdownIsARust that *runs* the litmus program in `RUST.md` instead of rejecting it has failed.
- **No garbage collection.** This is the inverse of MIAL's "lean on the host GC." Memory safety must come from the checker, not a collector or runtime checks. Do not reach for GC to make something work.

## Running it

Open `index.html` directly in a browser. No build, no server, no dependencies. Scripts are plain classic `<script>` tags loaded in order (`parser → checker → runner → examples → index`), each attaching to a single `window.MIAR` global. There are **no tests** (see conventions). To exercise a change, edit an entry in `examples.js` or type into the editor and press Run (Ctrl/Cmd+Enter). The UI runs parse → check → and only runs the program if the checker returns zero diagnostics.

## Architecture

Pipeline: **parse → check → run**, with a uniform `{ value, children, line }` AST as the seam (same shape the sibling projects use — atoms have no children; compounds put the operator/keyword in `value` and operands in `children`; `line` carries source position for diagnostics).

- **`parser.js`** (`MIAR.parse`) — Markdown → `{ items: [...] }`. Headings open items; a bullet's first token becomes `value`, remaining same-line tokens become flat atom children, and indented sub-bullets (2 spaces = 1 level) become further children. Backtick-wrapped spans are single literal tokens. Purely structural — no semantic analysis.
- **`checker.js`** (`MIAR.check`) — **the core.** A hand-rolled state machine over the tree (no solver). Threads per-binding ownership/borrow state (`owned`/`moved`, a shared count, one `mutBorrow`) through lexical scopes and rejects violations. Returns `{ diags, fns }`; a non-empty `diags` means the program is rejected and must not run.
- **`runner.js`** (`MIAR.run`) — executes only checker-accepted programs. Deliberately naive: references are just the underlying value, moves need no enforcement, output goes through a sink callback. Its only job is to show accepted programs mean something.
- **`index.js`** — UI controller wiring editor → parse → check → run, rendering diagnostics or output. `index.css` is the dark monospace theme. `examples.js` is the featured-program list (`MIAR.EXAMPLES`), ordered simplest → most involved, mixing accepted and intentionally-rejected programs.

## Surface-syntax conventions (non-obvious, span files)

These are easy to break when editing parser/checker/runner together — they must agree:

- **Item kinds are heading keywords:** `# fn`, `# struct`, `# enum` are the only kinds the checker supports in v1. `# trait` / `# impl` parse but the checker rejects them as deferred. A bare `# name` heading is treated as `fn`. `# main` is the entry point.
- **Declarations are prefix, type-first:** `type name [name...]` declares one or more bindings of that type — e.g. `i64 x y` declares two `i64`s, `& i64 r` declares `r` as `& i64`. Used in `params`, struct fields, and matched by `parseDecl` (checker) / `declNames` (runner). The leading `&`/`&mut` chain plus one base type is the type; the rest are names.
- **Function shape:** a `fn` body uses special bullets `params` (children are declarations) and `returns` (children are a type); every other top-level bullet is a body statement. The last body expression is the implicit return.
- **Operators are bullet heads:** `let`, `let mut`, `return`, arithmetic/comparison/`and`/`or`/`not`, `if`, `match`, `vec`, `push`, `print`, `&`, `&mut`, and `.` (one-level field access, e.g. `. p x`). A `let` initializer must be a single expression — a compound goes on a sub-bullet.
- **Compact rendering mirrors compact parsing:** `index.js`'s AST pretty-printer rides leading atom children inline on the head line and only breaks a child out to a sub-bullet once it has children of its own — the inverse of how the parser reads compact source. Keep the two in sync.

## Key decisions

- **Lexical lifetimes in v1.** A borrow lives until the end of its enclosing scope; loans are released when the scope exits (`releaseScope`). Non-lexical lifetimes (borrow dies at last use) are a documented later refinement requiring a backward liveness pass — see RUST.md. Don't build NLL until the lexical checker is solid.
- **Struct bindings own their fields.** Each field gets its own sub-binding so it can be moved out (partial move) or borrowed disjointly; moving a field out poisons by-value use of the whole struct. Field mutability follows the binding (no per-field `mut`, as in Rust).
- AST shape is `{ value, children, line }`, matching the family. Keep it.
- Plain `<script>` tags, no ES modules, no bundler, no package manager.

## Project conventions

- **No tests** — this project skips unit tests despite any general coding conventions that call for them. The family convention wins.
- No build step, no linter for application code. Open `index.html` directly in a browser.
- This project is standalone. The sibling `markdown_is_a_*` apps are useful for the *shared AST shape and family conventions* (and RUST.md compares against MIAL deliberately), but build the language itself against this codebase, not by copying theirs.
