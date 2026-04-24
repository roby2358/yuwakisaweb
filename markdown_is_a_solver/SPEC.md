# Markdown Is A Solver — Technical Specification

## Purpose

Markdown Is A Solver (MIAS) is a browser-based SMT tool that combines JSON data with a Markdown-syntax constraint language. Users supply typed constants and literal values as JSON in one pane, write assertions and a check-sat goal in Markdown in a second pane, and view the solver result and model in a third. MIAS runs entirely in the browser with no server-side computation and no data exfiltration, and is intended for constraint validation over real-world configuration data — compliance rule checking, policy-as-data verification, scheduling, and arithmetic reasoning.

MIAS builds on ideas first explored in a sibling prototype, Markdown Is A Prolog (MIAP), which demonstrated that Markdown is a practical surface for a logic program. MIAP is a stepping stone; MIAS stands alone. Cloud-scale features (multi-user workspaces, API access, policy libraries, audit trails) are the subject of a separate follow-on project — this specification covers the browser tool only and keeps that scope deliberately small.

## UI Layout

The application presents a single-page three-pane layout beneath a header. The header contains the title, example navigation, and a Run control. Below it three editor regions sit side by side: JSON facts on the left, Markdown rules in the middle, results on the right. On viewports narrower than 900 pixels the panes MUST stack vertically. The theme is dark slate with an emerald accent and monospace editors.

## Functional Requirements

### Example Navigation

- The application MUST provide quick-access links for a fixed set of featured examples.
- Clicking an example MUST populate both editor panes with its content and clear the results pane.
- The application MUST ship two examples in v1: one compliance-flavored (an AWS-style security-group configuration with a rule asserting no open SSH from `0.0.0.0/0`) and one classic SMT (a scheduling or linear-arithmetic puzzle).
- The compliance example MUST express CIDR matching via string equality on CIDR literals (for example, asserting that the CIDR field does not equal the string `"0.0.0.0/0"`). It MUST NOT require bitvector arithmetic, subnet containment, or any other theory outside the v1 SMT subset.

### JSON Facts Pane

- The JSON MUST be a top-level object. Each primitive value beneath it becomes a typed declared constant whose value is asserted equal to the literal.
- Sorts MUST be inferred from JSON literal shape: whole numbers become Int, numbers with a fractional component become Real, booleans become Bool, strings become String.
- For disambiguation the application MUST support a sibling `_types` hint at object scope: a `_types` object mapping sibling field names to sort names overrides inferred sorts for those fields. The `_types` key itself is metadata and does not produce a constant.
- Nested objects MUST be flattened into qualified symbol names using dot notation (e.g., a field `port` inside `ingress` inside `security_group` produces the symbol `security_group.ingress.port`). The user-facing name in Markdown assertions MUST match exactly.
- Arrays in JSON MUST produce an error in v1. Array support is deferred; silent flattening by index is explicitly rejected because it couples the Markdown rules to array length.

### Markdown Rules Pane

- The Markdown pane MUST be organized into sections by top-level headings: `declare`, `assert`, and `check`.
- `declare` is OPTIONAL. Symbols introduced by the JSON pane are already declared; `declare` is for symbols that are NOT in JSON — typically the unknowns of a solver-style puzzle. In the compliance use case the user writes no `declare` section at all.
- A `declare` list item introduces one constant written as a name and a sort separated by a colon.
- An `assert` list item defines one assertion; indented sub-items are conjoined into that assertion. Multiple `assert` sections MAY appear and are all conjoined at check time.
- The application MUST support at most one `check` section per run in v1.
- Surface conventions: backtick-quoted tokens are literal atoms or numbers, names beginning with an uppercase letter or underscore are symbols, and compound terms are written with parenthesized arguments.
- Every free name in `assert` or `check` MUST resolve to a JSON-declared constant, a Markdown-declared constant, a built-in operator, or a literal. Undeclared names MUST produce an error naming the symbol.

### Compilation and Execution

- Pressing the Run button or Ctrl/Cmd+Enter MUST parse both panes, compile the combined program, invoke the solver, and render the result.
- The compiler MUST walk the parsed AST and emit calls to the Z3 low-level API directly. It MUST NOT produce an SMT-LIB string or invoke any SMT-LIB evaluation entry point. This is the defining architectural property of MIAS.

### SMT Subset (v1)

- Sorts: Int, Real, Bool, String (equality only; no regex or length).
- Booleans: `and`, `or`, `not`, `implies`, `iff`, `ite`.
- Equality: `=`, `distinct`.
- Arithmetic over Int and Real: `+`, `-`, `*`, `/`, `mod`, `<`, `<=`, `>`, `>=`.
- Quantifier-free only.
- Arrays, bitvectors, uninterpreted functions, datatypes, and quantifiers are deferred. The compiler MUST be organized so that adding a sort or operator family is additive.

### Results Pane

- On completion the pane MUST display one of `sat`, `unsat`, or `unknown`.
- On `sat` the pane MUST display a formatted model listing each declared constant and its assigned value; JSON-derived constants SHOULD be included.
- A clear action MUST reset the pane to its placeholder state.

## Non-Functional Requirements

### Styling

- Dark theme with slate background, emerald accent for interactive elements and the title, monospace editors.
- Responsive: on viewports narrower than 900 pixels, panes stack vertically.

### Code Quality

- Organized as ES modules loaded by `index.html`. Parsing, compilation, and UI wiring SHOULD be separate modules.
- No runtime build step for application code. The only offline build artifact is the pre-bundled Z3 wrapper.

### Performance

- The Z3 WASM module MUST load asynchronously and MUST NOT block initial page render.
- The page SHOULD begin loading the WASM as soon as ready so the first Run is not penalized by the full ~32MB fetch.

### Deployment

- Deploy target: Cloudflare Pages as a static site.
- Z3 WebAssembly MUST be hosted on Cloudflare R2 and MUST NOT be committed to the repository.
- The pre-bundled Z3 JavaScript wrapper MUST be committed as a vendored artifact produced by a one-time offline bundle step.
- The R2 URL MUST live in a committed configuration file as non-secret data.
- The site MUST set `Cross-Origin-Embedder-Policy: credentialless`. Z3 runs single-threaded in v1; threaded Z3 would require full cross-origin isolation and is deferred.

## Dependencies

- `z3-solver` — official Z3 WebAssembly distribution, used via its low-level API. Pinned in the bundled artifact; the WASM component lives on R2.
- esbuild or equivalent — offline bundler for the wrapper. Not a runtime dependency.
- Cloudflare Wrangler CLI — used by deploy and upload scripts. Not a runtime dependency.

## Setup (R2)

Performed once per environment:

- Create an R2 bucket and upload `z3-built.wasm`.
- Configure a CORS rule permitting GET from the Pages origin, and set `Cache-Control: public, max-age=31536000, immutable` on the object.
- Enable the public `r2.dev` URL or attach a custom domain, and record the URL in the committed configuration file.

A helper script MUST perform the WASM upload. A deploy script MUST wrap the Pages deployment.

## Implementation Notes

- Parser and compiler share a uniform `node(value, children)` AST. JSON and Markdown halves compose cleanly because they produce the same shape.
- The compiler is a tree walker. Sort correctness and operator arity are its responsibility — they MUST be checked before any solver call is made, since there is no SMT-LIB round-trip to catch them.
- The Z3 runtime is initialized once per page load; a fresh context is created per Run to prevent state leaks.
- JSON-derived and Markdown-declared constants share one namespace. A name that appears in both sources MUST produce an error regardless of sort agreement; silent shadowing is not permitted.
- COEP `credentialless` relies on cross-origin resources being fetched without credentials; R2 is served accordingly. Threaded Z3 would require SharedArrayBuffer and full cross-origin isolation via COOP plus a service worker — this path is deferred.

## Error Handling

MIAS fails hard in v1: on any error in parse, compile, or solve, no partial result is reported. Error messages MUST surface in the results pane. Expected error classes: invalid JSON, malformed Markdown structure, undeclared symbols, sort mismatches during compilation, and solver errors or timeouts.

## Tradeoffs

**Direct API vs SMT-LIB string compilation.** The compiler walks its own AST and calls the Z3 low-level API directly, rather than serializing to SMT-LIB and calling `eval_smtlib2_string`. The direct path costs more per supported operator, but buys a first-class AST, meaningful static checks, better error messages, and a clean demonstration that Markdown-native constraint programming does not require a detour through an intermediate text format. The SMT-LIB string path is a known anti-pattern for this project.

**Literal JSON mapping.** Every primitive in the JSON pane becomes a typed declared constant asserted equal to its value. This fits the compliance use case cleanly — the JSON is exactly the configuration under test. It sacrifices the more Prolog-flavored feel of a relational mapping and does not naturally express sets of heterogeneous records. Worth revisiting after v1 demonstrates the compliance path end to end.

**Ruthlessly scoped SMT subset.** V1 covers QF_LIRA plus Booleans plus string equality. This is sufficient for the vast majority of compliance-style constraints while keeping the compiler small. Richer theories are deferred and the compiler is structured to make adding them additive.

## Future Work

- Unsat cores so failing compliance rules can be pinpointed.
- Enumerate-all-solutions for finite problems.
- Arrays, bitvectors, uninterpreted functions, datatypes, quantifiers.
- Multiple `check` sections with push/pop scoping.
- Auto-declaration with sort inference for purely-Markdown symbols.
- Trace panel showing solver activity.
- Threaded Z3 via full cross-origin isolation, for larger problem sizes.
- Richer string theory: regex, length, concatenation.
- Editor-content persistence across reloads.
- Cloud-scale successor with multi-user workspaces, API access, policy libraries, and audit trails.
