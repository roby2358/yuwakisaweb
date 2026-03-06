# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monster Gladiators (MGLAD) — a browser-based JavaScript port of a 1992 Turbo C++ arena combat game. Renders an 80x25 text-mode display on an HTML5 canvas. No build system, no bundler, no npm — just vanilla JS loaded via `<script>` tags.

## Running

Open `index.html` in a browser. No build step required.

## Architecture

All symbols are globals shared across files. Load order matters (defined in `index.html`):

1. **`mglad.js`** — Constants, enums, palettes, terrain data, archetypes, utility functions (`R()`, `clamp()`, `delay()`), `SoundEngine`
2. **`screen.js`** — `Screen` class: canvas-based 80x25 text renderer, keyboard/click input via `waitKey()`, box drawing
3. **`map.js`** — `GameMap` class: 19x19 terrain grid, collision, placement, movement helpers. Map generators (`forestMap`, `arenaMap`, `ruinsMap`, `rockyMap`)
4. **`guy.js`** — `Guy` class: gladiator stats, combat mechanics (`attack`, `hit`, `kill`, `rest`), display/animation, stat helpers. Free functions for roster operations (`guyAt`, `guyClosest`, `rankGuy`, `showRoster`)
5. **`combat.js`** — `Combat` class: fight loop, AI behavior (`moveComputer`), human input (`moveHuman`), post-fight rewards
6. **`arena.js`** — `Arena` class: roster management, buy phase UI, between-fight stat adjustment, promotion/demotion, standings pyramid
7. **`image.js`** — Entry point: `main()` runs title screen, creates player and arena, runs the game loop

## Key Patterns

- **Async/await game loop**: All user-facing flows use `await screen.waitKey()` for input. Combat ticks run in an async loop with `delay()` for pacing.
- **EGA-style rendering**: 16-color palette, CP437 block characters. Each map cell renders as 2 screen columns wide. Characters use `attr` byte (low nibble = foreground, high nibble = background).
- **Tick-based initiative**: Not turn-based. Each gladiator has a `time` counter; the lowest acts next. Speed and fatigue affect time costs.
- **No modules/imports**: Everything is global. Dependencies are implicit via script load order.

## Original Source

The `orig/` directory contains the original Turbo C++ source (`.CPP`, `.H` files) and EGA sprite assets. `DYNAMICS.md` documents the full game mechanics derived from that source. Consult it for gameplay rules and formulas.

## Asset Files

`new/` contains replacement sprite sheets (`monsters.png`, `terrain.png`, `effects.png`) with generation prompts. These are not yet integrated into the game.
