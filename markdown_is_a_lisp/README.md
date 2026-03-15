# MarkdownIsALISP

A homoiconic programming language where Markdown is the S-expression syntax.

Headings define functions. Bullet nesting forms the AST. Backtick-wrapped values are literals. The resulting tree is the structure the evaluator executes, the language manipulates at runtime, and `nodeToMarkdown` serializes back to source. Code and data are the same thing.

## Try It

Open `index.html` in a browser. No build step, no dependencies.

## How It Works

McCarthy's original LISP had two kinds of things: atoms and cons cells — a pair `(car . cdr)` pointing to two other things. Everything else was built from chains of cons cells. A list `(a b c)` was `(a . (b . (c . nil)))`. Function calls, lambda bodies, quoted data — all the same cons chains. The evaluator walked cons cells, `car`/`cdr` decomposed them, `cons` built them. One structure for everything.

MIAL's `{ value, children }` serves the same role but is richer — it's a labeled n-ary tree node instead of an unlabeled binary pair. The label (`.value`) carries information that cons cells had to encode positionally (first element of the list). The children array is flat and n-ary instead of a linked chain of pairs. But the principle is identical: one universal structure, primitives to take it apart, primitives to build it, and the evaluator operates directly on it.

### Syntax Mapping

```
# factorial          →  definition named "factorial"
* n                  →  parameter spec
* if                 →  function call: if is the operator
  * <= ...           →    nested children are arguments
  * `1`              →    backtick-wrapped: literal value 1
  * factorial        →    bare word: symbol (recursive call)
```

### Two Primitive Sets

**Tree primitives** — for code introspection:
- `tag` — the label on a node (the operator in a function call)
- `children` — the sub-nodes (the arguments)
- `make-node` — build a node from a tag and a children list

**List primitives** — for flat data:
- `car` / `cdr` / `cons` / `list`

Same `{ value, children }` shape, different access patterns. `tag` reads the label that `car` doesn't see. `children` outputs a data list that `car`/`cdr` can walk. This is where the two primitive sets shake hands.

### The Litmus Test

```markdown
# main
* print
  * tag
    * quote
      * +
        * `1`
        * `2`
* print
  * eval
    * make-node
      * quote
        * *
      * children
        * quote
          * +
            * `1`
            * `2`
```

Output: `+` then `2`. The program extracts the operator from `(+ 1 2)`, swaps it for `*`, and evaluates the result. Code surgery with three primitives.

## Documentation

- [LISP.md](LISP.md) — The LISP constraints MIAL satisfies and how Markdown's tree structure enhances the interpreter
- [DYNAMICS.md](DYNAMICS.md) — How the interpreter works: parsing, evaluation, environments, the two primitive sets

## Language Reference

### Special Forms

| Form | Description |
|---|---|
| `quote` | Return child unevaluated (code as data) |
| `if` | Conditional (falsy: `false`, `null`, `0`) |
| `lambda` | Anonymous function with lexical closure |
| `eval` | Evaluate data as code |

### Builtins

| Category | Names |
|---|---|
| Arithmetic | `+` `-` `*` `/` `%` |
| Comparison | `<=` `>=` `<` `>` `eq` `!=` |
| Logic | `and` `or` `not` |
| Predicates | `null?` `atom?` `list?` |
| Tree | `tag` `children` `make-node` |
| List | `car` `cdr` `cons` `list` |
| I/O | `print` `print-ast` |
| Meta | `parse` |

### Literals

| Syntax | Value |
|---|---|
| `` `42` `` | Number |
| `` `"hello"` `` | String |
| `` `true` `` / `` `false` `` | Boolean |
| `` `null` `` | Null |
| `bare-word` | Symbol (looked up in environment) |
