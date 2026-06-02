# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MarkdownIsARust — a statically-checked language where Markdown is the surface syntax. Part of the "Markdown is a X" family (siblings: `markdown_is_a_lisp`, `markdown_is_a_solver`). Browser-only, no build step.

Read `RUST.md` first — it is the founding design doc and defines what "a Rust" means here. `SPEC.md` (forthcoming) is the authoritative surface-syntax and checker reference.

## The defining inversion (don't lose this)

The other family members are **structural**: Markdown's bullet tree *is* the semantics, so the parser carries the weight and the evaluator just walks the tree. MarkdownIsARust is **analytic**: Markdown is merely the surface, and the semantics lives in a static checker run over the tree.

Concretely:
- The parser is small and unremarkable (same family trick — Markdown hands over the tree).
- **The borrow checker is the project.** That is where the design effort and the correctness bar belong.
- The deliverable that earns the name is an **error message** (a rejected program), not an output. A MarkdownIsARust that *runs* the litmus program in `RUST.md` instead of rejecting it has failed.
- **No garbage collection.** This is the inverse of MIAL's "lean on the host GC." Memory safety must come from the checker, not a collector or runtime checks. Do not reach for GC to make something work.

## Architecture (intended)

Pipeline: **parse → check → run**, with a uniform `{ value, children }` AST as the seam (same shape the sibling projects use — atoms have no children; compounds put the operator in `value`).

- **parser** — Markdown → AST. Headings (`# fn`/`# struct`/`# enum`/`# trait`/`# impl`) are item definitions; bullet nesting is the expression/block tree; backticks are literals; surface markers carry `mut`, `&`, `&mut`, and moves.
- **checker** — the core. Walks the tree threading ownership/borrow state per binding (Owned / Moved / Shared(n) / MutBorrowed) and rejects violations: use-after-move, aliasing-XOR-mutability breaches, dangling references, non-exhaustive `match`, unsatisfied trait bounds, mutation of non-`mut` bindings.
- **runner** — only executes programs the checker accepted.

## Key decisions

- **Lexical lifetimes in v1.** A borrow lives until the end of its enclosing scope; the borrow state machine resets at block boundaries. Non-lexical lifetimes (borrow dies at last use) are a documented later refinement requiring a backward liveness pass — see RUST.md. Don't build NLL until the lexical checker is solid.
- AST shape is `{ value, children }`, matching the family. Keep it.
- Plain `<script>` tags, no ES modules, no bundler, no package manager.

## Project conventions

- **No tests** — this project skips unit tests despite any general coding conventions that call for them. The family convention wins.
- No build step, no linter for application code. Open `index.html` directly in a browser.
- This project is standalone. The sibling `markdown_is_a_*` apps are useful for the *shared AST shape and family conventions* (and RUST.md compares against MIAL deliberately), but build the language itself against this codebase, not by copying theirs.
