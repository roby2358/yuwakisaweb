# MarkdownIsARust

A statically-checked systems language where Markdown is the syntax — and the compiler's job is to *reject* unsafe programs, not run them.

Headings are item definitions (`# fn`, `# struct`, `# enum`, `# trait`, `# impl`). Bullet nesting is the expression tree. Backticks are literals. But the surface is the easy part: what earns the name "Rust" is the **borrow checker** that runs over the tree — ownership, moves, and borrowing (aliasing XOR mutability) enforced at check time, with **no garbage collector**.

The litmus test is a program the language must refuse to compile:

```markdown
# main
* let mut v
  * vec `1` `2` `3`
* let r
  * & v
* push v `4`
* print r
```

A Rust rejects this — you can't mutate `v` while `r` borrows it. If it instead prints `[1, 2, 3, 4]`, it's a tree-walker with Rust-shaped bullets, not a Rust.

## Documentation

- [RUST.md](RUST.md) — the constraints that make a language a Rust, and how this project satisfies each. Start here.
- [SPEC.md](SPEC.md) — the surface syntax and checker behavior (authoritative).

## Try It

Open `index.html` in a browser. No build step, no dependencies.
