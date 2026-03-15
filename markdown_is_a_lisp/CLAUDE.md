# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarkdownIsALISP — a homoiconic programming language where Markdown IS the S-expression syntax. Markdown headings define functions, bullet lists form the AST, and backtick-wrapped values are literals. The interpreter runs in-browser with no build step.

## Development

Open `index.html` directly in a browser (or use any static file server). No build tools, no package manager, no tests.

## Architecture

- **`interpreter.js`** — The language itself: parser, evaluator, and runner. Exports `runMarkdownIsALISP(code, logFn)` and `nodeToMarkdown(node, indent)` as globals.
  - Parser: Markdown → AST (headings become DEF nodes, bullet nesting becomes tree structure via indent-tracking stack)
  - Evaluator: walks AST directly (no IR transformation) — `evaluate()` handles literals, symbols, special forms (`if`, `lambda`, `quote`, `eval`), and function application
  - Standard library: arithmetic, comparison, logic, cons/car/cdr, print/print-ast
  - `nodeToMarkdown`: renders AST back to Markdown (homoiconicity — code and data share the same Markdown form)
- **`index.js`** — UI controller: wires up editor, console output, AST panel, and example code snippets
- **`index.css`** — Styling (dark theme, split-pane layout)
- **`example_interpreter.ts`** — Earlier TypeScript/React prototype of the same interpreter (reference only, not used in production)

## Language Semantics

- `# name` defines a function or constant
- First child of a definition with 2+ children is the parameter spec; remaining children are the body
- Single-child definitions with a LITERAL child become constants; otherwise zero-arg functions
- Backtick-wrapped values (`` `42` ``, `` `"hello"` ``) are literals; bare words are symbols
- Indentation (2 spaces = 1 level) determines tree nesting
- Entry point is `# main`
- Special forms: `if`, `lambda`, `quote`, `eval`

## Key Design Decisions

- All files use plain `<script>` tags (no ES modules, no bundler)
- `interpreter.js` must be loaded before `index.js` (globals: `runMarkdownIsALISP`, `nodeToMarkdown`, `NodeType`)
- AST nodes carry `type`, `value`, `children` (and transient `indent` during parsing)
- Values stay wrapped in LITERAL nodes through evaluation; `unwrap`/`wrap` handle the boundary between AST nodes and raw JS values
