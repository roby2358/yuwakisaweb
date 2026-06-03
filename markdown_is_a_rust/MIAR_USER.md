# MIAR_USER.md — Writing MarkdownIsARust

A reference for producing valid **MarkdownIsARust (MIAR)** programs. Audience: an
LLM generating MIAR source. Read it as rules, not prose. Everything here matches
the implementation in `parser.js`, `checker.js`, and `runner.js`; nothing is
aspirational. For the *why*, see `RUST.md`; for the formal surface/checker spec,
see `SPEC.md`.

## What MIAR is (one paragraph)

A program is Markdown. Headings are item definitions; nested bullets are the
expression tree; backtick-wrapped tokens are literals. The tool runs a pipeline:
**parse → check → run**. The checker is the point: it statically rejects programs
that use a value after it moves, alias-and-mutate, mutate an immutable binding,
dangle a reference, or write a non-exhaustive `match`. **A rejected program
produces a diagnostic and is *not* run.** Accepted programs run on a deliberately
naive tree-walker. There is no garbage collector and no runtime safety check.

---

## 1. The two rules you will get wrong first

These cause almost all invalid MIAR. Internalize them before anything else.

### 1.1 Everything is prefix

The operator/keyword is the **first** token on a bullet; operands follow. There is
no infix. `2 + 3` is **wrong** (it parses as the symbol `2` applied to `+` and
`3`, then mis-checks). Write the operator first:

```markdown
* + `2` `3`        ✅  means (+ 2 3)
* 2 + 3            ❌  nonsense
```

### 1.2 A same-line token is always a leaf; compound operands go on sub-bullets

The parser turns `* HEAD a b c` into a node whose `value` is `HEAD` and whose
children are the **atoms** `a`, `b`, `c`. A token written on the head line can
never have children of its own. So:

> **If an operand is itself a compound (it needs operands), it MUST be on its own
> indented sub-bullet.** Only leaves (literals, bare names) may ride on the head
> line.

```markdown
* + `2` `3`              ✅  both operands are leaves
* + `2` * `3` `4`        ❌  the second operand (* 3 4) is a compound on the line
* +                      ✅  the compound operand is a sub-bullet
  * `2`
  * * `3` `4`
```

**Child order:** same-line leaves come first, then sub-bullets, top to bottom.
When unsure, the foolproof form is to put **every** operand on its own sub-bullet
— that always preserves argument order:

```markdown
* +
  * `2`
  * * `3` `4`
```

Indentation is **2 spaces per level**. Bullet marker is `*` or `-`.

---

## 2. Lexical structure

- **Headings** (`#` at column 0) open items: `# fn`, `# struct`, `# enum`. A bare
  `# name` is shorthand for `# fn name`. (`# impl` / `# trait` are **not**
  supported in v1 and are rejected.)
- **Bullets** under a heading, up to the next heading, are that item's body.
- **Tokens** are whitespace-separated, except a backtick span `` `...` `` is one
  token even if it contains spaces.
- **Literals** are backtick-wrapped. **Bare** tokens are names (bindings, item
  names) or operator/keyword names.
- Blank lines are ignored. Non-bullet, non-heading prose lines are ignored.

### Literals

| Form | Type | Example |
|------|------|---------|
| `` `42` ``, `` `-3` `` | `i64` | `* let n `42`` |
| `` `true` ``, `` `false` `` | `bool` | `* let ok `true`` |
| `` `"hello"` `` | `String` | `* let s `"hello"`` |

A backtick token that is neither integer nor `true`/`false` is a `String`
(quotes, if present, are stripped at runtime).

---

## 3. Types (v1)

Sorts: `i64`, `bool`, `String`, `Vec` (sequence of `i64` only in v1), unit `()`
(written `Unit` internally), shared ref `& T`, exclusive ref `&mut T`, and any
`struct`/`enum` you define.

- **Copy** (using them leaves the source valid): `i64`, `bool`, `()`, `& T`.
- **Move** (using them by value invalidates the source): `String`, `Vec`,
  `&mut T`, and every `struct` / `enum`.

A type in a `params`, `returns`, field, or variant position is written as tokens:
`i64`, `String`, `& i64`, `&mut Vec`, `Point`, etc.

---

## 4. Items

### 4.1 Functions

```markdown
# fn add
* params
  * i64 a b
* returns i64
* +
  * a
  * b
```

- `params` bullet: each sub-bullet is a **prefix** declaration `type name [name…]`
  — the type comes first (like every other form), then one or more names. `i64 a
  b` declares both `a` and `b` as `i64`; you may also split them across bullets
  (`i64 a` then `i64 b`). Ref types work too: `& i64 r`, `&mut Vec v`. Omit
  `params` for no parameters.
- `returns` bullet: names the return type. Omit it to return `()`.
- Remaining bullets are the body, evaluated in order. The function's value is its
  **last body expression**, unless an explicit `return` appears earlier.
- `# main` is the zero-parameter entry point and is **required**. A program with
  no `# main` is rejected.
- Item names must be unique.

Recursion is just a call to the same `fn`; provide a base case.

### 4.2 Structs (product types)

```markdown
# struct Point
* i64 x y
```

- Each bullet declares one or more fields of a type, prefix: `type name [name…]`.
  `i64 x y` declares both `x` and `y` as `i64`; fields of different types go on
  separate bullets (`String name` then `i64 age`).
- **Construct** positionally, in declaration order: `Point `2` `3``.
- **Read a field** with the `.` operator: `. p x` is `p.x`. The base must be a
  binding name; field access is one level deep.
- Structs are **move** types. Moving a move-type field out is a **partial move**
  (see §6.3).

### 4.3 Enums (sum types) and pattern matching

```markdown
# enum Option
* Some
  * i64
* None
```

- Each bullet is a variant. A payload type goes on a **sub-bullet**; a variant
  with no sub-bullet carries no payload.
- **Construct**: `Some `7`` (one payload) or `None` (nullary).
- Variant names are global within a program and must be unique.
- There is no built-in `Option`/`Result`; define the enum you need.

**`match`** takes a scrutinee then one bullet per arm:

```markdown
* match o
  * Some n
    * print n
  * None
    * print `0`
```

- Arm head is a **variant name** or `_` (wildcard). A payload variant binds **one
  atom** (here `n`) to its payload; the remaining sub-bullets are the arm body.
- The `match` value is the first arm's body value.
- **Exhaustiveness is enforced:** every variant must be covered, or a `_` arm must
  be present. A missing variant with no wildcard is rejected (`non-exhaustive`).
- **Ownership:** matching a move-type scrutinee **by value moves it** into the
  arms. To match without moving, match a borrow — put `& o` on a sub-bullet:
  ```markdown
  * match
    * & o
    * Some n
      * print n
    * None
      * print `0`
  ```

---

## 5. Bindings and built-in operations

### 5.1 `let`

```markdown
* let x `5`           inline leaf initializer
* let y               compound initializer on a sub-bullet
  * + `2` `3`
* let mut v           `mut` makes it mutable
  * vec `1` `2` `3`
```

- Order of tokens: optional `mut`, the name, then the initializer.
- A bare `=` between name and initializer is **cosmetic** and ignored:
  `let x = `5`` ≡ `let x `5``.
- The initializer must be a **single** expression (a leaf on the line, or one
  compound on a sub-bullet). More than one child is a parse error.
- **Immutable by default.** Without `mut`, assigning to it or taking `&mut` of it
  is rejected.

### 5.2 Operators and forms

| Form | Operands | Result | Notes |
|------|----------|--------|-------|
| `+ - * / %` | two `i64` | `i64` | integer; `/` truncates |
| `< <= > >= == !=` | two `i64` | `bool` | |
| `and` `or` | two `bool` | `bool` | short-circuit |
| `not` | one `bool` | `bool` | |
| `if cond cons alt` | `bool`, expr, expr | type of `cons` | `alt` optional; only the taken branch runs |
| `vec` | `i64`… | `Vec` | v1 vectors hold `i64` |
| `push target elt` | a `Vec` binding, `i64` | `()` | **mutates**: needs `mut` and no live borrow |
| `print expr` | any | `()` | renders to output |
| `& x` | a binding/field | `& T` | shared borrow |
| `&mut x` | a `mut` binding/field | `&mut T` | exclusive borrow |
| `. base field` | struct binding | field type | field read / move-out |

Arithmetic and comparison are used as **binary** (the runner evaluates two
operands). Write one operator per pair.

`if` returns the consequent's type; keep both branches the same type when the
result is used.

---

## 6. The checker — what gets your program rejected

Memory safety is proven before the program runs. These are the diagnostic classes
and how to avoid them.

### 6.1 Ownership / move (`use-after-move`)

Using a **move-type** binding by value (as a `let` source, a by-value argument, a
`return`, or a `match` scrutinee) transfers ownership and marks the source
**moved**. Any later use is rejected.

```markdown
# fn take
* params
  * String s
* print s

# main
* let s `"hi"`
* take s            s is moved into take
* print s           ❌ use-after-move
```

`Copy` types (`i64`, `bool`, `& T`) are **not** moved by such use; the source
stays valid.

### 6.2 Borrowing — aliasing XOR mutability (`borrow-conflict`)

At any moment a binding may have **either** any number of shared `&` borrows **or
one** `&mut` borrow — never both. Mutating (or `&mut`-ing) a binding while a
borrow of it is live is rejected.

```markdown
# main
* let mut v
  * vec `1` `2` `3`
* let r
  * & v             shared borrow begins
* push v `4`        ❌ borrow-conflict: v mutated while r borrows it
* print r           the borrow is still live here
```

This is the project's litmus program; it **must** be rejected.

**Lexical lifetimes:** a borrow is live from where it is taken until the **end of
the enclosing scope** (not its last use). To end a borrow earlier, you cannot —
restructure so the mutation happens before the borrow is taken, or scope the
borrow inside a smaller block (e.g. a called function).

### 6.3 Struct fields: partial moves and disjoint borrows

Each struct field has its own ownership/borrow state.

- Moving a move-type field out marks **that field** moved; siblings stay usable;
  but the **whole struct can no longer be used by value**.
  ```markdown
  * let n
    * . u name        moves u.name (String) out — partial move
  * print
    * . u name        ❌ use-after-move: u.name
  ```
- Two **different** fields may be borrowed at once (disjoint):
  ```markdown
  * let r
    * & 
      * . p a
  * let s
    * &
      * . p b         ✅ a and b are independent
  ```
- Borrowing the whole struct while a field is borrowed (and vice versa) conflicts.
- Field mutability follows the binding: `&mut` of a field requires the struct
  binding to be `mut`.

To **borrow a field**, the `.` access is a compound, so it goes on a sub-bullet
under `&` / `&mut` (as above). `& p a` does **not** borrow `p.a` — it borrows the
whole `p` and ignores the stray `a`.

### 6.4 Dangling references (`dangling-reference`)

A reference must not outlive its referent. Returning `&` of a local (or a local's
field) is rejected.

```markdown
# fn dangle
* returns & i64
* let x `5`
* & x               ❌ returns a reference to x, dropped when dangle returns
```

### 6.5 Immutability (`mutate-immutable`)

Mutating or `&mut`-ing a binding not declared `mut` is rejected.

### 6.6 Exhaustiveness (`non-exhaustive`)

A `match` that omits a variant and has no `_` arm is rejected, naming the missing
variant(s).

### 6.7 Others

`type-mismatch` (wrong operand/field/argument/payload type), `undeclared`
(unknown name, operator, or field), `arity` (wrong number of arguments, fields, or
payload values), `no-main`, `duplicate-item`.

---

## 7. Complete worked examples

### Arithmetic
```markdown
# main
* let x
  * + `2` `3`
* let y
  * * x `4`
* print y
```
→ `20`

### Recursion
```markdown
# fn factorial
* params
  * i64 n
* returns i64
* if
  * <= n `1`
  * `1`
  * * n
    * factorial
      * - n `1`

# main
* print
  * factorial `5`
```
→ `120`

### Struct + field access
```markdown
# struct Point
* i64 x y

# main
* let p
  * Point `2` `3`
* print
  * +
    * . p x
    * . p y
```
→ `5`

### Enum + exhaustive match
```markdown
# enum Option
* Some
  * i64
* None

# main
* let o
  * Some `7`
* match o
  * Some n
    * print n
  * None
    * print `0`
```
→ `7`

### A program that is *rejected* (the deliverable that earns the name)
```markdown
# main
* let mut v
  * vec `1` `2` `3`
* let r
  * & v
* push v `4`
* print r
```
→ rejected: `borrow-conflict` (cannot mutate `v` while `r` borrows it). Not run.

---

## 8. Quick checklist before emitting a program

- [ ] Operator/keyword is the **first** token on every bullet (prefix).
- [ ] Every **compound** operand is on its own **sub-bullet**; only leaves ride on
      the head line. 2-space indent.
- [ ] All literals are backtick-wrapped; names are bare.
- [ ] There is exactly one `# main` (zero params).
- [ ] `params` sub-bullets are `type name [name…]` (type first); `returns` names
      the type.
- [ ] Struct construction is **positional**; field reads use `. base field`.
- [ ] Enum `match` covers every variant or has a `_` arm.
- [ ] No use of a move-type value after it is moved/returned/matched-by-value.
- [ ] No mutation of a binding while it is borrowed, and no mutation/`&mut` of a
      non-`mut` binding.
- [ ] No `&` returned from a function that points at a local.

## 9. Not in v1 (do not use)

`impl`/`trait`, generics and trait bounds, methods, closures, a built-in
`Option`/`Result` prelude, the `?` operator, non-lexical lifetimes, `Vec` of
non-`i64`, named-field struct construction, multi-level field access
(`. (. a b) c`), string/Vec library operations beyond `push`, floats/unsigned
integers, tuples.
