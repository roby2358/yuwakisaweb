# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

Do NOT read or reference any files outside this directory (the parent `yuwakisaweb/` or sibling projects). This game stands entirely on its own. Do not borrow patterns, names, or mechanics from other projects in the workspace.

## Running

No build step. Serve the directory over HTTP and open in a browser:

```bash
python -m http.server 8000
```

Validate modules load correctly:

```bash
node --input-type=module -e "import './config.js'; import './hex.js'; import './rando.js'; import './names.js'; import './game.js'; import './colortheory.js'; console.log('OK')"
```

No test framework is used in this project.

## Architecture

Vanilla JS (ES6 modules) + Canvas 2D. No external dependencies.

**Module responsibilities:**
- `config.js` — All game constants (terrain, units, enemies, structures, recipes, CRT, upgrade paths)
- `hex.js` — Hex math (axial coords, distance, neighbors, BFS/Dijkstra, A* pathfinding)
- `rando.js` — Seeded PRNG (mulberry32). All methods require an `rng` parameter (no defaults)
- `names.js` — Phoneme-based procedural name generator (19 names per game)
- `game.js` — Game state, logic, turn phases. Exports action functions that mutate state in-place
- `index.js` — Canvas rendering, input handling, HUD/panel UI. The only file that touches the DOM
- `colortheory.js` — Color palette generation (HSL/RGB conversion, scheme generators, colormaps)
- `DYNAMICS.md` — Game design document (gameplay mechanics only, not UI). When in doubt, `config.js` is the source of truth for current values.

**Data flow:** Player click → `index.js` calls `game.js` action → state mutates → `index.js` re-renders.

**Turn sequence** (in `endTurn`): production → defense → drift (enemy turn) → spawn → windfall → mandate check → advance turn.

## Unit System

**Base units** (recruitable at the Loom): Warden, Gatherer, Mason, Sentinel, Longbow, Seeker, Catapult.

**Four combat upgrade lines** — each has 4 tiers plus a unique tier-5 pinnacle (only one pinnacle allowed across all lines):
- **Sentinel line** (melee): Sentinel → Bulwark → Ironclad → Aegis → **Titan** (str 12)
- **Longbow line** (ranged): Longbow → Arbalest → Culverin → Lancet → **Devastator** (power 8)
- **Seeker line** (scout → ranged): Seeker → Ranger → Farseer → Oracle → **Prophet** (reveal 10)
- **Siege line** (AoE ranged): Catapult → Trebuchet → Bombard → Leviathan → **Worldbreaker** (power 10)

Upgrade costs follow a pattern: tier 2 costs P1, tier 3 costs P2, tier 4 costs P3, pinnacle costs all four P3 products. Each line draws from a different P1 resource.

**Combat distinction:**
- **Melee units** (`melee: true`): use CRT (Combat Results Table), attacker can die. Must be adjacent + have half MP.
- **Ranged units** (`range` + `power`): use RANGED_CRT, attacker is safe (misses instead of AE). Attack from distance without advancing.
- **AoE units** (`targeting: 'aoe'`): ranged attack hits target hex + all neighbors.

## Key Conventions

- **Slot IDs:** `R0a–R0d` (raw), `P1a–P1d` (tier 1), `P2a–P2d` (tier 2), `P3a–P3d` (tier 3). Enemy types: `E0`, `E1`, `E2`, `broodMother`
- **Hex coordinates:** Axial `(q, r)`, stringified as `"q,r"` via `hexKey()`
- **State is a single flat object** with units/enemies/structures as arrays and stockpile as a plain object
- **Seeded RNG everywhere** — same seed = identical game. Always pass `rng` to Rando methods
- **Stockpile helpers:** `afford()`, `spend()`, `refund()`, `addStock()` — use these instead of manual stockpile math
- **Death tracking:** use `markEnemyDead()` / `markUnitDead()` (and `*DeadAt` variants) to flag deaths and queue bang animations, then `sweepDead()` to remove them
- **No default parameters** on any function (per coding conventions). Fail fast on missing values
- **No stacking** — one unit per hex. Friendly hexes block movement entirely
- **Global stockpile** — no transport logistics. Resources are available everywhere
- **Buildings require 3-hex spacing** from each other and from the Loom (settlement)
- **Save/load:** `saveGame()` / `loadGame()` / `hasSavedGame()` / `clearSave()` persist state to localStorage
