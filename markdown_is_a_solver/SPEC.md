# Markdown Is A Solver — Technical Specification

## Purpose

Markdown Is A Solver (MIAS) is a browser-based SMT tool that combines JSON data with a Markdown-syntax constraint language. Users supply typed constants and literal values as JSON in one pane, write assertions and a check-sat goal in Markdown in a second pane, and view the solver result and model in a third. MIAS runs entirely in the browser with no server-side computation and no data exfiltration, and is intended for constraint validation over real-world configuration data — compliance rule checking, policy-as-data verification, scheduling, and arithmetic reasoning.

MIAS builds on ideas first explored in a sibling prototype, Markdown Is A Prolog (MIAP), which demonstrated that Markdown is a practical surface for a logic program. MIAP is a stepping stone; MIAS stands alone. Cloud-scale features (multi-user workspaces, API access, policy libraries, audit trails) are the subject of a separate follow-on project — this specification covers the browser tool only and keeps that scope deliberately small.

## UI Layout

The application presents a single-page three-pane layout beneath a header. The header contains the title, example navigation, a Z3 status indicator, and a Run control. The Z3 status indicator MUST reflect the WASM lifecycle with at least the states `Loading Z3…`, `Z3 ready`, `Z3 failed to load`, and `Solving…`. Below the header three editor regions sit side by side: JSON facts on the left, Markdown rules in the middle, results on the right. On viewports narrower than 900 pixels the panes MUST stack vertically. The theme is dark slate with an emerald accent and monospace editors.

## Functional Requirements

### Example Navigation

- The application MUST provide quick-access links for a fixed set of featured examples.
- Clicking an example MUST populate both editor panes with its content and clear the results pane.
- The application MUST ship six examples in v1, ordered easy → hard in the navigation so first-time users see the simplest usage first:
  - `easy` — a small arithmetic puzzle with three unknowns, demonstrating `declare` + `assert` with no JSON input.
  - `budget` — a three-unknown allocation puzzle where JSON supplies parameters (total budget, minimum per person) and Markdown declares the unknowns with equality and inequality constraints.
  - `physical` — a clinical checkup validation: a patient record with demographic, vital, and label fields. Markdown asserts physiological range constraints on vitals, tolerance-based reconciliation of a derived field (BMI within 0.1 of weight ÷ height²), an inter-field sanity rule (systolic > diastolic + 10), enumeration of permitted patient-status labels, and a clinical-coherence rule (smokers cannot carry a healthy label).
  - `intake` — business-rule validation of an incoming order record: identifier, customer tier, status, quantities, rates, amounts, and totals. Markdown asserts arithmetic reconciliation (subtotal, discount, tax, total), range constraints on rates and counts, enumeration constraints on status and tier values, and a tier-based business rule (e.g. gold tier requires at least a 10% discount). Exercises `implies`, enumeration via n-ary `or`, and Int/Real mixing.
  - `scheduling` — a three-meeting scheduling puzzle combining JSON-supplied parameters (e.g. workday start and end) with Markdown-declared unknowns and ordering constraints.
  - `compliance` — an AWS-style security-group configuration with a rule asserting no open SSH from `0.0.0.0/0`, with no `declare` section.
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
- Exactly one `check` section MUST appear per run in v1. Missing or duplicate `check` sections MUST produce an error.
- The `check` section MUST contain no bullets in v1; its presence alone means "check-sat the conjunction of all asserts". Bullets under `check` MUST produce an error.
- Surface conventions: backtick-quoted tokens are literal atoms or numbers, names beginning with an uppercase letter or underscore are symbols, and compound terms are written with parenthesized arguments. Inside a compound argument list, bare numbers and the bare words `true`/`false` are also accepted as numeric and Boolean literals; backticks remain the canonical form and are required for string literals.
- Every free name in `assert` or `check` MUST resolve to a JSON-declared constant, a Markdown-declared constant, a built-in operator, or a literal. Undeclared names MUST produce an error naming the symbol.

### Compilation and Execution

- Pressing the Run button or Ctrl/Cmd+Enter MUST parse both panes, compile the combined program, invoke the solver, and render the result.
- The Run control MUST be disabled until Z3 finishes loading, and MUST be disabled while a solve is in flight.
- The compiler MUST walk the parsed AST and build Z3 expressions directly via the `z3-solver` direct API (Context builders and expression methods — e.g. `ctx.Int.const`, `expr.eq`, `ctx.And`, `ctx.If`, `ctx.Distinct`). It MUST NOT produce an SMT-LIB string or invoke any SMT-LIB evaluation entry point (e.g. `eval_smtlib2_string`). This is the defining architectural property of MIAS.

### SMT Subset (v1)

- Sorts: Int, Real, Bool, String (equality only; no regex or length).
- Booleans: `and`, `or`, `not`, `implies`, `iff`, `ite`.
- Equality: `=`, `distinct`.
- Arithmetic over Int and Real: `+`, `-`, `*`, `/`, `mod`, `<`, `<=`, `>`, `>=`. In mixed-operand arithmetic, comparisons, equality, and `ite` branches, Int operands MUST be promoted to Real; the result sort is Real whenever any operand is Real. `mod` is Int-only.
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

- Deploy target: Cloudflare Pages as a static site. MIAS ships as a subpath of a parent Pages project (e.g. `yuwakisaweb.pages.dev/markdown_is_a_solver/`), deployed automatically from `git push` — there is no MIAS-specific deploy script.
- Z3 WebAssembly MUST be hosted on Cloudflare R2 and MUST NOT be committed to the repository.
- The pre-bundled Z3 JavaScript wrapper MUST be committed as a vendored artifact produced by a one-time offline bundle step.
- The R2 URL MUST live in a committed configuration file as non-secret data.
- The site MUST be cross-origin-isolated. This is realized by a committed `_headers` file at the parent Pages deploy root, path-scoped to `/markdown_is_a_solver/*` so the parent site is not affected: `Cross-Origin-Opener-Policy: same-origin` plus `Cross-Origin-Embedder-Policy: credentialless`. Cross-origin isolation makes `SharedArrayBuffer` available, which the Z3 WASM requires in order to run `solver.check()` on a worker thread without blocking the UI.

## Dependencies

- `z3-solver` — official Z3 WebAssembly distribution, used via its direct API (Context builders and expression methods, never via an SMT-LIB string entry point). Pinned in the bundled artifact; the WASM component lives on R2.
- esbuild or equivalent — offline bundler for the wrapper. Not a runtime dependency.
- Cloudflare Wrangler CLI — used by the R2 upload script. Not a runtime dependency. Site deploy is driven by git, not Wrangler.

## Setup (R2)

Performed once per environment:

- Create an R2 bucket and upload `z3-built.wasm`.
- Configure a CORS rule permitting GET from the Pages origin, and set `Cache-Control: public, max-age=31536000, immutable` on the object.
- Enable the public `r2.dev` URL or attach a custom domain, and record the URL in the committed configuration file.

A helper script at `scripts/upload.sh` MUST perform the bucket creation, WASM upload, CORS configuration, and public-URL enablement as a single idempotent step. Pages deployment is handled automatically by the parent project's git integration — pushing to `main` publishes the site.

## Implementation Notes

- Parser and compiler share a uniform `node(value, children)` AST. JSON and Markdown halves compose cleanly because they produce the same shape.
- The compiler is a tree walker. Sort correctness and operator arity are its responsibility — they MUST be checked before any solver call is made, since there is no SMT-LIB round-trip to catch them.
- The Z3 runtime is initialized once per page load; a fresh context is created per Run to prevent state leaks.
- JSON-derived and Markdown-declared constants share one namespace. A name that appears in both sources MUST produce an error regardless of sort agreement; silent shadowing is not permitted.
- COEP `credentialless` relies on cross-origin resources being fetched without credentials; R2 is served accordingly, so no CORP header on the WASM object is required.
- Local development requires the same COOP/COEP headers as production, because `SharedArrayBuffer` is gated on cross-origin isolation. Servers that do not send these headers (for example, the IntelliJ preview) cause `solver.check()` to fail at pthread creation. A helper script at `scripts/serve.mjs` (run via `npm run serve`) MUST serve the app with the correct headers for local testing.
- The vendored Z3 bundle MUST be emitted as a classic-script IIFE, not an ES module. Emscripten's pthread runtime spawns each worker with `new Worker(url)` (no `{ type: 'module' }`), so any `export` or `import.meta` in the bundle is a syntax error in the worker context. The IIFE exposes its init function on `globalThis` and is loaded by the host page via a classic `<script>` tag before the application module runs.
- The host page MUST pass `mainScriptUrlOrBlob` to Z3's init, pointing at the bundle's own URL. Emscripten otherwise defaults to `document.currentScript?.src`, which is null in an ES-module context, and spawns workers with an undefined URL that fail opaquely. The same URL is used by every pthread worker to re-fetch the bundle and self-detect pthread mode at runtime.
- The bundle is produced from a small entry shim rather than from `z3-solver/build/browser.js` directly. The stock `init()` takes no arguments, so `locateFile` and `mainScriptUrlOrBlob` never reach emscripten. The shim calls the low-level init with a factory closure that carries the caller's module overrides.

## Error Handling

MIAS fails hard in v1: on any error in parse, compile, or solve, no partial result is reported. Error messages MUST surface in the results pane. Expected error classes: invalid JSON, malformed Markdown structure, undeclared symbols, sort mismatches during compilation, and solver errors or timeouts. JSON `null` MUST be rejected; it has no natural sort in the v1 subset and silent coercion would mislead.

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
