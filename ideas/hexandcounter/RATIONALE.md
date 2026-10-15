# Hex & Counters — Rationale

Why each current choice is what it is. Decisions are `D-n`, open questions are `Q-n`, and
neither is ever renumbered. Rules and constants are named as in ONTOLOGY.md. The history of
changes is in ARCHITECTURE_LOG.md.

---

## Platform shape

### D-1 Five-module split: Artifacts / DisplayArtifacts / State / Engine / UI — *Decided*
- **Alternatives:** a single `index.js` (where this started); State+Engine merged into one
  class.
- **Why:** G-2. The server half (`GameArtifacts`, `GameState`, `GameEngine`, plus `Board`
  and `Piece`) runs headless; only `GameUI` and `GameDisplayArtifacts` touch the browser.
  Keeping State as pure data means it can be snapshotted and shipped without the rules.
- **Evidence:** R-18 (engine loads and plays with no DOM or display artifacts).

### D-2 Plain `<script>` globals, no ES modules — *Decided*
- **Alternatives:** ES modules (needs an HTTP server); a bundler.
- **Why:** G-5. ES modules fail under `file://`, and double-click-to-run beats module
  hygiene for a prototype base. IIFEs keep top-level names from colliding.
- **Evidence:** U-1 (manual).

### D-3 `Piece` and `Board` as the extension types — *Decided*
- **Alternatives:** bare `{q, r}` objects plus free functions over the hex `Map`.
- **Why:** G-1. Forks subclass `Piece` (hp, faction) and extend `Board` (zones of
  control, roads) instead of threading new parallel arrays through the engine. `Board`
  wraps rather than replaces `state.hexes`, so the state stays plain data.
- **Evidence:** R-19; forks Founders' Road and The Waking Isle were built on this base.

### D-4 Inert extension points instead of absent ones — *Decided*
- **Alternatives:** leave combat, targeting, and locations out entirely and let each
  fork add its own dispatch.
- **Why:** G-1, G-3. The UI_CONTROLS modal-flag stack is easy to get wrong when bolted on.
  `computeAttackable`, `locationAt`, and `targeting` already sit in the dispatch, so a fork
  fills them in without reordering anything.
- **Evidence:** R-20 (they stay inert here); X-1 measures whether forks actually find it so.

### D-5 Every command returns `{ ok, ... }` — *Decided*
- **Alternatives:** return values only where there's an outcome to report; throw on
  illegal input.
- **Why:** G-2. A network layer needs one result shape to serialize. `ok:false` = illegal
  and unchanged gives the client one check. It also lets the UI play the end-turn cue
  only when a turn actually ended.
- **Evidence:** R-23, R-9, R-14, R-21.

### D-6 The engine, not the UI, refuses moves after a win — *Decided*
- **Alternatives:** leave it to the UI's `gameWon` guard.
- **Why:** G-2, "never trust the client". A server can't rely on a client's guard, and
  `movePlayer` already re-derives legality for the same reason.
- **Evidence:** R-21.

### D-7 Events are proposed, not built — *Proposed*
- **Alternatives:** emit `PlayerMoved`/`EnemyMoved`/`TurnEnded`/`GameWon` now.
- **Why:** nothing animates and nothing broadcasts yet; the client re-renders from state.
  Build events with the first client that needs to animate enemy steps, or with the network
  layer.

---

## Determinism and generation

### D-8 All engine randomness through a seeded `Rando` — *Decided*
- **Alternatives:** `Math.random` everywhere; a seeded RNG for the map only.
- **Why:** G-4, and G-2 (a server and a client can agree on the AI by replaying the seed).
  Client-only randomness (sound) uses `Math.random`, so it never perturbs the game stream.
- **Evidence:** R-16, R-17.

### D-9 Retry up to `GEN_MAX_ATTEMPTS`, then fall back to `KNOWN_GOOD_SEED` — *Decided*
- **Alternatives:** retry forever (no bound on a pathological seed); keep the last
  pathless map (an unwinnable game); derive a new seed from the old one and retry.
- **Why:** every game must be winnable (X-4), and generation must stay bounded. A fixed
  known-good seed is the simplest guarantee: R-22 checks it builds a path on attempt 1. It
  is recorded as `state.seed`, so the fallback game reproduces like any other.
- **Evidence:** `Measured by:` sampling 1000 seeds with `generateMap(seed, GEN_MAX_ATTEMPTS)`
  → 0 fallbacks. The fallback is rare enough that a repeated map is acceptable.

### D-10 Diamond-square heightmap, terrain by elevation percentile — *Decided*
- **Alternatives:** per-hex noise thresholds by absolute height; hand-made maps.
- **Why:** percentiles fix the terrain mix regardless of how the heightmap comes out, and
  the heightmap gives contiguous lakes and ranges for routing around, which the movement
  puzzle needs. Edges forced to water frame the map.
- **Evidence:** R-2, R-3.

### D-11 Pure-movement terrain names (FOREST, SCRUB, ROUGH) — *Decided*
- **Alternatives:** keep Realm's GOLD and QUARRY.
- **Why:** G-6. Resource-sounding names suggest an economy that doesn't exist, and a fork
  would have to explain them or delete them. Each terrain now means only its movement cost.

### D-12 No per-hex placeholder fields — *Decided*
- **Alternatives:** keep `resource`, `units`, and `controlled` as inert slots.
- **Why:** G-6. Nothing read them, and their shapes were Realm's. A fork adds the field its
  rule needs, in the shape that rule needs.

---

## Play

### D-13 Enemies wander one random step; they may stand on the target — *Decided*
- **Alternatives:** chase the player; guard the target; exclude the target hex.
- **Why:** the movement puzzle wants obstacles that make a planned route go stale, not an
  opponent (there's no combat or defeat). Letting an enemy sit on the target adds a little
  tension at the finish. It never blocks the target permanently, because random walkers
  move on.
- **Evidence:** R-15. Enemy pressure is deliberately not measured: if enemies block the
  path, the worst case is that the player waits a turn or two, which is acceptable.

### D-14 Player MP is `PLAYER_MP`, spendable across several moves; the turn auto-ends at 0 — *Decided, tuned by playtest*
- **Alternatives:** one move per turn; a manual end only.
- **Why:** splitting MP across moves is the classic hex-and-counter feel and makes
  slow terrain a real choice. Auto-ending at 0 MP removes a pointless click (UI_CONTROLS L1.4).
- **Evidence:** R-10, R-11.

### D-15 No combat and no defeat — *Decided*
- **Why:** §0 non-goals. This is a base; forks add combat through D-4's extension points.

---

## Open questions

None open.

## Deliberately left out

- Serialized commands and `GameState` (de)serialization: deferred until a server exists (G-2).
- Sprites or images for terrain: flat colors are enough for a base.
- Touch and gamepad input.
- A simulation harness for enemy pressure (re-route and lockout rates). The worst case is
  the player waiting, so it isn't worth the infrastructure.
