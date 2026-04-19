# Rust + WASM Rewrite: Design Notes

A sketch of what it would look like to move the core of Warrior into Rust, compile
to WebAssembly, and keep the existing HTML/Canvas shell.

## Current shape

- ~6,700 LOC of pure ES6 modules, no build step, no dependencies.
- `index.js` (3,661 lines) mixes simulation state, input handling, canvas
  drawing, and DOM overlay management.
- Pure-logic modules that don't touch DOM: `hex.js`, `rando.js`, `terrain.js`,
  `world.js`, `enemies.js`, `player.js`, `victory.js`, most of `config.js`.
- Render-tied modules: `index.js` (draw loop + input), `sprite_sheet.js`,
  `renderer.js` (unused), `sound.js`, `colortheory.js` (used at gen time).
- Served with `npx serve .` — no toolchain today.

## Where the Rust/JS seam goes

Put the **simulation** in Rust. Keep **presentation** in JS.

| Module                        | Moves to Rust? | Notes                                                     |
|-------------------------------|----------------|-----------------------------------------------------------|
| `hex.js` (axial math, A*, BFS)| Yes            | Pure, hot, bounded — ideal Rust target.                   |
| `terrain.js`, `world.js`      | Yes            | Seeded procedural gen, one-shot at new-game.              |
| `enemies.js` (AI behaviors)   | Yes            | Chase/kite/guard/teleport/boss — pure state transitions.  |
| `player.js`, `victory.js`     | Yes            | Stat math, level-up, win/loss checks.                     |
| `rando.js`                    | Yes            | Replace `Math.random()` with a seeded PRNG (e.g. `SmallRng`). |
| `config.js`                   | Split          | Constants → Rust; definition tables stay data-driven (JSON). |
| `index.js` draw loop          | No             | Canvas 2D API is easiest to call from JS.                 |
| DOM overlays (HUD/panels/dialog) | No          | Don't port. JS owns the DOM.                              |
| `sound.js`, `sprite_sheet.js` | No             | WebAudio + Image are JS-native.                           |

Target split: roughly 3,500 lines into Rust (simulation) and ~3,000 stays in
JS (render + DOM).

## Proposed crate layout

```
crates/warrior-core/
  Cargo.toml
  src/
    lib.rs              # #[wasm_bindgen] surface
    hex.rs              # axial coords, neighbors, A*, BFS, Dijkstra
    world.rs            # hex grid, terrain gen, POI placement
    player.rs           # stats, xp, equipment, skills
    enemies.rs          # enemy defs + behaviors
    combat.rs           # damage rolls, skill resolution
    rng.rs              # seeded Rando
    save.rs             # serde serialize/deserialize
    ffi.rs              # FFI types + render snapshot
```

Build with `wasm-pack build --target web`. No webpack needed — the generated
ES module imports cleanly from vanilla `index.html`.

## FFI boundary

Two options, ordered by simplicity:

**A. Thin command/query API (recommended).**
JS sends discrete intents, asks for a render snapshot each tick.

```rust
#[wasm_bindgen]
pub struct Game { /* world, player, enemies, phase, rng */ }

#[wasm_bindgen]
impl Game {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64) -> Game { ... }

    pub fn click_hex(&mut self, q: i32, r: i32) -> JsValue { /* event log */ }
    pub fn press_key(&mut self, key: &str) -> JsValue { ... }
    pub fn end_turn(&mut self) -> JsValue { ... }

    pub fn snapshot(&self) -> JsValue {    // serde_wasm_bindgen
        /* visible hexes, tokens, HUD numbers, log */
    }

    pub fn save(&self) -> String { ... }   // JSON for localStorage
    pub fn load(json: &str) -> Game { ... }
}
```

JS's draw loop becomes: read `snapshot()` → paint canvas → update DOM. The
seam is narrow, easy to reason about, and `serde_wasm_bindgen` handles
conversion.

**B. Shared-memory views.** Expose raw typed arrays (hex grid as `Uint8Array`
view into WASM linear memory) to avoid per-frame serialization. Faster but
couples JS to Rust memory layout. Only worth it if `snapshot()` shows up in
a profile — unlikely for a turn-based game.

## Toolchain additions

Going from "no build step" to "has a build step" is the real cost.

- `rustup` + `wasm32-unknown-unknown` target
- `wasm-pack` (one command: `wasm-pack build --target web --release`)
- Output `pkg/warrior_core.js` + `pkg/warrior_core_bg.wasm` committed or
  built via CI
- `index.html` gains one `import init from './pkg/warrior_core.js'`

Dev loop: `wasm-pack build --dev` (~2s incremental) then `npx serve .` —
still no bundler. Release build is cold-compile ~15–30s.

## Migration strategy

Incremental, not big-bang. Order by "purest first":

1. **`hex.rs`** — port axial math, neighbors, `bfs`, `dijkstra`, A*. Swap
   JS callers to call WASM; keep JS `hex.js` until nothing imports it.
2. **`rng.rs`** — seeded PRNG. Now runs are replayable, which is a nice
   side-benefit for bug reports.
3. **`world.rs` + `terrain.rs`** — world gen. One-shot call returns the grid.
4. **`combat.rs`** — damage rolls + skill resolution. Still called from JS
   turn loop.
5. **`enemies.rs`** — enemy AI and the enemy phase.
6. **Promote `Game` struct** to own the full turn loop. `index.js` shrinks
   to input + render + DOM.

Each step is shippable on its own. If momentum dies at step 3, the game
still works with JS doing the turn loop around a Rust world.

## What doesn't move

- Canvas draw calls (`ctx.fillRect`, `drawHexPath`, sprite blitting)
- DOM overlays (Character/Skills/Inventory panels, dialog, HUD)
- CSS + HTML
- `sound.js` (WebAudio)
- Input event listeners — they translate DOM events into `game.click_hex(...)`

`colortheory.js` probably stays in JS too — it runs once at startup and
produces a color palette that the renderer uses directly.

## Testing wins

Rust gets `cargo test` for free. Turn-order invariants, pathfinding on
hand-crafted maps, damage distribution (`bellCurve` average equals
strength), victory/loss conditions — all the things that are awkward to
unit-test in a canvas-coupled JS file become one-liners in `#[test]` blocks.
Memory notes this project currently skips tests; Rust lowers the cost
enough that a few invariants are worth locking down.

---

## Benefits / Questionable Benefits

### Benefits (real)

- **Testability.** The simulation becomes a pure library. `cargo test` in
  watch mode on hex/pathfinding/combat is a genuine upgrade over testing
  anything inside a 3,661-line `index.js`.
- **Refactor confidence.** `enum Terrain`, `enum EnemyBehavior`, exhaustive
  `match` on phases — the compiler catches whole classes of "forgot the new
  terrain" bugs that the JS version can only find at runtime.
- **Determinism / replay.** A seeded PRNG + serializable `Game` state means
  "reproduce this bug from seed 0xABCD, turn 47" becomes trivial. Useful
  for balance work and bug reports.
- **Savegame durability.** `serde` + versioned enums give a real migration
  story instead of "whatever JSON `JSON.stringify(player)` produced last time."
- **Clean module boundary.** Forcing a thin FFI is its own discipline — it
  makes "what is state vs. what is view" obvious, which the current `index.js`
  blurs.

### Questionable Benefits

- **Performance.** The honest answer: none that you'll notice. Turns are
  human-paced, the world is 100×100, A* runs on a few thousand hexes once
  per enemy per turn. JS does this in sub-millisecond already. You're not
  CPU-bound; you're input-bound.
- **"Safer code."** TypeScript would get you most of the type-safety win for
  a fraction of the effort and zero toolchain change.
- **Smaller bundle.** Opposite, actually. The WASM binary plus glue will be
  larger than the current pure-JS source (maybe 100–300KB gz vs. ~80KB of
  JS). Fine for desktop, measurable on mobile cold-load.
- **Portability to a native build.** Tempting — `wgpu` + `winit` and you
  have a desktop game. But you'd be rewriting all the DOM UI (HUD, panels,
  dialogs) in an immediate-mode GUI, which is a much bigger project than
  the WASM port itself.
- **"It's a fun Rust project."** True, and a legitimate reason on its own.
  Just don't dress it up as an engineering necessity — for a solo hobby
  game that already runs fine with no build step, the main thing you're
  buying is the build step.

### Verdict

Worth doing if you want the testability + determinism, or if you're going
to use this project to learn Rust/WASM. Not worth doing for performance,
bundle size, or "JS is scary." The 3,661-line `index.js` is the real
problem, and splitting *simulation from presentation* is what fixes it —
you could do that within JS first, then decide whether Rust is still
pulling its weight.
