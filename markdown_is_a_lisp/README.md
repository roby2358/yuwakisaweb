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
- `make-mial` — build a node from a tag and a children list (a string-literal tag denotes a symbol: `` `"*"` `` builds a node tagged `*`)
- `mial-of` — the code behind a name, unevaluated (`mial` quotes a tree you wrote inline; `mial-of` reads back a tree you defined under a heading)

**List primitives** — for flat data:
- `car` / `cdr` / `cons` / `list`

Same `{ value, children }` shape, different access patterns. `tag` reads the label that `car` doesn't see. `children` outputs a data list that `car`/`cdr` can walk. This is where the two primitive sets shake hands.

### The Litmus Test

```markdown
# main
* print
  * +
    * `2`
    * `3`
* print
  * tag
    * mial
      * +
        * `2`
        * `3`
* print-mial
  * children
    * mial
      * +
        * `2`
        * `3`
* print
  * eval
    * make-mial
      * `"*"`
      * children
        * mial
          * +
            * `2`
            * `3`
```

Output:

```
5
+
- `2`
- `3`
6
```

The same expression four ways: evaluated plainly (`5`), inspected for its operator (`+`), decomposed into its operands (`` `2` `` and `` `3` ``, rendered back as Markdown by `print-mial`), and taken apart, given a new operator, and re-executed (`6`). The `6` can only come from the constructed multiplication. Code surgery with three primitives.

## Documentation

- [LISP.md](LISP.md) — The LISP constraints MIAL satisfies and how Markdown's tree structure enhances the interpreter
- [DYNAMICS.md](DYNAMICS.md) — How the interpreter works: parsing, evaluation, environments, the two primitive sets

## Language Reference

### Special Forms

| Form | Description |
|---|---|
| `mial` | Return child unevaluated — the subtree stays MIAL (code as data) |
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
| Tree | `tag` `children` `make-mial` `mial-of` |
| List | `car` `cdr` `cons` `list` |
| I/O | `print` `print-mial` |
| Meta | `parse-mial` |

`+` `-` `*` `/` fold left over any number of arguments: `+` over `1 2 3 4` is `10`, `*` of a single `7` is `7`, single-argument `-` negates, and single-argument `/` reciprocates. `cons` folds right — the last argument is the tail and everything before it is prepended, so one `cons` builds a whole list the way a nested chain of pairs would.

### Literals

| Syntax | Value |
|---|---|
| `` `42` `` | Number |
| `` `"hello"` `` | String |
| `` `true` `` / `` `false` `` | Boolean |
| `` `null` `` | Null |
| `bare-word` | Symbol (looked up in environment) |

Literals work at two levels: backticks quote an atom, `mial` quotes a tree. Both mean "this piece of MIAL stands for itself." `mial` is `quote` in classic LISP terms — renamed because what it returns *is* the language: `print-mial` renders it back to Markdown, `parse-mial` reads Markdown into it, `make-mial` constructs it, `eval` runs it.
