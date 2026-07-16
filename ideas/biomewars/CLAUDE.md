# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Biome Wars** is a browser hex game: an alien planet at war with itself. Five living
biomes fight a pressure war for territory, pushed by the auras of settlements (feed and
protect them) and blights (assault and cleanse them). The player is a lone hero who
gathers essence, buys talents, and tilts the war — long-running recurring play with a
persistent localStorage save, no victory condition, and defeat only when the last
settlement falls.

Authoritative gameplay docs live in `README.md` (intent + UI) and **`DYNAMICS.md`** (the
design journal: theme, psychological drivers, every mechanic with its numbers, the turn
loop, and the strategies/anti-strategies review). Read DYNAMICS.md before changing any
rule or tuning constant. The codebase is built on the
[Hex & Counters](../hexandcounter/) baseline.

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`**. Serving over HTTP also works if you prefer:
```bash
npx serve .
# or
python -m http.server 8000
```

To smoke-test the engine headlessly (no unit tests in this prototype — convention),
concatenate the DOM-free modules with a driver script and run under Node:
```bash
cat artifacts.js rando.js namegen.js hex.js gamestate.js gameengine.js driver.js > sim.js && node sim.js
```

## Architecture

### What actually runs

The game is **`index.html` + five game modules + shared libs + `index.css`**. It loads as
**plain `<script>` globals** (no ES modules) so the page runs from `file://` on a
double-click; `index.html` lists the scripts in dependency order and `index.js` is a thin
bootstrap that wires them together. The code is factored for an eventual client/server
split — the seam is drawn so State + Engine could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `BIOMES`, `BIOME_RULES` (move cost / hazard / yield / warring / name style), `CREATURES` archetypes, `TALENTS`, and `RULES` (every tuned constant, commented). Server-side; no colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — hex/counter geometry, `BIOME_COLORS`, vitality shade floor, creature/anchor/hero colors. Keyed off `GameArtifacts.BIOMES`; read only by `GameUI` and the pixel helpers in `hex.js`. |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — `seed`, `hexes`, `hero`, `creatures`, `anchors`, `names`, `turn`, `mp`, `phase`, `gameOver`, `eruptions`, `goldenAge`, `log`. Owns `toJSON`/`loadJSON` (the hexes Map round-trips through an array). No behavior, no DOM. |
| `gameengine.js` | `GameEngine` | **Rules + generation** over a `GameState`. DOM-free and render-free: methods mutate state and *return outcomes* (`{ ok, endedTurn?, flags? }`). Owns world gen (`newGame`, jittered-Voronoi biome assignment), the world phase (`endTurn`: hazard → creatures → fall → spawns → anchors → biome tick → age/eruption → decay → rest), player actions (`movePlayer`, `attack`, `gather`, `feed`, `buyTalent`), and derived hero stats. |
| `gameui.js` | `GameUI` | The **client**: canvas rendering (vitality-shaded biomes, counters, bars), DOM HUD + log + talent panel, camera/pan, hover, selection/overlay modal state, all input wiring, and **persistence** (localStorage save each world phase — the engine never touches storage). |

Shared libraries the game modules depend on:

| Module | Used for |
|---|---|
| `hex.js` | Axial hex math + `bfsHexes` (Dijkstra reachability), `Hex.key`, `inRange`, `drawHexPath`. Pixel helpers read `GameDisplayArtifacts.HEX_SIZE`; the axial math the engine uses needs neither artifacts file. |
| `rando.js` | `Rando` RNG helpers, **seedable** via `Rando.seed(n)` (mulberry32) so a fresh world reproduces from `state.seed` (a resumed save reseeds from seed+turn — mid-game determinism across reloads is not promised) |
| `namegen.js` | `NameGen` — seeded syllable name generator with a phoneme style per biome culture; names settlements, blights, creature species, and some biomes per world |

Server-readiness notes baked into the split: all randomness routes through the seeded
`Rando`; every player action re-derives legality inside the engine rather than trusting
caller-supplied costs (the "never trust the client" rule). `GameState` (de)serialization
exists and is exercised every turn by the save system. Still deferred — a serialized
command/protocol layer between UI and engine; today `GameUI` calls engine methods directly.

### Input architecture (see `UI_CONTROLS.md`)

`UI_CONTROLS.md` is the **controls specification** for this family of hex-and-counter
games. `gameui.js` carries the layer citations (`L1.2`, `L2.1`, …):

- A stack of modal flags decides what any click/key means: `overlay` → `targeting` →
  `selection`, with `phase` gating the whole thing. Handlers check them in that priority order.
- Overlays: `'intro'` (DOM, Continue/New World), `'talents'` (DOM panel), `'goldenage'`
  and `'defeat'` (canvas banners). Esc peels back one modal layer, deepest first (L2.2);
  the intro only dismisses via its buttons.
- `selection = { reachable, attackable }` is computed once at select time; the click
  handler is a pure lookup (L1.2). **Combat is live** (L3): `computeAttackable()` returns
  adjacent creatures and blights. Any action spending the last MP auto-ends the turn (L1.4).
- Action hotkeys and HUD buttons are twin activators (L2.3): G gather, F feed, T talents,
  Space/Enter end turn.
- Still inert: modal `targeting` (L4, no aimed abilities) and `locationAt()` (L2.1
  returns null). The dispatch already routes to them when filled in.

### Coordinate system

Axial `(q, r)`, pointy-top hexes, stored in a `Map<string, hex>` keyed by `"q,r"` via
`Hex.key()`. The grid is a rectangle of `MAP_COLS × MAP_ROWS` with a per-row
`qOffset = -floor(row/2)`. Pan is a screen-space offset in `hexToScreen`/`screenToHex`.

### Hex object shape (as built in `gameengine.js`)

```javascript
{ q, r, col, row, elevation, isEdge, biome, vitality }
```

## Game Model (see DYNAMICS.md — the numbers all live in GameArtifacts.RULES)

- **Map**: 60×40; elevation percentiles give neutral Sea (low + edges) and Crag (high);
  the rest is jittered-Voronoi around 9 anchors (2 settlements × meadow/spore/crystal,
  2 ash + 1 writhe blights).
- **The war**: each turn every warring hex sums pressure (same-biome neighbors +1 each,
  anchor auras `1 + prosperity/20` with 0.5/hex falloff — prosperity buys *reach*).
  Pressure deficit drains vitality ×8; at 0 the hex flips. Settlements self-grow only to
  50 (feeding pushes to 100); **blight prosperity is uncapped** — the doom clock.
- **Hero**: HP/MP/essence + 8 talents (one passive template). Gather 2 MP (drains the
  hex), attack 2 MP, feed 1 MP; hostile biomes deal hazard damage per turn but yield more.
- **Creatures**: per-biome archetypes, friendly (heal adjacent) or hostile (chase, but
  never across a biome border); ecology spawning under a per-biome cap.
- **Death**: respawn at the strongest settlement, −half essence. **Defeat**: last
  settlement gone. **Golden age**: cleansing all blights → 12 boom turns → a bigger
  eruption. No victory condition; the game is a long-running tend-and-fight loop.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build step,
  no bundler, **no tests** (prototype convention: verify with the headless Node sim and
  browser playtest). Each module wraps its definition in an IIFE assigning one global.
- No save-game migration while prototyping: shape changes may just break old saves.
- Rules text/labels the engine puts in log messages live in `GameArtifacts`; anything
  purely visual lives in `GameDisplayArtifacts` (the engine never reads it).
- When tuning, change `GameArtifacts.RULES` and re-run the tempo probe (halve/double
  first); keep DYNAMICS.md's numbers in sync — it is the authoritative design record.
