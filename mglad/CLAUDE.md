# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monster Gladiators (MGLAD) — a browser-based JavaScript port of a 1992 Turbo C++ arena combat game. 32x32 sprites on a hexagonal map rendered to HTML5 canvas, with HTML/CSS UI panels. No build system, no bundler, no npm — vanilla JS loaded via `<script>` tags.

## Running

Open `index.html` in a browser. No build step.

## Architecture

All symbols are globals. Load order matters (defined in `index.html`):

1. **`mglad.js`** — Constants, enums, terrain data, archetypes, hex geometry, `InputManager`, `SoundEngine`, utilities (`R()`, `clamp()`, `delay()`, `hexNeighbor()`, `hexDist()`, `hexDirTo()`)
2. **`renderer.js`** — `HexRenderer`: sprite sheet loading/processing, hex clipping, terrain/monster/effect drawing. Loads `monsters.png`, `terrain.png`, `effects.png` with background removal
3. **`hexmap.js`** — `HexMap`: 19×19 hex terrain grid, movement, collision, placement. Map generators (`forestMap`, `arenaMap`, `ruinsMap`, `rockyMap`)
4. **`guy.js`** — `Guy`: gladiator stats, combat mechanics (`attack`, `hit`, `kill`, `rest`), animations. Free functions for roster ops and DOM stat/roster rendering
5. **`combat.js`** — `Combat`: fight loop, AI behavior (`moveComputer`), human input (`moveHuman`), post-fight rewards
6. **`arena.js`** — `Arena`: roster management, buy phase UI (DOM overlays), between-fight stat adjustment, promotion/demotion, standings pyramid
7. **`main.js`** — Entry point: loads sprites, title screen, player/arena creation, game loop

## Hex Grid

Pointy-top hexes, odd-r offset (odd rows shifted right). 6 directions: NW(Q), NE(E), W(A), E(D), SW(Z), SE(C), rest(S). W/X (or arrows) for menu navigation. Hex math uses cube coordinates for distance and direction. Constants: `HEX_R=20`, `MAP_W=19`, `MAP_H=19`.

## Sprite Sheets

- **`monsters.png`** (320×320): 10×10 grid of 32×32. One row per archetype, 10 pose variations. Black silhouettes on silver (silver removed at load).
- **`terrain.png`** (320×320): 10×10 grid of 32×32. Row order: Blood, Sand, Brush, Tree, Rock, Pool, LargeColumn, Columns, LtStoneBlock, DkStoneBlock. Mapped via `TERRAIN_SPRITE_ROW`.
- **`effects.png`** (192×192): 6×6 grid of 32×32. Three effect types × 2 rows each: miss (rows 0–1), hit (rows 2–3), rest/shield (rows 4–5). White background removed at load.

## Key Patterns

- **Async/await game loop**: User-facing flows use `await input.waitKey()`. Combat ticks run in an async loop with `delay()` for pacing.
- **Canvas + DOM hybrid**: Hex map on canvas; UI panels (stats, roster, menus, standings) as HTML/CSS. Full-screen overlay div for menus and between-fight screens.
- **Tick-based initiative**: Each gladiator has a `time` counter; lowest acts next. Speed and fatigue affect time costs.
- **Debug keys**: Backtick (`` ` ``) prefix activates debug commands (e.g. `` `k `` = kill all).

## Game Mechanics

`DYNAMICS.md` documents full gameplay systems (combat formulas, AI behavior, economy, promotion).

## Original Source

`orig/` contains the original Turbo C++ source (`.CPP`, `.H`), EGA sprite assets, and a prior ASCII text-mode JS version.
