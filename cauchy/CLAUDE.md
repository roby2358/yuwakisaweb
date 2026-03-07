# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cauchy Heat Map Visualizer — a vanilla JavaScript browser app that generates interactive 2D heat maps using Cauchy distributions with color schemes ported from a Scala ColorWheel library.

## Running

Open `index.html` in a browser. No build step, no bundler, no package manager.

## Architecture

All JS files are loaded via `<script>` tags in `index.html` (order matters):

1. **colorwheel.js** — Color space conversions (HSL↔RGB) and color wheel operations. Ported from `examples/colorwheel/ColorWheel.scala`. Exposes global functions: `mod1`, `hslToRgb`, `rgbToHsl`, `pixToRGBLuminosity`, `pixToRGBSaturation`.

2. **schemes.js** — 8 color scheme generators (monochromatic, analogous, triad, complementary, splitComplementary, doubleSplitComplementary, square, compound). Ported from `examples/colorwheel/Schemes.scala`. Exposes `SchemeGenerators` map and `randomScheme`. Each scheme produces a 5-color palette sorted by luminance.

3. **colors.js** — `Colors` class that caches a gradient colormap of size `COLOR_MAP_SIZE` (1024) for fast per-pixel lookup. Also exposes `gradient()` and `bands()` interpolation functions.

4. **index.js** — Main app. Contains `CauchyHeatMap` class (heat source generation, field calculation, rendering) and DOM event wiring. The class uses Cauchy distributions for point count, placement, intensity, and scale parameters.

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
