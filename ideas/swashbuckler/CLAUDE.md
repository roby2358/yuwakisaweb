# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Waowisha is a new hex-grid, token-based browser game. The game is built on utility modules extracted from the [Realm](../realm/) project. The main game lives in `index.html`, `index.js`, and `index.css`, using the helper modules below.

## Running / Developing

No build or install step. Serve via HTTP for ES6 module imports:
```bash
npx serve .
# or
python -m http.server 8000
```

## Architecture

### Game files (to be created)

- `index.html` — Game page, loads `index.js` as ES6 module
- `index.js` — Game logic, state, rendering, event handling
- `index.css` — Game styles

### Helper modules (extracted from Realm)

| Module | Purpose | Key exports |
|---|---|---|
| `colortheory.js` | Color scheme generation (ported from Scala) and cached gradient colormaps | `ColorTheory` class (static scheme generators + instance colormap) |
| `hex.js` | Axial-coordinate hex grid math, A* pathfinding, Dijkstra BFS | `hexToPixel`, `pixelToHex`, `hexNeighbors`, `hexDistance`, `findPath`, `bfsHexes`, `getReachableHexes` |
| `terrain.js` | Diamond-square heightmap generation, terrain/resource/danger placement | `generateTerrain`, `populateTerrain`, `findStartingLocation` |

### Missing dependencies

`hex.js` and `terrain.js` import from `./config.js` and `./rando.js` which must be created. See Realm's `js/config.js` and `js/rando.js` for the originals to copy/adapt.

### Coordinate System

Axial coordinates `(q, r)` with pointy-top hexes. Hex objects stored in `Map<string, hex>` keyed by `"q,r"` strings via `hexKey()`.

### Hex Object Shape

```javascript
{ q, r, terrain, elevation, resource, controlled, settlement, units[], dangerPoint, installation, isEdge }
```

## Theme

Weird fantasy/sci-fi that deliberately blurs the line between the two genres. Swords and sorcery coexist with alien technology and dimensional anomalies. Factions conflict with each other and there is genuine evil in the world, but an overarching existential threat endangers everything—forcing uneasy choices between fighting enemies and confronting annihilation.

## Game Mechanics

### Interaction Flow
1. Click a friendly counter/token to select it
2. Reachable hexes highlight in yellow (uses `getReachableHexes` / `bfsHexes` from `hex.js`)
3. Click a highlighted hex to move the counter there
4. To attack: move onto a hex occupied by an enemy counter (landing on enemy = attack)

### Selection States
- **Nothing selected** — clicking a friendly counter selects it
- **Counter selected** — yellow highlight shows valid moves; clicking a highlighted hex moves/attacks; clicking elsewhere deselects

## Conventions

- Pure client-side JavaScript (ES6 modules, no Node/npm)
- No build step, no bundler, no external dependencies
- No tests
- All color values are 0–1 floats (not 0–255) unless converting to hex string
- Terrain types and resource types come from config constants (`TERRAIN`, `RESOURCE_TYPE`)
