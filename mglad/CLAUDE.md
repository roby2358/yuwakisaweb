# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monster Gladiators (MGLAD) — a browser-based JavaScript port of a 1992 Turbo C++ arena combat game. Uses 32x32 sprites on a hexagonal map rendered to HTML5 canvas, with HTML/CSS UI panels. No build system, no bundler, no npm — just vanilla JS loaded via `<script>` tags.

## Running

Open `index.html` in a browser. No build step required.

## Architecture

All symbols are globals shared across files. Load order matters (defined in `index.html`):

1. **`mglad.js`** — Constants, enums, terrain data, archetypes, hex geometry (pointy-top odd-r offset), `InputManager`, `SoundEngine`, utility functions (`R()`, `clamp()`, `delay()`, `hexNeighbor()`, `hexDist()`, `hexDirTo()`)
2. **`renderer.js`** — `HexRenderer` class: sprite sheet loading/processing, hex clipping, terrain/monster/effect drawing on canvas. Loads `monsters.png`, `terrain.png`, `effects.png` and pre-processes into hex-clipped sprites with background removal
3. **`hexmap.js`** — `HexMap` class: 19x19 hex terrain grid, 6-direction movement, collision, placement helpers. Map generators (`forestMap`, `arenaMap`, `ruinsMap`, `rockyMap`)
4. **`guy.js`** — `Guy` class: gladiator stats, combat mechanics (`attack`, `hit`, `kill`, `rest`), sprite-based animations, stat helpers. Free functions for roster operations and DOM-based stat/roster rendering
5. **`combat.js`** — `Combat` class: fight loop, hex AI behavior (`moveComputer`), human input (`moveHuman`), post-fight rewards
6. **`arena.js`** — `Arena` class: roster management, buy phase UI (DOM overlays), between-fight stat adjustment, promotion/demotion, standings pyramid
7. **`main.js`** — Entry point: `main()` loads sprites, runs title screen, creates player and arena, runs the game loop

## Hex Grid

- **Pointy-top hexes, odd-r offset** (odd rows shifted right)
- 6 directions: NW(Q), NE(E), W(A), E(D), SW(Z), SE(C), rest(S)
- W/X (or arrows) for menu navigation
- Hex math uses cube coordinates for distance and direction-finding
- Constants: `HEX_R=20`, `COL_W=35`, `ROW_H=30`

## Sprite Sheets

- **`monsters.png`** (320x320): 10x10 grid of 32x32. One row per archetype, 10 pose variations. Black silhouettes on silver (silver removed at load time).
- **`terrain.png`** (320x320): 10x10 grid of 32x32. Row order: Blood, Sand, Brush, Tree, Rock, Pool, LargeColumn, Columns, LtStoneBlock, DkStoneBlock. Mapped to terrain types via `TERRAIN_SPRITE_ROW`.
- **`effects.png`** (192x192): 6x6 grid of 32x32. Two rows per effect type: miss (rows 0-1, applied to target), hit (rows 2-3, applied to target), rest/shield (rows 4-5, applied to self). White background removed at load time.

## Key Patterns

- **Async/await game loop**: All user-facing flows use `await input.waitKey()`. Combat ticks run in an async loop with `delay()` for pacing.
- **Canvas + DOM hybrid**: Hex map on canvas, UI panels (stats, roster, menus, standings) as HTML/CSS elements. Full-screen overlay div for menus and between-fight screens.
- **Tick-based initiative**: Not turn-based. Each gladiator has a `time` counter; the lowest acts next. Speed and fatigue affect time costs.
- **No modules/imports**: Everything is global. Dependencies are implicit via script load order.

## Game Mechanics Reference

`DYNAMICS.md` documents the full gameplay systems (combat formulas, AI behavior, economy, promotion). Consult it for any gameplay rules.

## Original Source

`orig/` contains the original Turbo C++ source (`.CPP`, `.H` files), EGA sprite assets, and a previous ASCII text-mode JavaScript version of the game.
