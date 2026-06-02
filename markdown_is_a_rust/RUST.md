# RUST.md

What makes a language a Rust, and how a MarkdownIsARust would satisfy each constraint.

## The Inversion

The sibling projects in this family — MarkdownIsALISP, MarkdownIsASolver — share a happy property: Markdown's structure *is* the semantics. LISP's essence is structural (code = data = tree), so Markdown's bullet tree carries the meaning almost for free; MIAL's parser is roughly 30 lines and the evaluator walks the tree directly.

Rust is the opposite, and naming that inversion up front is the most important thing in this document.

**Rust's identity is not in its syntax. It is in a static analysis run over a typed tree.** You could write Rust in any syntax and it would still be Rust; you could write Markdown-shaped bullets with none of the analysis and it would not be. The defining work of a MarkdownIsARust is therefore not the parser — Markdown hands us the tree as it always does — but the **borrow checker** we run over that tree.

For MIAL, the litmus test is a program the language *runs* (code surgery, executed). For a Rust, the litmus test is a program the language *refuses to run* (an aliasing-mutation, rejected at compile time). The deliverable that earns the name is an **error message**, not an output.

## The Constraints, In Tiers

Not all Rust features are equally defining. Pattern matching and traits make a language *feel* like Rust, but they are shared with the ML family. Ownership and borrowing are Rust's alone. This document ranks accordingly.

---

## Tier 1 — The Defining Test

These are non-negotiable. A language that meets them is a Rust. A language that misses any of them is something else wearing Rust's syntax. Together they are one property — **memory safety without garbage collection, enforced at compile time** — decomposed into three interlocking rules.

This is the exact inverse of McCarthy's ninth LISP constraint. MIAL satisfied "automatic memory management" by leaning on JavaScript's garbage collector and calling it done. A Rust **must refuse that crutch.** The entire point is safety *without* a collector and *without* runtime checks. If the implementation reaches for GC, it has failed the one test that matters.

### 1. Ownership and Move Semantics

**The constraint:** Every value has exactly one owner. Binding or passing a non-`Copy` value *moves* it — the source binding becomes invalid and using it is a compile error. When an owner leaves scope, its value is dropped (RAII): no garbage collector, no manual `free`.

**How it would be met:** The checker threads an ownership state through the tree as it walks. Each binding node owns its value. A move node (assignment, function argument, return) transfers ownership and marks the source binding *moved*; any later read of a moved binding is a rejection. Scope exit — the end of a heading's body, the end of a bullet block — drops everything still owned there, in reverse declaration order.

```markdown
# main
* let s = `"hello"`
* take s              (s is moved into take)
* print s             (REJECTED: use of moved value `s`)
```

`Copy` types (numbers, booleans) copy instead of moving; the source stays valid. The distinction is part of a type's identity, not a per-use decision.

### 2. Borrowing — Aliasing XOR Mutability

**The constraint:** At any single moment a value has *either* any number of shared `&` borrows *or* exactly one exclusive `&mut` borrow — never both. This one rule is what eliminates data races and iterator invalidation by construction, before any code runs.

**How it would be met:** Alongside ownership, the checker tracks the live borrows of each value as a set with a state machine: a value is Owned, Shared(n), or MutBorrowed. Taking `&` requires the value not be MutBorrowed and increments the shared count; taking `&mut` requires the value be Owned with no live borrows. A borrow's life ends at the last use of the reference (non-lexical lifetimes) or at scope exit, whichever the implementation models. Mutating through the owner while any borrow is live is a rejection.

```markdown
# main
* let mut v
  * vec `1` `2` `3`
* let r
  * & v                  (shared borrow begins)
* push v `4`             (REJECTED: cannot mutate `v` while borrowed by `r`)
* print r                (borrow still live here)
```

### 3. Lifetimes

**The constraint:** A reference can never outlive the data it points to. No dangling references — checked statically, not caught at runtime.

**How it would be met:** Every reference carries the scope of the binding it borrows from. Returning a reference, or storing one in a longer-lived binding, requires the referent's scope to enclose the reference's. A reference that would escape its referent's scope is rejected.

```markdown
# dangle
* let x = `5`
* & x                    (REJECTED: returns a reference to `x`, which is dropped at end of `dangle`)
```

In real Rust most lifetimes are inferred; a v1 MarkdownIsARust can start with scope-based inference and add explicit lifetime annotations only when the structure demands them.

**Lexical first.** A borrow's life can be modeled two ways: *lexical* (the borrow lives until the end of its enclosing scope) or *non-lexical* (NLL — the borrow dies at its last actual use, even if the binding is still in scope). NLL accepts strictly more safe programs but requires a liveness pass to find each reference's last use. v1 uses the **lexical** rule: it is sound, it passes the litmus test (which both rules reject identically), and the borrow state machine simply resets at block boundaries. NLL is a documented later refinement — add a backward liveness pass and keep a demo program that lexical rejects and NLL accepts, so the upgrade is shown rather than asserted.

---

## Tier 2 — Rust's Flavor

These are shared with the broader ML/typed-functional family, but without them the language does not *feel* like Rust. They are also where Markdown's structure pays off most cleanly.

### 4. Algebraic Data Types and Exhaustive Pattern Matching

**The constraint:** `enum` as real sum types that carry data, `struct` as product types, and a `match` whose arms the compiler checks for exhaustiveness — a match that fails to cover a variant is a compile error.

**How it would be met:** Headings declare types — `# enum Shape`, `# struct Point` — with variants and fields as bullets. `match` is a node whose children are arms; the checker compares the arms' patterns against the matched type's declared variants and rejects any match that leaves a variant uncovered.

### 5. No Null, No Exceptions — Errors Are Values

**The constraint:** No null pointer; absence is `Option<T>`. No thrown exceptions for ordinary failure; fallibility is `Result<T, E>`, propagated explicitly with `?`. Errors are ordinary values, handled in the open.

**How it would be met:** `Option` and `Result` are ordinary enums (constraint 4), not special-cased. The `?` operator is a node that, on `Err`/`None`, performs an early return of the enclosing function's body — sugar over a `match`, exactly as in Rust. Panics may exist as a last resort, but are not the mechanism for normal control flow.

### 6. Traits, Not Inheritance

**The constraint:** Abstraction is by composition over trait bounds, not by class inheritance. Generics are constrained by the traits their type parameters must implement — bounded parametric polymorphism.

**How it would be met:** `# trait Name` declares a set of required method signatures; `# impl Trait for Type` provides them. A generic function bullet carries bounds (`T: Trait`), and the checker verifies that any concrete type substituted for `T` has a matching `impl` in scope. There is no `extends`.

### 7. Immutability by Default

**The constraint:** Bindings are immutable unless declared otherwise. `let` is immutable; `mut` is opt-in. This is not cosmetic — default immutability is what makes the aliasing-XOR-mutability rule tractable to reason about, since most bindings can never be the mutating party.

**How it would be met:** A plain `let` binding rejects any mutation or `&mut`. Mutation requires the binding to be marked `mut`, and `&mut` requires both `mut` on the binding and the no-live-borrows condition from constraint 2.

---

## Tier 3 — The Guarantees That Fall Out

These are consequences of Tiers 1 and 2, not independent features — but they are the felt character of the language and worth stating as goals the implementation should not quietly betray.

### 8. Compile-Time Over Runtime

Errors are *rejections by the checker* before execution, not panics during it. The center of gravity is the analysis pass. A MarkdownIsARust whose "type errors" only surface as runtime failures has missed the point as badly as one that uses a garbage collector.

### 9. Zero-Cost Abstractions / No Runtime

You don't pay for what you don't use. Generics monomorphize rather than boxing everything; there is no pervasive runtime managing your values. For a browser interpreter this is more aspiration than measurement, but it should guide design choices — prefer mechanisms that *could* compile to zero overhead.

### 10. Explicit `unsafe` as a Quarantined Escape Hatch

The dangerous operations exist but are walled off behind an `unsafe` marker and named as such. Safety is the default; danger is opt-in, visible, and auditable.

---

## What a Rust Adds Beyond LISP (and Why It's Harder)

| MarkdownIsALISP | MarkdownIsARust |
|---|---|
| Essence is **structural** — code = data = tree | Essence is **analytic** — a checker over a typed tree |
| Markdown's tree *is* the semantics | Markdown's tree is merely the surface; the semantics is the borrow checker |
| Parser ≈ 30 lines; evaluator walks the tree | Parser still small; the **checker** is the project |
| Relies on the host's garbage collector | **Must refuse** garbage collection — that's the whole point |
| Litmus: a program it **runs** (code surgery) | Litmus: a program it **rejects** (aliasing mutation) |
| Deliverable is an **output** | Deliverable is an **error message** |

Markdown still earns its keep at the surface. Headings are item definitions — `# fn`, `# struct`, `# enum`, `# trait`, `# impl` — a syntactic category the way `# defun` was for MIAL. Bullet nesting is the expression and block tree. Backticks are literals. New surface markers carry what Rust's syntax carries: `mut` on bindings, `&` and `&mut` on borrows, moves at call sites.

But the soul of the project is the analysis underneath. Everything that makes the family charming — Markdown doing the parser's job for free — is true here too and is *almost beside the point*. The name is earned in the borrow checker.

## The Litmus Test

LISP's litmus: *can the language take apart a piece of its own code, rearrange it, and execute the result?* The answer is an output.

Rust's litmus is the mirror image: *can the language refuse to compile a program that would alias-and-mutate, use-after-move, or dangle a reference — without a garbage collector and without a runtime check?* The answer is a rejection.

```markdown
# main
* let mut v
  * vec `1` `2` `3`
* let r
  * & v
* push v `4`
* print r
```

A MarkdownIsARust must produce, at check time:

```
error: cannot borrow `v` as mutable because it is also borrowed as shared
  --> push v `4`
     `& v` (the shared borrow by `r`) is still live at `print r`
```

If it instead prints `[1, 2, 3, 4]`, it is not a Rust. It is a tree-walker with Rust-shaped bullets.

That's ownership. That's borrowing. That's Rust. The syntax is Markdown.
