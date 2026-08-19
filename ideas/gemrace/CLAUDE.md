# Gemrace Development Guide

## Project

Gemrace is a dependency-free browser game on a 60×60 pointy-top hex map. The player leaves a central home city, finds the three non-respawning Sunstones, and returns home while monsters pursue. Ordinary gems enter an inventory and temporarily replace one game rule when activated.

Authoritative rules live in `DYNAMICS.md`; player controls live in `README.md`.

## Running and Testing

Open `index.html` directly. Scripts are plain globals so `file://` works without a build step.

Run the DOM-free regression suite with `node test/smoke.js`.

## Domain Ontology

- **Home**: the central city represented by `state.home`. It is both the origin and return objective.
- **Player**: the movable `state.player` piece with movement points (`state.mp`).
- **Monster**: an unkillable pursuing piece in `state.monsters`. Monster contact loses the expedition unless Ward absorbs it.
- **Sunstone**: the special `sunstone` gem type. Exactly three are generated and none respawn. Progress is `state.sunstones`.
- **Ordinary gem**: one of six colored collectible types stored in `state.inventory`.
- **Gem effect**: a rule sampled from `GEM_EFFECTS` and assigned to a color in `state.effectByGem`. `state.activeEffect` records `gemType` and remaining turns.
- **Status**: one exclusive value in `state.status`: `playing`, `won`, or `lost`.
- **Phase**: the currently resolving actor group: `player` or `monsters`.

Do not reintroduce generic `target`, `enemy`, or `goal` names for these concepts. Generic targeting language remains appropriate inside reusable algorithms such as pathfinding.

## Architecture

| Module | Role |
|---|---|
| `artifacts.js` | Server-safe rule definitions: terrain, movement, gems, map, and actor constants. |
| `displayartifacts.js` | Client-only colors, geometry, terrain names, home styling, and gem-cut silhouettes. |
| `gamestate.js` | Authoritative serializable game data only. |
| `gameengine.js` | Seeded generation and game-rule mutations; no DOM or canvas. |
| `gameui.js` | Canvas rendering, HUD, camera, selection, overlays, and input. |
| `board.js` | Terrain and neighborhood queries over `state.hexes`. |
| `piece.js` | Positioned token used by player, home, and monsters. |
| `hex.js` | Axial math, pathfinding/reachability, and canvas hex paths. |
| `rando.js` | Seeded gameplay RNG. |
| `sound.js` | Client-only WebAudio cues. |

`GameState` and `GameEngine` form the server-safe rules layer. `GameUI` calls the engine and renders state. Movement legality is recomputed inside `movePlayer`; callers are not trusted to supply costs.

## Generation Invariants

1. Generate and classify the 60×60 terrain grid.
2. Choose a near-center passable home with six passable neighbors.
3. BFS from home and sink disconnected passable islands.
4. Spawn monsters, exactly three Sunstones, and 45 ordinary gems on connected land.
5. Sample six distinct effects from the twelve-effect pool and assign them to ordinary gem colors.

All gameplay randomness routes through `Rando`, making a seed reproduce terrain, actors, gems, and effect assignments.

## Conventions

- Keep rule data in `GameArtifacts` and visual data in `GameDisplayArtifacts`.
- Keep `GameState` behavior-free and trivially snapshot-able.
- Express one domain fact once; avoid parallel arrays, duplicate coordinates, or mutually exclusive booleans.
- Use exact game vocabulary in state and engine APIs.
- Preserve plain-script load order and direct-file operation unless a task explicitly changes the platform.
