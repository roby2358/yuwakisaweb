# Markdown Is A Solver

Browser-only SMT playground: JSON facts + Markdown constraints → Z3 WASM → sat/unsat + model.

See `SPEC.md` for the language and `CLAUDE.md` for architecture notes.

## Run locally

```
npm install
npm run serve
```

Then open <http://localhost:8181>.

**Don't** open `index.html` directly (file://) or via IntelliJ's built-in preview / any plain static server. The page needs `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` to unlock `SharedArrayBuffer`, which pthreaded Z3 requires. `npm run serve` sets those headers; other servers don't, and `solver.check()` will fail opaquely at pthread creation.

## Other scripts

- `npm run bundle` — rebuild `vendor/z3-bundle.js` (only when bumping `z3-solver` or editing `scripts/entry.js`).
- `npm run upload` — re-upload the Z3 WASM to R2 (`wrangler login` required).
