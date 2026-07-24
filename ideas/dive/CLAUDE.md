# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DIVE** is a browser hex-and-counter prospecting game: an undersea base (Berth
Station) in a colorful alien ocean, a submarine with unlimited range, a diver with
very limited O₂, materials to gather, predators to flee (never fight), and a
sell/craft upgrade loop ending in the Deepwave Beacon (the win). No defeat exists —
setbacks cost unbanked cargo, not the game.

Authoritative docs: `README.md` (intent + UI) and `DYNAMICS.md` (the **design
journal** — theme, psychological drivers, mechanics, and the strategies review; keep
it updated when mechanics change). The codebase is built on the
[Hex & Counters](../hexandcounter/) baseline and keeps its architecture and input
spec (`UI_CONTROLS.md`) verbatim.

## Running / Developing

No build or install step. Scripts load as plain globals, so you can **double-click
`index.html` to run from `file://`**. Serving over HTTP also works:
```bash
npx serve .
```

Verification is headless Node (no browser, no npm deps) — these are **persistent
harnesses, not throwaway scripts**; extend them when mechanics change:
```bash
node test/sim.js       # engine: generation, dive loop, predators, market economy
node test/uismoke.js   # gameui.js against a stubbed DOM/canvas/audio
```

## Architecture

**`index.html` + four game modules + shared libs + `index.css`**, loaded as plain
`<script>` globals in dependency order; `index.js` is a thin bootstrap. The seam is
drawn so State + Engine could run server-side unchanged:

| Module | Global | Role |
|---|---|---|
| `artifacts.js` | `GameArtifacts` | Static **rules-data** — `TERRAIN` bands, movement/O₂ tables, `NODE_TABLES`, `SELL_PRICES`, `UPGRADES`/`BEACON` recipes, predator parameters, map size. No colors/pixels. |
| `displayartifacts.js` | `GameDisplayArtifacts` | Client-only **display attrs** — geometry, terrain/material colors and names, counter colors, murk overlay. Read only by `GameUI` and the pixel helpers in `hex.js`; the engine never touches it (test/sim.js loads the engine without it, on purpose). |
| `gamestate.js` | `GameState` | Authoritative, **serializable data only** — seed, hexes (with `node` per hex), sub/diver/base positions, `diverOut`, o2/hull/credits, bag/hold counts, upgrade tiers, eels/leviathans/caches, `seen`, turn/mp/phase/gameWon. |
| `gameengine.js` | `GameEngine` | **Rules + generation** over a `GameState`. DOM-free: methods mutate state and *return outcomes*; `endTurn()` returns an **events list** (`blackout`/`maul`/`bite`/`wreck`/`wake`) that the UI turns into toasts and sounds. Owns generation, sight/murk, stealth, actions (move/dive/board/gather/scoop), the market (`sell`/`craft`/`craftBeacon`, all `isDocked()`-guarded), and the predator phase. |
| `gameui.js` | `GameUI` | The **client**: canvas rendering (murk, nodes, caches, counters), DOM HUD with dynamic context-action buttons, the market overlay panel, camera/pan, hover, selection, and input wiring. |

Shared libs: `hex.js` (axial math, `bfsHexes` Dijkstra, `findPath` A* — predators
chase with full A*, never local BFS), `rando.js` (seedable RNG — map, nodes, spawns,
and AI all reproduce from `state.seed`), `colortheory.js` (per-eel counter colors),
`sound.js` (`GameSound` WebAudio cues; randomizes with `Math.random` so it never
perturbs the seeded stream).

### Input architecture (see `UI_CONTROLS.md`)

Same layered spec as the baseline: modal priority `overlay` → `targeting` →
`selection`, phase gating, pure-lookup click dispatch, Esc peels one layer.
Game-specific notes:

- The L2.1 primary action (Space/Enter) is the first available context action
  (Market > Board > Scoop > Gather) — **never Dive** (deliberate: Space during sub
  transit must stay End Turn), falling back to End Turn.
- Overlays are `intro`, `market` (DOM panel, rebuilt after every transaction), and
  `victory` (canvas-drawn).
- `computeAttackable()` is empty **forever by design** — fleeing is the combat.
  `targeting` stays inert.

### Game model

See `DYNAMICS.md` for the full design. Load-bearing invariants:

- **Two counters, one player**: `diverOut` picks the active counter; movement costs,
  MP caps, and sight all dispatch through one point (`activeMoveCost`, etc.).
- **Asymmetric predation**: eels hunt only the diver (sense 5, blind to kelp cover);
  leviathans hunt only the sub, and only on turns it moved (`subMoved` = engine
  wake), swim only deep/vent/trench, and always bite when adjacent.
- **One misadventure code path**: blackout and maul both route through `loseBag()` —
  bag → cache on the spot, rescue to sub, fee. Wrecks do the same for the hold.
- **Escalation tied to progress**: Attention = total upgrade tiers; drives the eel
  population target and leviathan wake thresholds. Time alone escalates nothing.
- **O₂ drains before predators move** in `endTurn()` — an overdrawn diver blacks out
  on their own math, not on an eel's.
- Upgrades are **one template**: `UPGRADES[key].values[tier]` — never add a bespoke
  upgrade effect; add a stat table.

## Conventions

- Pure client-side — plain `<script>` globals (no ES modules), no Node/npm, no build
  step. Each module wraps its definition in an IIFE assigning one global.
- Color values are 0–1 floats except when converting to `#rrggbb` strings for canvas.
- Rules values (terrain, costs, tables, recipes) come from `GameArtifacts`;
  colors/labels/geometry from `GameDisplayArtifacts` (client-only).
- No save-game serialization or migrations while prototyping; old state may just break.
