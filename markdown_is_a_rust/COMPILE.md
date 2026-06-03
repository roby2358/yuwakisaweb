# COMPILE.md — Compiling MIAR to WebAssembly

A feasibility analysis: what it would take to compile the checked MIAR AST to
WebAssembly, and why the hard part is the part that *is* the project. This is a
design note, not a commitment. See `RUST.md` for the founding constraints,
`SPEC.md` for the surface/checker reference.

## Short answer

It splits cleanly into a part that is almost trivial and a part that is a real
compiler backend — and the hard part is exactly the project's thesis (memory
safety without a garbage collector), so it is worth doing *for* that reason
rather than in spite of it.

The current pipeline is **parse → check → run**, where `run` is a deliberately
naive tree-walker that leans on JavaScript's GC. A WASM path adds a
**compile** stage: **parse → check → compile → instantiate → run**, where the
generated module manages its own memory with drops the checker proves correct.

## The easy core (≈ a weekend)

A Copy-only subset maps almost 1:1 onto WASM MVP (the stack machine with
`i32`/`i64`/`f32`/`f64`, linear memory, and structured control flow):

- `i64` arithmetic / comparison → `i64.add`, `i64.sub`, `i64.mul`, `i64.div_s`,
  `i64.rem_s`, `i64.lt_s`, … verbatim.
- `bool` → `i32` (0/1); `and` / `or` → short-circuit via `if`; `not` → `i32.eqz`.
- `if` → WASM's structured `if/else`, which already yields a value.
- functions → WASM functions; `let` bindings → WASM locals (one pre-pass per
  function to assign local slot indices, handling scopes/shadowing); `return`
  → `return`.
- recursion → `call` by function index, native.
- `print i64` → a **host import** (WASM has no I/O, so a JS `print` is imported
  into the module).

The `factorial` example would compile with a near-mechanical AST walk emitting
bytes. Order of magnitude: ~300–500 lines of codegen plus a tiny loader. The
uniform `{ value, children }` AST is fine to walk for codegen unchanged.

## The real work: memory without a GC

Everything with a heap — `String`, `Vec`, structs, enums-with-payload — is where
it stops being easy, and the reason is the language's defining constraint.

- **WASM MVP has linear memory and no allocator.** You would implement at least a
  bump allocator in linear memory, plus value layouts:
  - `Vec` → (ptr, len, cap); `push` grows the buffer.
  - `String` → bytes + len; string literals go in the data section.
  - `struct` → field offsets in a flat record.
  - `enum` → tag (`i32`) + payload; `match` dispatches on the tag (`br_table`
    or chained `if`).
- **Drops are the crux.** The tree-walking runner handles memory by leaning on
  JavaScript's GC — it **never emits a drop**, because it does not have to. A
  WASM backend cannot cheat that way: it must emit `free`/drop calls at each
  scope exit, in reverse declaration order, for every owned non-`Copy` value —
  the RAII described in `SPEC.md` (§Ownership) and `RUST.md` (Tier 1). A **move**
  becomes "copy the pointer and do *not* drop the source," which is sound
  precisely because the checker already proved there is no use-after-move.

This is why the difficulty is not incidental — it is the project finally cashing
the check the borrow checker writes. The whole claim is "memory safety without a
garbage collector, proven statically." The GC-backed runner *asserts* that; a
WASM backend that places drops from the ownership analysis would *demonstrate*
it — the same way the solver sibling earns its name by compiling to a real
solver instead of faking sat/unsat.

## The prerequisite refactor

The blocker is not the WASM encoding — it is that `check()` currently computes all
the ownership/scope/move state and then **throws it away**, returning only
`{ diags, fns }`. A compiler needs that analysis surfaced:

- the **type of every expression** (for layout and sizing), and
- a **drop schedule** per scope — which owned bindings are still live at each
  scope exit, and in what order.

The checker already knows both internally (per-binding `state`, the scope stack,
`releaseScope`). Exposing them as a structured output is a moderate, well-
contained refactor — and worth doing regardless, because it makes the analysis
inspectable.

## Honesty constraints

- **Do not use WasmGC.** The WasmGC proposal (now in major browsers) adds managed
  structs/arrays/refs and would make structs/enums/`Vec`/`String` dramatically
  easier — but using it **directly contradicts the no-GC constraint** that earns
  the name. MIAR must deliberately target *linear memory + static drops*, not
  WasmGC. The feature that makes codegen easiest is the one the project must
  refuse; that refusal is the point.
- **Stay zero-dependency.** Emit the WASM **binary directly as bytes** and
  `WebAssembly.instantiate` it — no Binaryen / wabt — to keep the "plain
  `<script>`, no build step, no bundler" promise. Emitting binary by hand is
  tedious but mechanical.

## Suggested milestones

1. **Surface analysis** — extend the checker to return per-expression types and a
   per-scope drop schedule (the prerequisite refactor above).
2. **Copy-only backend** — parse → check → compile → instantiate → run
   `factorial` in actual WASM. Small, motivating, proves the pipeline. (≈ days.)
3. **Heap + drops** — a bump allocator, `Vec`/`String` with drops at scope exit,
   `print` via ptr+len to a host import.
4. **Aggregates** — structs and enums, `match` via tag dispatch.

Rough order of magnitude: milestone 2 is days; milestones 3–4 are a few weeks of
genuine compiler work — most of it the allocator and the **drop-insertion pass**,
almost none of it the WASM bytes themselves.

## Where it fits the project

A WASM backend does not change what MIAR *is* — the checker remains the
deliverable, and a rejected program is still the artifact that earns the name. It
would be an opt-in `compiler.js` alongside `runner.js`, not a replacement. Its
value is "show, don't assert": it would turn the static ownership analysis into
correct manual memory management, which is a stronger demonstration than a
GC-backed tree-walker can ever be.
