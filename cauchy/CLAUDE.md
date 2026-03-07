# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cauchy Heat Map Visualizer — a vanilla JavaScript browser app that generates interactive 2D heat maps using Cauchy distributions with color schemes ported from a Scala ColorWheel library.

## Running

Open `index.html` in a browser. No build step, no bundler, no package manager.

## Architecture

All JS files are loaded via `<script>` tags in `index.html` (order matters):

1. **colortheory.js** — `ColorTheory` utility class combining color wheel operations (HSL↔RGB), 8 color scheme generators, and gradient/bands colormap caching. Ported from Scala sources in `examples/colorwheel/`. Static methods for scheme generation (`SchemeGenerators`, `randomScheme`), color conversions, and palette sorting. Instance usage: `new ColorTheory(n, palette)` creates a cached colormap with `.apply(v)`.

2. **cauchymap.js** — `CauchyMap` class. Pure field math: given sources (position + strength + scale), computes the heat field. Also handles field normalization and clamping. No randomness, no DOM.

3. **cauchyheatmap.js** — `CauchyHeatMap` class. Sampling engine: seeded RNG, Cauchy-driven point count, placement, intensity, and scale generation. `generate()` returns `{ sources, field, pointCount }`.

4. **index.js** — Presentation layer: canvas rendering, color scheme selection via `ColorTheory`, DOM event wiring.

### Key data flow

Three independent layers, orchestrated by `index.js`:

1. **Sampling** (`CauchyHeatMap.generate`) → returns `{ sources, field, pointCount }`
2. **Field math** (`CauchyMap.calculateHeatField`) → called by CauchyHeatMap, or directly for click-to-move
3. **Presentation** (`index.js`) → picks color scheme via `ColorTheory`, renders field to canvas

Color scheme selection and canvas rendering are fully independent of field generation.

### Interactivity

- Clicking canvas moves a random heat source to the click position and re-renders with the same color scheme (recalculates field via `CauchyMap` directly, no resampling)
- Changing color scheme dropdown re-renders existing field with new colors (no field recalculation)
- Changing density or +/- checkbox triggers full regeneration

## Conventions

- No build tools, no modules — all globals, script-tag loading order is the dependency system
- No default parameter values — all arguments passed explicitly
- Colors represented as `[r, g, b]` arrays (0–1 range) in scheme/colorwheel code, and `{r, g, b}` objects in ColorTheory colormap output
- Seeded PRNG (`CauchyHeatMap.createSeededRandom`) for reproducible patterns; `Math.random()` fallback when no seed
- All helper functions live as static methods on their owning class — no free-floating functions except `parseSeed` in `index.js`
- Original Scala source files preserved in `examples/colorwheel/` for reference
