# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Warrior is a single-player tactical hex RPG. Canvas rendering, ES6 modules, no build step or external dependencies. The player explores a procedurally generated hex world, fights chaos-spawned enemies, levels up, and seals breaches culminating in a fight against The Unraveler at the Maw.

## Running / Developing

No build or install step. Serve via HTTP for ES6 module imports:
```bash
npx serve .
```

## Architecture

### Module Dependency Graph
```
index.js (main game: state, rendering, input, combat, UI)
  ├─ config.js   (constants, terrain, enemy/equipment/skill/POI definitions)
  ├─ hex.js      (axial hex math, BFS/Dijkstra, A* pathfinding, draw helpers)
  ├─ rando.js    (Rando class: shuffle, choice, int, bellCurve, weighted)
  └─ colortheory.js (HSL/RGB conversion, color scheme generation)
```

- `terrain.js` and `renderer.js` exist but are unused — legacy from the Realm project
- `hex.js` imports `HEX_SIZE` from `config.js`; all other modules are leaf dependencies

### Game State (index.js module-level variables)

- `hexes`: `Map<"q,r", hex>` — the world grid (100x100 rectangular hex grid)
- `player`: object with `{q, r, stats, hp, aether, xp, level, gold, equipment, skills, inventory, statPoints}`
- `enemies`: array of `{id, type, q, r, hp, maxHp, homeQ, homeR, turnsSinceSpawn}`
- `pois`: array of points of interest (havens, villages, ruins, breaches, huts, the Maw)
- `phase`: `'player' | 'enemy' | 'dialog'` — controls what input is accepted
- `visible` / `revealed`: Sets of hexKeys for fog of war
- `targeting`: `{skill, validHexes}` or null — for skill/ranged target selection
- `reachable` / `attackable`: computed from BFS each time player is selected

### Turn Flow
1. **Player phase**: select → move/attack/skill → auto-end on 0 MP or manual end
2. **Enemy phase** (async with animDelay): each enemy moves by behavior (chase/kite/guard/teleport/boss) → attacks → boss spawning
3. **Spawn phase**: breach spawning rolls → turn increment → MP reset (halved if engaged)

### Coordinate System

Axial coordinates `(q, r)` with pointy-top hexes. Hex objects stored in `Map<string, hex>` keyed by `"q,r"` strings via `hexKey()`. Screen coordinates include pan offset via `hexToScreen(q, r)`.

### Combat System

- Melee: move onto enemy hex. If kill, occupy hex. If not, counter-attack.
- Ranged: press R to enter targeting mode (requires ranged weapon, costs 1 Aether)
- Skills: press 1-4 to activate (each usable once per turn, costs Aether)
- Damage: `Rando.bellCurve(strength)` — rolls 3x from 1..strength*2, divides by 3. Average equals strength.
- Enemies with `rangedAttack` field fire ranged in addition to melee; others use `attack` for either

### UI Structure

- Canvas renders the hex map, tokens, fog, highlights
- HTML overlay panels (Character/Skills/Inventory) slide in from right
- Dialog overlay for havens, villages, ruins, level-up, skill choice, shop
- Combat log: auto-fading entries in bottom-left
- Skill bar: bottom-center, shows 4 equipped skills
- HUD: top bar with HP/Aether/MP/XP bars, gold, panel toggle buttons
- Context bar: bottom, shows hovered hex terrain and enemy info

### Hex Object Shape
```javascript
{ q, r, col, row, elevation, terrain, poi, goldLooted, isEdge }
```

### Enemy Behaviors
- `chase`: A* toward player when in detection range, else wander
- `kite`: maintain 2-3 hex distance (Flux Archer)
- `guard`: stay within guardRadius of home POI (Breach Guardian)
- `teleport`: 30% chance to teleport near player (Phase Wraith)
- `boss`: chase + spawn minions every N turns (Unraveler)

## Conventions

- Pure client-side JavaScript (ES6 modules, no Node/npm)
- No build step, no bundler, no external dependencies
- No tests
- All color values are 0-1 floats internally, hex strings only for rendering
- Terrain types, enemy types, equipment, and skills are defined in `config.js`
- Game state is module-level variables in `index.js` (no global window pollution)
- `Rando` class for all randomness — `bellCurve(strength)` for damage rolls
- Equipment lookup via `ALL_EQUIPMENT[id]`, enemy defs via `ENEMY_DEFS[type]`, skills via `SKILLS[id]`
- `render()` calls `updateHUD()` at end — don't call both
- Phase management gates input: canvas clicks ignored when `phase !== 'player'`
- `deselectPlayer()` clears selection/reachable/attackable but NOT targeting state

## Design Documents

- `SPEC.md` — Full game specification with functional requirements
- `DYNAMICS.md` — Game design philosophy, key drivers, strategy analysis
