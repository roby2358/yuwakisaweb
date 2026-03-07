# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cauchy Heat Map Visualizer — a vanilla JavaScript browser app that generates interactive 2D heat maps using Cauchy distributions with color schemes ported from a Scala ColorWheel library.

## Running

Open `index.html` in a browser. No build step, no bundler, no package manager.

## Architecture

All JS files are loaded via `<script>` tags in `index.html` (order matters):

1. **colortheory.js** — `ColorTheory` utility class combining color wheel operations (HSL↔RGB), 8 color scheme generators, and gradient/bands colormap caching. Ported from Scala sources in `examples/colorwheel/`. Static methods for scheme generation (`SchemeGenerators`, `randomScheme`), color conversions, and palette sorting. Instance usage: `new ColorTheory(n, palette)` creates a cached colormap with `.apply(v)`.

2. **index.js** — Main app. Contains `CauchyHeatMap` class (heat source generation, field calculation, rendering) and DOM event wiring. The class uses Cauchy distributions for point count, placement, intensity, and scale parameters.

### Key data flow

`generate()` → draw point count (Cauchy) → place sources (Cauchy) → draw intensities/scales (Cauchy) → `calculateHeatField()` (sum Cauchy PDF contributions) → `generateColorScheme()` → `render()` (normalize field, map to colors, write ImageData)

### Interactivity

- Clicking canvas moves a random heat source to the click position and re-renders with the same color scheme
- Changing color scheme dropdown re-renders existing field with new colors (no field recalculation)
- Changing density or +/- checkbox triggers full regeneration

## Conventions

- No build tools, no modules — all globals, script-tag loading order is the dependency system
- Colors represented as `[r, g, b]` arrays (0–1 range) in scheme/colorwheel code, and `{r, g, b}` objects in Colors class output
- Seeded PRNG (`createSeededRandom`) for reproducible patterns; `Math.random()` fallback when no seed
- Original Scala source files preserved in `examples/colorwheel/` for reference
