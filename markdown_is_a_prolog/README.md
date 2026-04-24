# JSON Facts

A browser-based logic programming playground. Write structured data as JSON, query it with a Markdown-flavored Prolog dialect, and see results instantly — no install, no build step.

## What It Does

**Left pane:** Define facts as JSON. Each top-level key becomes a predicate; values are flattened into arguments automatically.

**Middle pane:** Write rules and queries in Markdown Prolog — headings define predicates, bullet points define clauses, indented bullets are body goals.

**Right pane:** Hit Run (or Ctrl+Enter) and see query results with variable bindings.

## Quick Example

Given this JSON:

```json
{
  "parent": {
    "tom": ["bob", "liz"],
    "bob": ["ann", "pat"]
  }
}
```

And these rules:

```markdown
# ancestor
* X, Y
  * parent X, Y
* X, Z
  * parent X, Y
  * ancestor Y, Z

# ?
* ancestor tom, Who
```

You get:

```
?- ancestor(tom, Who)
  Who = bob
  Who = liz
  Who = ann
  Who = pat
  4 solutions.
```

## JSON Flattening

Top-level keys become predicate names. Values map to facts:

| JSON pattern | Example | Produces |
|---|---|---|
| Key → array of primitives | `"human": ["alice", "bob"]` | `human(alice).` `human(bob).` |
| Key → array of arrays | `"edge": [["a","b"]]` | `edge(a, b).` |
| Key → object → primitives | `"capital": {"france": "paris"}` | `capital(france, paris).` |
| Key → object → array | `"parent": {"tom": ["bob","liz"]}` | `parent(tom, bob).` `parent(tom, liz).` |

Objects and arrays nest to arbitrary depth.

## Markdown Prolog Syntax

- `# name` — defines a predicate
- `# ?` — defines a query section
- `* args` — clause head (or query goal at top level)
- Indented `* goal` — body goal
- Uppercase or `_`-prefixed tokens are variables; `_` alone is anonymous
- `` `value` `` — literal (number or atom)
- `[H | T]`, `[a, b, c]` — list syntax
- `not goal` — negation as failure

## Built-in Predicates

`true`, `fail`, `=`, `\=`, `not`, `cut`, `write`, `nl`, `atom`, `number`, `var`, `nonvar`, `is`, `<`, `>`, `=<`, `>=`, `=:=`, `=\=`

Arithmetic operators: `+`, `-`, `*`, `//`, `mod`

Standard library: `append`, `member`, `length`

## Included Examples

| Example | Demonstrates |
|---|---|
| **family** | Recursive ancestor queries over a family tree |
| **employees** | Arithmetic comparisons, transitive team membership |
| **graph** | Path finding with list accumulation, toll costs |
| **aws** | Infrastructure auditing — public buckets, open security groups, cross-region access |
| **inventory** | Stock filtering with price/quantity constraints |
| **social** | Mutual follows, influencer detection |

## Trace Mode

Toggle the **trace** checkbox before running to see a step-by-step log of the resolver — each goal attempted, indented by depth. The trace panel is collapsible.

## Running

Open `index.html` in a browser. That's it — no dependencies, no build.
