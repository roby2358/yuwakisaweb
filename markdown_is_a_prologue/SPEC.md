# MarkdownIsAPrologue — Technical Specification

## Purpose

MarkdownIsAPrologue is a logic programming interpreter that uses Markdown as its source syntax. It is the Prolog counterpart to the companion project MarkdownIsALISP, which maps Markdown to LISP. Where MIAL proves that Markdown's tree structure encodes S-expressions, this project proves that Markdown's document structure encodes Horn clause logic programs.

The core insight: Markdown's structural hierarchy maps directly to Prolog's logical hierarchy. Headings introduce predicates (concepts). Bullets enumerate alternative clauses (disjunction). Sub-bullets list body goals (conjunction). The visual nesting IS the logical nesting.

The division of labor: Markdown's structure carries the logic program structure (predicates, clauses, goals). Inline syntax carries term structure (lists, compound terms, arithmetic). This is the same boundary natural language draws — English uses document structure for organization and inline punctuation (commas, brackets, parentheses) for fine-grained expression.

The interpreter MUST irrefutably qualify as a Prolog system by implementing unification, backtracking search, Horn clauses, logical variables, and query resolution.

## Build Phases

### Phase 1 — Core Logic (irrefutably Prolog)
Parser, unification, resolution, backtracking, facts, rules, queries, atoms, variables, numbers. Minimal UI: editor, run button, console output. This phase alone satisfies the "irrefutably Prolog" requirement.

### Phase 2 — Term Structure and Control
Lists (bracket notation), compound terms (parenthesized notation), arithmetic (`is`, comparison goals), `cut`, `not`, standard library (`append`, `member`, `length`), remaining builtins.

### Phase 3 — Polish
Trace panel with search tree visualization, example programs dropdown, dark theme alignment with MIAL, UI responsiveness.

## UI Layout

```
+------------------------------------------------------------------+
| MarkdownIsAPrologue                          [Examples v] [Run]  |
+------------------------------------------------------------------+
| Code Editor (textarea)     |  Query Results / Console            |
|                            |                                     |
| # parent                   |  ?- ancestor(`tom`, Who)            |
| * `tom`, `bob`             |  Who = bob                          |
| * `bob`, `ann`             |  Who = ann                          |
|                            |                                     |
| # ancestor                 |  2 solutions found.                 |
| * X, Y                    |                                     |
|   * parent X, Y            |                                     |
| * X, Z                    |                                     |
|   * parent X, Y            |                                     |
|   * ancestor Y, Z          |                                     |
|                            |                                     |
| # ?                        |                                     |
| * ancestor `tom`, Who      |                                     |
|                            |                                     |
+------------------------------------------------------------------+
| Trace / Search Tree (collapsible)                                |
| > ancestor(tom, Who)                                             |
|   > parent(tom, Who) → Who = bob ✓                               |
|   > parent(tom, Y) → Y = bob                                    |
|     > ancestor(bob, Z)                                           |
|       > parent(bob, Z) → Z = ann ✓                               |
+------------------------------------------------------------------+
```

## Functional Requirements

### Markdown-to-Logic Mapping

- The interpreter MUST treat `#` headings as predicate definitions, where the heading text is the predicate name
- All clauses (facts and rules) for a predicate MUST be grouped under its heading
- Each top-level bullet under a heading MUST represent one clause
- The content of a top-level bullet MUST represent the clause head's arguments, separated by commas (the predicate name comes from the heading, not the bullet)
- Sub-bullets of a clause MUST represent body goals (conditions), evaluated as a conjunction (all must succeed)
- Each body goal's first word MUST be interpreted as the predicate name, with remaining comma-separated items as arguments (this is the opposite of clause heads, where the predicate name comes from the heading)
- A clause with no sub-bullets MUST be treated as a fact
- A clause with sub-bullets MUST be treated as a rule
- Multiple clauses under a heading MUST represent alternatives tried in top-to-bottom order
- All clauses under a single heading MUST have the same number of arguments (arity) — a heading defines a single predicate identified by name/arity
- If the same predicate name appears under multiple headings, clauses MUST be merged in document order

### Terms and Values

- Bare words starting with an uppercase letter or underscore MUST be interpreted as logical variables
- A lone underscore MUST be interpreted as an anonymous variable (unique per occurrence)
- Bare lowercase words in argument position MUST be interpreted as atoms
- Backtick-wrapped content MUST also be interpreted as atoms or numbers (e.g., `` `tom` ``, `` `42` ``)
- Backticks and bare lowercase MUST produce identical atoms: `tom` and `` `tom` `` are the same term
- Backticks MUST be required for numeric literals (`` `42` ``, `` `3.14` ``), atoms containing spaces or special characters, and atoms that would otherwise parse as variables (e.g., `` `X` `` to mean the atom X, not the variable X)
- Backtick-wrapped content containing only digits or a decimal number MUST be interpreted as a numeric value, not an atom
- The interpreter MUST support list terms using inline bracket notation within arguments:
  - `[]` MUST represent the empty list
  - `[`a`, `b`, `c`]` MUST represent an enumerated list (sugar for nested cons cells ending in empty list)
  - `[H | T]` MUST represent head-tail decomposition, where H unifies with the first element and T with the remaining list
  - Lists MAY be nested: `[`a`, [`b`, `c`]]`
- The interpreter MUST support compound terms using inline parenthesized notation within arguments: a functor name followed by parenthesized, comma-separated arguments (e.g., `pair(`a`, `b`)` represents the compound term `pair/2`)

### Unification

- The interpreter MUST implement full unification of terms
- Unification MUST bind logical variables to terms
- Unification of two variables MUST link them so that binding one binds both
- Unification MUST handle recursive term structures (atoms, numbers, variables, compound terms, lists)
- The interpreter SHOULD implement the occurs check to prevent circular bindings
- Unification MUST fail (and trigger backtracking) when two non-variable terms have different functors or different arities, or when any argument pair fails to unify
- When reading a variable's value (for comparison, output, or result reporting), the interpreter MUST dereference the full binding chain — following variable-to-variable links until reaching an unbound variable or a non-variable term

### Resolution

- To resolve a goal, the interpreter MUST find all clauses whose predicate name and arity match the goal
- Before attempting unification with a clause, the interpreter MUST create fresh copies of all variables in that clause (renaming) so that each clause attempt operates on independent variables
- The interpreter MUST unify the goal's arguments with the clause head's arguments
- If unification succeeds and the clause has no body (fact), the goal succeeds with the resulting bindings
- If unification succeeds and the clause has a body (rule), each body goal MUST be resolved recursively — the goal succeeds only when all body goals succeed
- If unification fails, or any body goal fails, the interpreter MUST try the next matching clause

### Search and Backtracking

- The interpreter MUST use depth-first, left-to-right search as its resolution strategy
- When a goal matches multiple clauses, the interpreter MUST try them in the order they appear (top to bottom)
- When a goal fails, the interpreter MUST backtrack to the most recent choice point and try the next alternative
- Body goals within a clause MUST be resolved left-to-right (top sub-bullet to bottom sub-bullet)
- Variable bindings from failed branches MUST NOT persist — backtracking restores the substitution to the state at the choice point
- The interpreter MUST find all solutions to a query unless cut is used or the user requests only the first

### Query Mechanism

- A heading of `?` MUST designate a query section
- Each top-level bullet under `# ?` MUST be executed as a separate query
- Query bullets follow body goal syntax: the first word is the predicate name, remaining comma-separated items are arguments (not clause head syntax, where the predicate comes from the heading)
- Sub-bullets under a query goal MUST be treated as additional conjoined goals (same as body goal sub-bullets in rules)
- For each query, the interpreter MUST report all variable bindings that satisfy the query, with each variable fully dereferenced to its resolved value
- If a query has no solutions, the interpreter MUST report failure
- If a query succeeds with no variables, the interpreter MUST report `true`
- The interpreter MUST display the total number of solutions found

### Control and Negation

- The interpreter MUST support `cut` as a goal that succeeds once and commits to the current clause — all remaining alternative clauses for the predicate call that matched this clause MUST be pruned
- The interpreter MUST support negation-as-failure via a `not` goal
- `not` takes a single sub-goal as its argument using inline goal syntax: the word after `not` is the predicate name, and remaining items are its arguments (e.g., a body goal `not member X, L` means "member(X, L) must not be provable") — `not` consumes the rest of its bullet line as the sub-goal, which is unambiguous since each body goal occupies its own sub-bullet
- `not` MUST succeed when its sub-goal fails and fail when its sub-goal succeeds
- `not` MUST NOT bind any variables (bindings from the sub-goal attempt are discarded regardless of outcome)

### Arithmetic

- The interpreter MUST support an `is` goal that evaluates an arithmetic expression and unifies the result with a variable
- The `is` goal MUST take two arguments: the target (typically a variable) and an arithmetic expression
- Arithmetic expressions MUST be represented as compound terms using the inline parenthesized syntax defined in Terms and Values (e.g., `+(N, `1`)`, `*(X, -(Y, `2`))`)
- Supported arithmetic operators: `+`, `-`, `*`, `//` (integer division), `mod`
- Comparison goals MUST be supported: `<`, `>`, `=<`, `>=`, `=:=` (numeric equality), `=\=` (numeric inequality) — each takes two arguments and evaluates both before comparing
- Arithmetic evaluation MUST fail with an instantiation error if the expression contains unbound variables

### Built-in Predicates

- The interpreter MUST provide `write` to output a term to the console
- The interpreter MUST provide `nl` to output a newline to the console
- The interpreter MUST provide `atom` to test if a term is an atom
- The interpreter MUST provide `number` to test if a term is a number
- The interpreter MUST provide `var` to test if a term is an unbound variable
- The interpreter MUST provide `nonvar` to test if a term is not an unbound variable
- The interpreter MUST provide `=` for explicit unification of two terms
- The interpreter MUST provide `\=` which succeeds when two terms do not unify
- The interpreter MUST provide `true` (always succeeds) and `fail` (always fails)
- The interpreter MUST provide `append`, `member`, and `length` as a standard library — these SHOULD be implemented as Markdown Prolog clauses loaded before user code (not opaque builtins), so they are inspectable and overridable
- The interpreter MAY provide `assert` and `retract` for dynamic predicate modification
- The interpreter MAY provide `findall` to collect all solutions into a list

### Trace and Debugging

- The interpreter MUST support a trace mode that logs each goal attempted, whether it succeeded or failed, and any resulting bindings
- The trace panel SHOULD display the search tree visually, showing choice points and backtracking paths
- Trace output MUST use indentation to reflect search depth
- The trace panel MUST be collapsible

### Example Programs

- The interpreter MUST ship with example programs selectable from a dropdown
- Examples MUST include at minimum: family relationships (ancestor/descendant), list operations (append, reverse, member), arithmetic (factorial, fibonacci), and a classic puzzle (e.g., map coloring or Tower of Hanoi)

## Non-Functional Requirements

### Styling and Theming

- The application MUST use a dark theme consistent with the companion MIAL project
- The editor MUST use a monospace font
- The layout MUST be a responsive split-pane design (editor left, results right)

### Code Quality

- The interpreter MUST be implemented as ES modules with no build step
- The application MUST run in-browser with no server-side dependencies
- The project MUST NOT use any third-party libraries or frameworks
- The interpreter core MUST be separated from the UI layer (separate modules)

### Performance

- The interpreter MUST handle programs with up to 1000 clauses without perceptible delay
- The interpreter MUST enforce a configurable search depth limit to prevent infinite loops, defaulting to 10,000 resolution steps
- When the step limit is exceeded, the interpreter MUST report an error rather than hanging

## Dependencies

None. Vanilla HTML, CSS, and ES modules. No build step.

## Implementation Notes

### Architectural Alignment with MIAL

The project mirrors the companion MIAL structure: `interpreter.js` (parser, unifier, solver, builtins), `index.js` (UI controller), `index.html`, and `index.css`. This is not a coincidence — both projects demonstrate that Markdown's structural features encode a programming paradigm.

### The Structural Mapping (Why Markdown Works for Prolog)

MIAL's insight was that bullet nesting IS S-expression depth. The analogous insight here is that Markdown's document hierarchy IS the Horn clause hierarchy:

| Markdown Feature | Prolog Concept | Logical Role |
|---|---|---|
| `#` Heading | Predicate name | Groups related clauses |
| Top-level `*` bullet | Clause | One way to satisfy the predicate (disjunction) |
| Bullet content | Head arguments | What the clause matches against |
| Sub-bullets | Body goals | Conditions that must hold (conjunction) |
| Multiple headings | Knowledge base | The full program |
| `# ?` heading | Query | What to solve |

This mapping is natural, not forced: a heading introduces a concept, bullets enumerate alternatives, sub-bullets list requirements. A Markdown document about family relationships reads almost identically as a natural outline and as a logic program.

Markdown's structure stops at the bullet line — it doesn't have native syntax for lists-within-arguments or nested compound terms. That's where inline syntax takes over: brackets for lists, parentheses for compound terms, commas for argument separation. This is the same division natural language uses — document structure organizes, inline punctuation expresses.

### Node Representation

All terms share the same `{ value, children }` shape as MIAL — the node structure is identical across both projects. Atoms are `{ value: 'tom', children: [] }`. Compound terms are `{ value: 'parent', children: [t1, t2] }`. Lists desugar to cons cells: `{ value: '.', children: [head, tail] }` with empty list as `{ value: '[]', children: [] }`. Variables are named placeholders: `{ value: { var: 'X' }, children: [] }`. The node itself is immutable — bindings live externally in a substitution map, not inside the node.

### Substitution Model

Variable bindings are stored in an external substitution map (variable name → term), not in mutable ref cells on the nodes. This keeps the node structure fully immutable, matching MIAL's approach. Dereferencing walks the map: look up a variable, if the result is another variable, look that up, repeat until reaching a non-variable term or an unbound variable. Unification produces a new (or extended) substitution rather than mutating existing bindings. Backtracking restores a previous substitution snapshot — no trailing or undo bookkeeping required. The occurs check is optional (off by default for performance, toggleable in the UI).

### Search Strategy

Standard Prolog SLD resolution: depth-first, left-to-right. A choice point records which clauses remain to try and the substitution at the time of the choice. On failure, the solver restores the substitution from the most recent choice point and tries the next clause — no trailing or undo logic needed. Cut removes choice points from the stack.

### Arithmetic Expression Handling

The `is` goal's second argument is an unevaluated term tree. Arithmetic builtins walk this tree, evaluating functor nodes as operators. This keeps arithmetic expressions as ordinary terms (no special parser mode), maintaining the "everything is a term" principle.

### Inline Compound Terms

Arguments that include parentheses represent compound terms: `pair(`a`, `b`)` parses as a term with functor `pair` and two atom arguments. This extends the parser to handle nested structures inline without requiring deeper bullet nesting for every compound term.

### List Syntax

Lists use standard Prolog bracket notation inline with arguments. The parser recognizes `[`, `]`, `|`, and `,` tokens within argument positions and builds cons-cell structures. `[]` is the empty list atom. `[H | T]` is a cons cell (head/tail decomposition). `[`a`, `b`, `c`]` desugars to nested cons cells terminating in `[]`. This keeps list syntax familiar to Prolog users while leaving Markdown's bullet structure free to carry logic program structure (clauses and goals) without ambiguity.

## Error Handling

- If a predicate is referenced in a goal but never defined, the interpreter MUST report an "undefined predicate" error with the predicate name and arity
- If `is` encounters an unbound variable in an arithmetic expression, the interpreter MUST report an "instantiation error"
- If the step limit is exceeded, the interpreter MUST report a "step limit exceeded" error and halt the current query
- If the Markdown input contains malformed structure (e.g., bullets before any heading), the interpreter MUST report a parse error with the line number
- Errors MUST be displayed in the console panel with sufficient context to diagnose the issue
