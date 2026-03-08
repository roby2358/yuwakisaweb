# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Waowisha is a hex-grid, token-based tactics game set in a weird fantasy/sci-fi world where swords and sorcery coexist with alien technology and dimensional anomalies. The player commands a 4-unit warband sealing Void Rifts at the map edges before the Unraveling consumes the world.

## Running / Developing

No build or install step. Serve via HTTP for ES6 module imports:
```bash
npx serve .
# or
python -m http.server 8000
```

## Architecture

### Game files

- `index.html` — Game page, loads `index.js` as ES6 module
- `index.js` — Game state, turn flow, rendering (canvas), input handling, enemy AI
- `index.css` — Dark-themed UI styles
- `config.js` — All game constants (terrain, units, void spread, colors)
- `rando.js` — Random number utilities (`Rando` class with shuffle, choice, weighted, etc.)

### Helper modules (extracted from Realm)

| Module | Purpose | Key exports used by index.js |
|---|---|---|
| `hex.js` | Axial hex math, A* pathfinding, Dijkstra BFS | `hexToPixel`, `pixelToHex`, `hexNeighbors`, `hexDistance`, `drawHexPath`, `bfsHexes` |
| `terrain.js` | Diamond-square map generation, resource/danger placement | `generateTerrain`, `populateTerrain`, `findStartingLocation` |
| `colortheory.js` | Color scheme generation and cached gradient colormaps (not currently used by the game) | `ColorTheory` class |

### Key Data Structures

**Hex object**: `{ q, r, terrain, elevation, resource, isEdge, isRift, riftStrength, turnsUntilSpawn, originalTerrain, ... }`

**Hexes**: `Map<string, hex>` keyed by `"q,r"` via `hexKey()`. Axial coordinates (q, r), pointy-top.

**Unit object**: `{ id, type, faction, name, attack, defense, hp, maxHp, speed, symbol, q, r, moved }`

**Units**: `state.units` array. Factions: `'player'` and `'enemy'`.

### Turn Flow (index.js)

`endPlayerTurn()` is async and runs phases sequentially:
1. **Enemy phase** (`enemyTurn`) — AI moves/attacks
2. 400ms delay
3. **Void phase** (`voidPhase`) — corruption spreads, rifts spawn enemies, void damage
4. 400ms delay
5. **Player phase** (`startPlayerTurn`) — heal, reset moved flags

Wrapped in try/catch — errors recover by calling `startPlayerTurn()` so the game never gets stuck.

### Movement System

- BFS via `reachableHexes()` wrapper around `bfsHexes` with custom `movementCostFor()` function
- Void hexes cost 2x their original terrain's movement cost (stored in `hex.originalTerrain`)
- **1-step minimum**: all units can always move to any adjacent hex regardless of terrain cost (added manually after BFS)
- Yellow highlight = valid moves, red highlight = attackable enemies

### Combat

```
damage = max(1, attacker.ATK - defender.DEF - terrain_defense_bonus)
```
No counter-attack. Killing defender = attacker moves onto hex. Landing on a rift = seals it.

### The Unraveling

Void spreads from rift hexes with terrain-dependent chance per turn (plains 45%, hills 25%, mountains 12%). Water blocks spread entirely. Units on void take 1 damage/turn.

### Healing (start of player phase, sources stack)

- +1 passive regen on non-Void terrain
- +1 on resource hexes (forest/quarry/gold)
- +1 rest bonus if unit didn't act last turn
- +1 Spore Marine aura to adjacent allies

## Documentation

- **DYNAMICS.md** — Authoritative reference for all game mechanics, formulas, and numeric values. Update when mechanics change.

## Conventions

- Pure client-side JavaScript (ES6 modules, no Node/npm)
- No build step, no bundler, no external dependencies
- No tests
- Canvas-based rendering with camera pan (click-drag)
- All color values are 0–1 floats in colortheory.js; hex strings elsewhere
- Terrain/resource/unit types defined as constants in `config.js`
