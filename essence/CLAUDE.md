# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A zero-dependency, single-page browser visualization of a stochastic search for local maxima
over a 2D scalar field. There is no build step, no package manager, and no tests — just three
static files (`index.html`, `essence.js`, `essence.css`) served as-is.

## Running

Open `index.html` directly in a browser, or serve the directory statically (e.g.
`python3 -m http.server`) and visit it. Everything runs client-side in `essence.js`, which is
wrapped in an IIFE and starts a `setInterval` animation loop on load.

Interactions:
- **ESCAPE** stops the animation loop (`clearInterval`).
- **Click** on the canvas relocates one randomly-chosen maximum to the clicked cell and rescores
  all current points.

## Architecture

The code has two layers that share the same coordinate space:

1. **The field `f(x, y)`** — the *target* being searched. It's the sum of `cauchy`-shaped heat
   bumps centered on the points in the `maxima` array (the "true" peaks), clamped to `[0, 1]`.
   `maxima` is what a click edits. The field is rendered every frame by `plotAll()`, mapping
   value → HSV hue (red = high, violet = low) via `hsvToRgb`.

2. **The search population `points`** — candidate solutions hunting for the field's peaks. Each
   `cycle()` draws one fresh `randomPoint()`, breeds it against every existing point via
   `merge()` (a score-weighted blend, randomly either an interpolation or an extrapolation away
   from the partner), appends both children and the new point, then `trim()` sorts by score and
   keeps the top `numPoints`. This is the actual evolutionary-search loop; `plotPoints()` overlays
   the survivors at full intensity.

Key constants near the top of `essence.js`: `size` (grid cells per axis), `scale` (pixels per
cell), `numPoints` (population cap). The canvas is `size * scale` on a side.

## Conventions worth knowing

- `README.md` describes an *aspirational* algorithm (quadtree exploration, multiple stopping
  criteria) that the code does **not** implement. Treat the README as design notes, not a spec
  for current behavior.
- `essence.js` carries commented-out alternatives inline (e.g. `gaussian`/`exponentialDecay`
  kernels, sigmoid/cube-root value shaping). These are kept as tuning knobs — preserve them when
  editing nearby code rather than deleting.
