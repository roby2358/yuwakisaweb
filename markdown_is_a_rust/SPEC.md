# MarkdownIsARust — Technical Specification

## Purpose

MarkdownIsARust (MIAR) is a browser-based language tool in which Markdown is the surface syntax for a statically-checked, ownership-based language. A user writes a program as Markdown — headings are item definitions, nested bullet lists are the expression tree, backtick-wrapped tokens are literals — and the tool **checks** the program before running it. The defining behavior is the checker, not the runner: MIAR's job is to *reject* programs that would use a value after it has moved, mutate a value while it is borrowed, or let a reference outlive its referent, and to do so without a garbage collector and without runtime safety checks.

MIAR is the analytic member of the "Markdown is a X" family (siblings: `markdown_is_a_lisp`, `markdown_is_a_solver`). Where those projects let Markdown's tree structure *be* the semantics, MIAR uses the tree only as a surface; the semantics lives in an ownership and borrow checker that runs over the tree. The authoritative statement of what makes the language "a Rust" is `RUST.md`; this document specifies the v1 surface syntax and checker behavior. MIAR runs entirely in the browser with no server-side computation.

## UI Layout

The application presents a single-page layout beneath a header. The header contains the title, example navigation, and a Check/Run control. Below the header, a source editor sits on the left and a results pane on the right. The results pane shows either checker diagnostics (when the program is rejected) or program output (when it is accepted and run). An AST panel MAY be shown alongside the results.

```
+--------------------------------------------------------------+
|  MarkdownIsARust   [examples...]              [Check / Run]   |
+--------------------------------------------------------------+
|                              |                                |
|   [Source editor]            |   [Results pane]               |
|   Markdown program           |   - diagnostics (rejected), OR |
|                              |   - program output (accepted)  |
|                              |                                |
|                              |   [AST panel — optional]       |
|                              |                                |
+--------------------------------------------------------------+
```

On viewports narrower than 900 pixels the panes MUST stack vertically. The theme MUST be dark with a monospace editor, consistent with the sibling projects.

## Functional Requirements

### Example Navigation

- The application MUST provide quick-access links for a fixed set of featured example programs.
- Clicking an example MUST populate the source editor with its content and clear the results pane.
- The examples MUST be ordered simplest → most involved, so a first-time user sees the smallest program first.
- The example set MUST include, at minimum:
  - A value-and-arithmetic program (immutable bindings, operators, `print`).
  - A recursion program (e.g. factorial) demonstrating that repetition is recursive and that the base case is reachable.
  - A **move** program that the checker rejects with a use-after-move diagnostic.
  - A **borrow-conflict** program (the litmus program below) that the checker rejects with an aliasing-versus-mutability diagnostic.
  - An accepted program that takes a shared borrow, finishes using it, and is permitted — included to show the checker accepts safe programs, not merely rejects unsafe ones.
- The example set SHOULD include a `match` program over an `enum` (or `Option`) demonstrating exhaustiveness.

### Source Pane and Parsing

- The source MUST be parsed into a uniform AST of nodes shaped `{ value, children }`, the same shape used by the sibling projects. Atoms have no children; compounds carry the operator or keyword in `value` and their operands in `children`.
- Top-level Markdown headings (`#`) MUST introduce items (see Items). Content beneath a heading, up to the next heading, belongs to that item.
- Within an item body, bullet nesting MUST form the expression and statement tree. Two spaces of indentation MUST denote one level of nesting. Either `*` or `-` MAY be used as the bullet marker.
- A bullet line's first token MUST become the node's `value`. Any further tokens on the same line MUST become flat children of that node (compact form). Indented sub-bullets MUST become additional children at the next level.
- Backtick-wrapped tokens MUST be literals; bare tokens MUST be symbols (binding names, item names) or operator/keyword names.
- The parser MUST be small and unremarkable. Parsing MUST NOT perform semantic analysis; all ownership, type, and borrow decisions belong to the checker.

### Items

- `# fn name` MUST define a function. `# main` (a zero-parameter `fn`) MUST be the entry point; a program without `# main` MUST be rejected.
- A function body MAY begin with a `params` bullet whose sub-bullets each declare one parameter as a name and a type. A function with no `params` bullet takes no parameters.
- A function body MAY include a `returns` bullet naming the return type. Absent it, the function returns unit `()`.
- The remaining top-level bullets under a `# fn` MUST be the body, evaluated in order. The function's value MUST be the value of its last body expression, unless an explicit `return` occurs earlier.
- `# struct Name` MUST define a product type whose fields are declared as bullets (each a field name and a type).
- `# enum Name` MUST define a sum type whose variants are declared as bullets; a variant MAY carry payload types as sub-bullets.
- `# impl Name` MAY define associated functions and methods for a type; method bodies follow the same rules as `# fn`.
- Item names MUST be unique within a program. A duplicate item name MUST be rejected.
- Generics, trait definitions, and trait bounds are deferred (see Future Work). v1 items are concrete.

### Bindings and Mutability

- A `let` bullet MUST introduce a binding. Its children are an OPTIONAL `mut` marker, the binding name, and an initializer expression. The initializer MAY be given in compact form on the same line or as sub-bullets.
- An `=` token appearing between the binding name and the initializer in a `let` bullet MUST be treated as a cosmetic separator and ignored.
- A binding introduced without `mut` MUST be immutable: any attempt to assign to it, or to take a `&mut` borrow of it, MUST be rejected.
- A binding introduced with `mut` MAY be assigned to and MAY be exclusively borrowed, subject to the borrow rules below.

### Type System (v1)

- The v1 sorts MUST be: `i64` (64-bit signed integer), `bool`, `String`, `Vec` (a growable sequence of a single element type), the unit type `()`, shared references `&T`, exclusive references `&mut T`, and any `struct` or `enum` the program defines.
- `i64`, `bool`, `()`, and shared references `&T` MUST be **Copy** types: binding, passing, or returning a Copy value copies it, and the source remains valid.
- `String`, `Vec`, exclusive references `&mut T`, and all user `struct`/`enum` types MUST be **move** types: binding, passing, or returning a move value transfers ownership, and the source binding becomes invalid (see Ownership).
- The checker MUST verify that operators, function calls, field accesses, and match arms are applied to operands of the expected type, and MUST reject type mismatches before running the program.
- There is no `null` and there are no exceptions. Absence MUST be expressed with the `Option` enum and fallibility with the `Result` enum; both are ordinary enums provided by the v1 prelude.

### Ownership and Move Semantics

- Every value MUST have exactly one owning binding at any time.
- Using a move-type binding as the source of a `let`, as a by-value function argument, as a `return` value, or as the source of an assignment MUST transfer ownership away from that binding and mark it **moved**.
- Any read or use of a moved binding MUST be rejected with a use-after-move diagnostic naming the binding and the location of the prior move.
- Copy-type bindings MUST NOT be marked moved by such uses; the source remains usable.
- When a binding that still owns a value leaves scope, that value MUST be dropped. Drops MUST occur at scope exit in reverse order of declaration. v1 MAY treat drop as having no observable effect beyond ending the value's lifetime.
- The checker MUST achieve memory safety entirely through this static analysis. It MUST NOT rely on a garbage collector and MUST NOT insert runtime ownership or liveness checks.

### Borrowing

- A `&` prefix operator MUST produce a **shared** (immutable) reference to its operand binding. A `&mut` prefix operator MUST produce an **exclusive** (mutable) reference, and is permitted only on a `mut` binding.
- At any point in a binding's lifetime, the checker MUST permit **either** any number of live shared borrows **or** exactly one live exclusive borrow — never both, and never more than one exclusive borrow. This is the aliasing-versus-mutability rule.
- While a shared borrow of a binding is live, mutating that binding (assignment, `&mut`, or a mutating operation through the owner) MUST be rejected.
- While an exclusive borrow of a binding is live, any other access to that binding — shared borrow, exclusive borrow, read, or mutation through the owner — MUST be rejected.
- v1 MUST use **lexical** borrow lifetimes: a borrow is live from the point it is taken until the end of the scope that contains the reference binding. Non-lexical lifetimes (ending a borrow at its last use) are deferred (see Future Work).
- A reference MUST NOT outlive the binding it borrows from. Returning a reference to a binding local to the current function, or storing such a reference in a longer-lived binding, MUST be rejected with a dangling-reference diagnostic.
- Reading or writing through a reference MUST be subject to the same type rules as the referent.

### Pattern Matching

- A `match` expression MUST take a scrutinee expression and a set of arms; each arm pairs a pattern against the scrutinee's type with a result expression.
- For a `match` on an `enum` (including `Option` and `Result`), the checker MUST verify that the arms cover every variant. A match that omits a variant and provides no wildcard arm MUST be rejected as non-exhaustive, naming the uncovered variant(s).
- Matching MUST interact with ownership: matching a move-type scrutinee by value moves it into the arms; matching through a reference borrows it.

### Built-in Operations

- Arithmetic over `i64` MUST be provided: `+`, `-`, `*`, `/`, `%`.
- Comparison MUST be provided: `<`, `<=`, `>`, `>=`, `==`, `!=`, yielding `bool`.
- Boolean logic MUST be provided: `and`, `or`, `not`.
- Conditional `if` MUST be a special form taking a `bool` condition, a consequent, and an OPTIONAL alternate; it MUST evaluate only the chosen branch.
- A `Vec` constructor and a mutating `push` operation MUST be provided; `push` MUST require an exclusive borrow (or ownership) of its target and MUST therefore participate in the borrow rules.
- A `print` operation MUST render a value to the results pane.
- The `?` operator MAY be provided in v1 to early-return `None`/`Err` from a function whose return type is a matching `Option`/`Result`.

### Checking and Execution

- Pressing the Check/Run control or Ctrl/Cmd+Enter MUST parse the source, run the checker, and then, only if checking succeeds, run the program from `# main`.
- If the checker rejects the program, the tool MUST display the diagnostics and MUST NOT run any part of the program.
- If the checker accepts the program, the tool MUST run `main` and display its output (everything sent to `print`, in order) in the results pane.
- The checker MUST report **all** independent violations it can determine in a single pass where feasible, rather than stopping at the first, so the user can address more than one per cycle. It MAY stop early when a violation makes further analysis unreliable.

### Results and Diagnostics Pane

- Each diagnostic MUST name its violation class. The v1 classes are: use-after-move, borrow conflict (aliasing versus mutability), dangling reference, mutation of an immutable binding, non-exhaustive match, type mismatch, undeclared symbol, and arity mismatch.
- Each diagnostic MUST point back to the offending source by reproducing the relevant bullet text (and, where applicable, the location of the conflicting prior event — e.g. where a moved value was moved, or where a still-live borrow was taken). Diagnostics MUST preserve enough of the original bullet form for the user to locate the rule responsible, in the spirit of the sibling solver rendering its unsat core as source text.
- On a successful run, the pane MUST display the program's output. A program that produces no output MUST still indicate that checking and execution succeeded.
- A clear action MUST reset the pane to its placeholder state.

## Non-Functional Requirements

### Styling

- Dark theme, monospace editor, consistent with the sibling projects.
- Responsive: on viewports narrower than 900 pixels, panes stack vertically.

### Code Quality

- The application MUST load via plain `<script>` tags with no ES-module bundler and no package manager for application code.
- Parsing, checking, running, and UI wiring SHOULD be separate units. The checker is the center of the project and SHOULD be isolated from parsing and UI so its rules can evolve independently.
- There MUST be no runtime build step.

### Performance

- Checking and running a featured example MUST complete fast enough to feel instantaneous to the user (well under one second). v1 programs are small; no asynchronous loading is required.

### Browser Compatibility

- The application MUST run in current Chromium-, Firefox-, and WebKit-based browsers without polyfills.

### Accessibility

- Interactive controls MUST be keyboard reachable. The Check/Run action MUST have a keyboard shortcut (Ctrl/Cmd+Enter).

## Dependencies

- None at runtime. The application is plain HTML, CSS, and JavaScript loaded by classic `<script>` tags, with no external libraries, no WASM, and no package manager required to run it.
- The editor MAY be a plain `<textarea>`; a richer editor component is OPTIONAL and MUST NOT be required for the tool to function.

## Implementation Notes

- Parser, checker, and runner share the uniform `node(value, children)` AST used across the family. Atoms have `children.length === 0`; compounds put the operator or keyword in `value`.
- The checker SHOULD thread a per-binding state through the tree as it walks: each binding is Owned, Moved, Shared(n) (n live shared borrows), or MutBorrowed (one live exclusive borrow). Taking `&` requires the binding not be MutBorrowed and increments the shared count; taking `&mut` requires the binding be Owned with no live borrows; a by-value use of a move-type binding transitions it to Moved; mutation requires Owned-and-`mut`. Because v1 lifetimes are lexical, the borrow counts reset at scope exit rather than at last use — entering a scope pushes a frame and exiting it drops the frame's bindings and releases the borrows they held.
- The `=` separator in a `let` bullet is purely cosmetic and is dropped during parsing, so `let v = …` and `let v …` parse identically. This exists only so example programs read naturally.
- `&` and `&mut` are prefix operator nodes applied to a binding, not literals; backticks are reserved for literal values (`` `42` ``, `` `true` ``, `` `"hello"` ``).
- The defining anti-pattern to avoid is making the runner do the safety work. Any check that ownership, borrowing, or lifetimes would catch MUST be a pre-run rejection, never a runtime guard, and never deferred to a garbage collector. A MarkdownIsARust that *runs* the litmus program below has failed regardless of what it prints.

The litmus program (`RUST.md`) the checker MUST reject:

```markdown
# main
* let mut v
  * vec `1` `2` `3`
* let r
  * & v
* push v `4`
* print r
```

It MUST be rejected because `v` is mutated by `push` while the shared borrow held by `r` is still live. The expected diagnostic names the borrow conflict, the mutation site (`push v …`), and the still-live borrow (`& v`).

## Error Handling

- MIAR fails hard: on any parse error or any checker violation, no part of the program runs and no partial output is shown.
- Parse errors (malformed headings, broken indentation, unterminated literals) MUST be reported distinctly from checker violations.
- Checker violations MUST be reported using the diagnostic classes listed under Results and Diagnostics. A single program MAY surface multiple diagnostics.
- A program missing `# main`, or with a duplicate item name, MUST be rejected before checking proceeds.
- Runtime faults that the type and borrow systems do not prevent in v1 (for example, integer division by zero or arithmetic overflow) MUST be surfaced as run-time errors in the results pane and MUST NOT crash the tool.

## Tradeoffs

**The checker is the product, not the runner.** MIAR could trivially run these programs as an untyped tree-walker and get "the right answer" for accepted programs. It deliberately does the opposite: the value it demonstrates is the *rejection* of unsafe programs at check time, mirroring how the sibling solver's value is in compiling to a real solver rather than faking sat/unsat. The runner exists mainly to show that accepted programs mean something.

**Lexical borrows in v1.** Lexical lifetimes are simpler to implement and sound, at the cost of rejecting some safe programs that real Rust (with non-lexical lifetimes) accepts. This is an accepted v1 limitation; the litmus program is rejected identically under either rule, so nothing essential is lost. Non-lexical lifetimes are a documented later refinement.

**Concrete types in v1.** Traits, generics, and bounds — Rust's main abstraction mechanism — are deferred so v1 can land the defining ownership-and-borrow analysis first. The type system is structured so that adding traits is additive.

**No garbage collector, by definition.** The family's LISP member leaned on the host garbage collector to satisfy "automatic memory management." MIAR refuses that crutch on purpose: memory safety must come from the static analysis, because that refusal is precisely what earns the name "a Rust."

## Future Work

- Non-lexical lifetimes: end a borrow at its last use via a backward liveness pass, and ship a demo program that the lexical checker rejects and the non-lexical checker accepts.
- Traits, generics, and trait bounds (bounded parametric polymorphism); static and dynamic dispatch.
- Explicit lifetime annotations for references that outlive a single scope.
- Closures as first-class values capturing their environment under the borrow rules.
- A richer type set (unsigned and sized integers, floats, tuples, slices, `HashMap`).
- An `unsafe` escape hatch that quarantines operations the checker cannot prove safe.
- A visualization of borrow state over the program, showing where each binding is owned, borrowed, or moved.
- Editor-content persistence across reloads.
