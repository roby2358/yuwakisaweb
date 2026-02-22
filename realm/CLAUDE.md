# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Realm is a browser-based, turn-based strategy game where players guide a civilization through growth phases—from barbarian tribes to kingdoms and empires—managing settlements, military units, and resources while dealing with enemies and inevitable societal decline.

**Key characteristics:**
- Single-player, browser-based (no server required)
- Turn-based gameplay on a hex grid map
- 100% client-side JavaScript using ES6 modules
- No build step, bundler, or external dependencies

## Running the Game

Serve the directory via HTTP (required for ES6 modules):
```bash
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` (or appropriate port) in a browser.

## Architecture

### Module Organization

```
js/
├── main.js       # App entry (App class), event handlers, modals
├── game.js       # Core Game class: state, settlement/unit/enemy logic, turn processing
├── config.js     # All constants (terrain, units, settlements, eras, costs)
├── hex.js        # Hex coordinate math, A* pathfinding
├── terrain.js    # Diamond-square map generation, resource/danger placement
├── render.js     # Canvas rendering (terrain, units, settlements)
├── ui.js         # DOM updates, action panel, info panel
├── production.js # Resource calculation with modifiers
├── society.js    # Society management actions and effects
├── collapse.js   # Civilization collapse mechanics
├── rando.js      # Seeded random number generator
└── utils.js      # Utility functions (gaussian distribution)
```

### Data Flow

```
User Input → main.js → game.js state update → render.js + ui.js
```

### Key Data Structures

**Hex object:** `{ q, r, terrain, elevation, resource, controlled, settlement, units[], dangerPoint, installation }`

**Hexes stored in Map:** `game.hexes.get(hexKey(q, r))` where `hexKey` returns `"q,r"` string

### Coordinate System

Uses axial coordinates (q, r) with pointy-top hexes. See `hex.js` for pixel conversion and distance calculations.

## Documentation

- **SPEC.md**: Technical specification with requirements and UI layout
- **DYNAMICS.md**: Detailed game mechanics including formulas, turn order, and all numeric values

These documents are the authoritative source for game rules and should be updated when mechanics change.

## Key Implementation Details

### Turn Processing Order (game.js)
1. Unit refresh (heal, reset movement)
2. Danger point occupation checks
3. Enemy spawning
4. Enemy AI (attacks, then movement)
5. Resource production
6. Settlement growth
7. Settlement spawning
8. Society parameter updates
9. Era/collapse checks

### Combat Formula
```javascript
expectedDamage = attack² / (attack + defense)
damage = floor(max(0, expectedDamage + gaussian() * stddev))
```

### Settlement Growth
- Growth per turn: `floor(10 × (1 + tier)^1.5)` (polynomial)
- Growth threshold: `floor(50 × 2.1^tier)` (exponential, hardcoded values)
- Manual upgrade required at tiers 5→6 and 8→9

### Influence Calculation
Gaussian falloff from settlements:
```javascript
influence = strength * e^(-(distance² / (2 * (radius/2)²)))
```
