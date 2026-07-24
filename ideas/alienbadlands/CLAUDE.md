# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dustrunner** is a long-playing, recurring hex game: an alien-badlands prospecting/
bounty loop around a central starport, with a soft victory (buy the 4,000 cr offworld
ticket) and a persistent localStorage world. Built by extending the Hex & Counters
baseline (../hexandcounter/); its inert extension points (combat, locations) are now
live here.

Authoritative docs: `DYNAMICS.md` (design journal — theme, drivers, full rules, tuning
history) and `UI_CONTROLS.md` (the controls spec; `gameui.js` cites its layers).
`README.md` covers intent + UI. Read DYNAMICS.md before changing any rule or number.

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`** (or `npx serve .`). Never introduce ES modules.

### Verification (persistent harnesses — rerun these after engine/tuning changes)

```bash
node test/sim.js         # invariants: generation across seeds, 150-day random sim,
                         # save/load roundtrip, determinism
node test/econbot.js     # economy pacing: greedy bot; prints ticket day per seed
                         # (add a seed arg for a per-10-day trace)
node test/screenshot.js  # browser smoke + screenshots (needs: npm install puppeteer --no-save)
```

No test framework — each script throws/exits 1 on failure. The bots load only the
DOM-free modules into a `vm` context (top-level consts are lifted out via an eval).

## Architecture

Plain `<script>` globals in dependency order (see `index.html`); each module is an IIFE
assigning one global. Factored for a future client/server split — State + Engine could
run server-side unchanged.

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data**: `TERRAIN`, `FOOT_COST`/`BIKE_COST`, `NODES`/`NODE_PLAN`, `MATERIALS`, `PREDATOR_KINDS`, `BANDIT`, `UPGRADES` catalog, `BASE` stats, `ECON`, `WORLD`, name pools. No colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only display attrs: sizes, terrain/entity colors, glyphs. Read only by `GameUI` and `hex.js` pixel helpers. |
| `gamestate.js` | `GameState` | Serializable data only, plus `toJSON`/`fromJSON` (hex Map ⇄ per-row terrain arrays). **No save migration** — a broken save starts fresh. |
| `gameengine.js` | `GameEngine` | Rules + generation + the whole world simulation, DOM-free. Actions return `{ ok, events }`; `endTurn()` returns the world-phase event list. |
| `gameui.js` | `GameUI` | Canvas render (fog of exploration, counters), HUD, message log, location panel (market/workshop/ticket), input, **autosave** (`dustrunner-save` in localStorage). |
| `hex.js` / `rando.js` / `sound.js` | `Hex`+search fns / `Rando` / `GameSound` | Axial hex math, `bfsHexes` (Dijkstra), `findPath` (A*); seedable mulberry32 RNG; WebAudio cues (uses `Math.random`, never the seeded stream). |

### Engine shape (gameengine.js)

- **Stats are derived, never stored**: `stats()` = `BASE` + owned upgrade effects (one
  apply path; `rangeTwo` and `bikeHp` are the only special keys). Player HP and bike HP
  are the only stored stat values.
- **Events, not messages**: every mutation pushes typed events (`{type, …}`, optional
  `broadcast: true`); `GameUI.handleEvents` maps them to log lines + sounds and drops
  non-broadcast events outside sight radius.
- **Two cost tables**: `playerCost()` switches on `player.mounted`. Acid flats are
  bike-only; predators use per-kind passability (`crossesAcid`).
- **NPC movement**: `stepNpc()` = full A* (global vision) then walk within the MP
  budget — never local-BFS toward a target. Sonic-fence hexes (within 2 of a
  settlement) are impassable and untargetable for predators, via `fence()`.
- **Derived caches**: `region()` (foot-reachable pocket from the starport) and
  `fence()` are lazy and stable per world; `setState()` clears them — always swap
  states through it.
- **Turn = day**: player phase (MP, actions), then `endTurn()` runs bandits →
  predators → spawns/blooms → market drift → heal-at-settlement, and resets MP by
  mount state. Moves never auto-end the day (deliberate deviation from L1.4).

### Coordinate system

Axial `(q, r)`, pointy-top, `Map<"q,r", hex>` via `Hex.key`; rectangle of
`WORLD.MAP_COLS × MAP_ROWS` with per-row `qOffset = -floor(row/2)`; hexes carry
`col`/`row` (used by save format and bearings). Pan is a screen-space offset in
`GameUI`.

### Hex object shape

```javascript
{ q, r, col, row, elevation, isEdge, terrain, yield }
```
`yield` is non-null only on resource-node terrain; depleted nodes revert to their
`NODES[terrain].base` terrain. `elevation` is generation-only (not saved; 0 after load).

## Conventions

- Pure client-side, no npm deps at runtime, no bundler. Tests are the three harnesses
  above (prototype rule: no formal test suite required).
- All gameplay randomness goes through `Rando` (seeded); UI/audio randomness uses
  `Math.random` so it never perturbs the seeded stream.
- Rules/numbers live in `GameArtifacts`; anything visual lives in
  `GameDisplayArtifacts`; the engine never reads the latter.
- When tuning, follow DYNAMICS.md's process: halve-and-double, verify with
  `econbot.js`, then record the change in DYNAMICS.md's Tuning notes.
