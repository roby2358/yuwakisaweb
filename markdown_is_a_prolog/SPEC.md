# JSON Facts — Technical Specification

## Purpose

JSON Facts is a browser-based logic programming playground that combines JSON data with a Markdown-syntax Prolog dialect. Users define structured facts as JSON in one pane, write rules and queries in Markdown Prolog in a second pane, and view query results in a third. The tool enables rapid exploration of relational reasoning over arbitrary JSON datasets — family trees, infrastructure audits, graph traversal, inventory queries — without installing a Prolog environment.

## UI Layout

```
+----------------------------------------------------------+
| [Terminal Icon] JSON Facts              [trace] [Run]     |
+----------------------------------------------------------+
| family | employees | graph | aws | [more... v]            |
+----------------------------------------------------------+
|  Facts (JSON)  |  Rules & Queries  |  Query Results       |
|      .json     |   (Markdown) .md  |        [clear]       |
| +-----------+  | +-------------+   | +----------------+   |
| |           |  | |             |   | |                |   |
| | textarea  |  | |  textarea   |   | |  console div   |   |
| |           |  | |             |   | |                |   |
| +-----------+  | +-------------+   | +----------------+   |
+----------------------------------------------------------+
| Trace (collapsible)                              [arrow]  |
| +------------------------------------------------------+  |
| |  pre: indented trace output                          |  |
| +------------------------------------------------------+  |
+----------------------------------------------------------+
```

## Functional Requirements

### Example Navigation

- The application MUST provide quick-access links for a fixed set of featured examples (family, employees, graph, aws).
- The application MUST provide a dropdown select for additional examples (inventory, social).
- Clicking a featured link or selecting from the dropdown MUST populate both editor panes with the example's JSON and Markdown content, clear query results, and hide the trace panel.

### JSON Facts Pane

- The application MUST accept arbitrary JSON in the left editor pane.
- The JSON MUST be a top-level object where each key becomes a predicate name.
- The application MUST flatten JSON values into Prolog-style facts according to these rules:
  - A primitive value appends one argument to the predicate.
  - An array iterates its elements, producing one fact per element.
  - A nested array (array-within-array) treats the inner array as a tuple of remaining arguments.
  - An object adds each key as an argument and recurses into the value.
- Nested objects and arrays MUST compose — e.g., an object containing arrays of primitives produces one fact per leaf path.
- Null, boolean, number, and string JSON values MUST all be supported as leaf values.
- Array leaf values inside tuples MUST be converted to Prolog-style cons-cell lists.
- Object leaf values inside tuples MUST be converted to lists of key-value pairs using a `:` functor.

### Rules & Queries Pane (Markdown Prolog)

- The application MUST accept Markdown-formatted Prolog in the middle editor pane.
- Headings (`#`) MUST define predicate names; a heading of `?` MUST define a query section.
- Top-level list items (`*` or `-`) at indent level 0 MUST define clause heads (for predicates) or individual queries (for `?` sections).
- Indented list items MUST define body goals for the enclosing clause, or additional goals for the enclosing query.
- Arguments MUST be separated by commas within a space-delimited Prolog-like syntax (e.g., `* X, Y`).
- Variables MUST be identified by an initial uppercase letter or underscore prefix.
- Anonymous variables (`_`) MUST each be treated as a distinct variable.
- Backtick-quoted values MUST be treated as literals (atoms or numbers).
- List syntax (`[H | T]`, `[a, b, c]`, `[]`) MUST be supported and represented internally as cons cells.
- Compound terms with parenthesized arguments (e.g., `+(N1, \`1\`)`) MUST be supported.
- The `not` keyword MUST be parsed as negation wrapping the remainder of the goal.

### Query Execution

- Pressing the Run button or Ctrl/Cmd+Enter MUST execute all queries.
- Execution MUST first parse JSON facts, then parse the standard library concatenated with user Markdown, then merge all entries into a unified database.
- Each query MUST be displayed in the output prefixed with `?-`.
- Each solution MUST display bindings for user-visible variables (non-underscore-prefixed).
- If a query has no variables, successful solutions MUST display `true`.
- After all solutions, a summary line MUST display the count (e.g., `3 solutions.`) or `false` if none.
- The application MUST enforce a step limit on resolution to prevent runaway computation.

### Standard Library

- The application MUST preload a standard library defining `append/3`, `member/2`, and `length/2`.
- Standard library predicates MUST be available to all user rules and queries without explicit declaration.

### Prolog Engine

- The engine MUST support unification of terms with immutable substitution maps.
- The engine MUST support backtracking via generator-based resolution.
- The engine MUST freshen variables in each clause invocation to avoid capture.
- The engine MUST support cut (`cut` goal) to prune the search space within a clause.
- The engine MUST support negation as failure (`not` goal).
- The engine MUST support the following built-in predicates:
  - `true/0` — always succeeds
  - `fail/0` — always fails
  - `=/2` — unification
  - `\=/2` — negation of unification
  - `write/1` — output a term to the console
  - `nl/0` — output a blank line
  - `atom/1`, `number/1`, `var/1`, `nonvar/1` — type checks
  - `is/2` — arithmetic evaluation and unification
  - Arithmetic comparisons: `</2`, `>/2`, `=</2`, `>=/2`, `=:=/2`, `=\=/2`
- Arithmetic evaluation MUST support `+`, `-`, `*`, `//` (integer division), and `mod`.

### Trace

- The application MUST provide a trace toggle checkbox.
- When trace is enabled, each goal entered during resolution MUST be recorded with its depth and dereferenced arguments.
- After execution with trace enabled, the trace panel MUST become visible and display indented trace output.
- The trace panel MUST be collapsible by clicking its header.
- When trace is disabled, the trace panel MUST be hidden.

### Console Output

- The console MUST visually distinguish query lines, result lines, error lines, summary lines, and empty separator lines using distinct styling classes.
- The clear button MUST reset the console to its placeholder state.

## Non-Functional Requirements

### Styling

- The application MUST use a dark theme with a slate/navy background palette.
- The accent color MUST be emerald green for interactive elements and the title.
- Editors MUST use a monospace font.
- The application MUST be responsive: on viewports narrower than 900px, panes MUST stack vertically.

### Code Quality

- The application MUST use no build step — plain ES5-compatible script tags loaded in order.
- The application MUST consist of separate files for the interpreter, JSON parser, and UI controller.

### Performance

- The resolver MUST enforce a configurable step limit (default 10,000) and abort with an error message when exceeded.
- Stack overflow from deep recursion MUST be caught and reported as a user-friendly error.

## Dependencies

- None. The application is self-contained with no external libraries or frameworks.

## Implementation Notes

- The internal term representation uses a `{ value, children }` node shape shared by both the Markdown parser and JSON parser, enabling seamless merging of facts from both sources.
- Lists are represented as cons cells: `node('.', [head, tail])` with `node('[]')` as the empty list.
- Variables are represented as nodes whose `value` is an object with a `var` property (e.g., `{ var: 'X' }`).
- Substitutions are immutable `Map` instances — each binding creates a new map rather than mutating.
- Variable freshening appends `__N` suffixes to avoid capture across clause invocations.
- The JSON parser and Markdown parser produce the same entry format (`{ name, clauses }`) so they can be concatenated before database construction.
- The database indexes clauses by `name/arity` keys for efficient lookup.
- Script load order matters: `interpreter.js` first (defines `node`, parser, solver, stdlib), then `json_parser.js` (depends on `node`, `buildConsList`), then `index.js` (depends on everything).

## Error Handling

- Invalid JSON in the facts pane MUST display a parse error in the console output with the exception message.
- An undefined predicate encountered during resolution MUST throw an error with the predicate's name and arity.
- Exceeding the step limit MUST produce an error message indicating the limit was reached.
- Stack overflow from infinite recursion MUST be caught and reported as a descriptive error rather than crashing silently.
- Unbound variables in arithmetic expressions MUST produce an instantiation error.
- Unknown arithmetic operators MUST produce an error identifying the operator and arity.
