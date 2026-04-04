# MarkdownIsAPrologue

A logic programming interpreter where Markdown is the source syntax.

Headings define predicates. Bullets enumerate alternative clauses (disjunction). Sub-bullets list body goals (conjunction). Inline syntax carries term structure — brackets for lists, parentheses for compound terms, commas for argument separation. The visual nesting IS the logical nesting.

Companion to [MarkdownIsALISP](../markdown_is_a_lisp/), which maps Markdown to LISP. Where MIAL proves that bullet nesting encodes S-expressions, this project proves that Markdown's document hierarchy encodes Horn clause logic programs.

## Try It

Open `index.html` in a browser. No build step, no dependencies.

Ctrl+Enter runs the program from the editor.

## How It Works

Prolog programs are collections of Horn clauses grouped by predicate. Each predicate has a name, and its clauses are tried top-to-bottom. A clause with no conditions is a fact; a clause with conditions is a rule. A query asks the interpreter to find variable bindings that satisfy a goal using depth-first search with backtracking.

Markdown maps onto this directly:

| Markdown | Prolog | Role |
|---|---|---|
| Heading (`#`) | Predicate name | Groups related clauses |
| Top-level bullet | Clause | One way to satisfy the predicate |
| Bullet content | Head arguments | What the clause matches against |
| Sub-bullets | Body goals | Conditions (conjunction) |
| Multiple bullets | Alternatives | Tried top-to-bottom (disjunction) |
| `# ?` heading | Query | What to solve |

### Syntax Mapping

```
# parent                →  predicate "parent"
* `tom`, `bob`          →  fact: parent(tom, bob)
* `bob`, `ann`          →  fact: parent(bob, ann)

# ancestor              →  predicate "ancestor"
* X, Y                  →  clause head: ancestor(X, Y) :-
  * parent X, Y         →    body goal: parent(X, Y)
* X, Z                  →  clause head: ancestor(X, Z) :-
  * parent X, Y         →    body goal: parent(X, Y)
  * ancestor Y, Z       →    body goal: ancestor(Y, Z)

# ?                     →  queries
* ancestor `tom`, Who   →  ?- ancestor(tom, Who)
```

Output: `Who = bob`, `Who = ann`. Two solutions found.

### Term Syntax

| Syntax | Term | Notes |
|---|---|---|
| `X`, `Who` | Variable | Uppercase or `_`-prefixed |
| `_` | Anonymous variable | Unique per occurrence |
| `tom`, `hello` | Atom | Bare lowercase |
| `` `tom` `` | Atom | Backtick-wrapped (same as bare) |
| `` `42` ``, `` `3.14` `` | Number | Backtick-wrapped digits |
| `[]` | Empty list | |
| `[H \| T]` | Head/tail | Cons cell decomposition |
| `[a, b, c]` | List | Sugar for nested cons cells |
| `pair(a, b)` | Compound term | Functor with arguments |
| `+(N, \`1\`)` | Arithmetic | Operators as compound terms |

### Control

- **`cut`** — succeeds once, commits to the current clause
- **`not`** — negation-as-failure; consumes the rest of the bullet as a sub-goal

## Documentation

- [SPEC.md](SPEC.md) — Full technical specification

## Builtin Reference

### Predicates

| Name | Description |
|---|---|
| `true` | Always succeeds |
| `fail` | Always fails |
| `=` | Unify two terms |
| `\=` | Succeeds when two terms do not unify |
| `write` | Output a term to the console |
| `nl` | Output a newline |
| `atom` | Test if a term is an atom |
| `number` | Test if a term is a number |
| `var` | Test if a term is an unbound variable |
| `nonvar` | Test if a term is not an unbound variable |

### Arithmetic

`is` evaluates an expression and unifies the result: `is Result, +(A, B)`

Operators: `+`, `-`, `*`, `//` (integer division), `mod`

Comparisons: `<`, `>`, `=<`, `>=`, `=:=`, `=\=`

### Standard Library

`append`, `member`, and `length` are implemented as Markdown Prolog clauses loaded before user code — inspectable and overridable.
