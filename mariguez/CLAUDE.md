# King of Mariguez

Single-player turn-based tactical game on a hex grid. Browser-based, vanilla JS + HTML5 Canvas.

## Key Documents

- **DYNAMICS.md** — Game design document (the "why"). Authoritative for mechanics rationale.
- **SPEC.md** — Formal specification (the "what"). Authoritative for implementation requirements.
- **king_of_mariguez.txt** — Source fiction. Reference only, not a spec.
- **superpowers.txt** — Artifact power inspiration table.

## Architecture

- Vanilla JS, no frameworks, no build tools
- Existing modules: `hex.js` (grid, BFS, neighbors), `terrain.js` (diamond-square heightmap), `rando.js` (random utilities), `colortheory.js`, `config.js`, `renderer.js`
- Game state lives in a single `gameState` object
- Artifacts are data objects using 4 templates (passive, activated-self, activated-targeted, one-use), not unique code paths

## Implementation Order

Follow the 10-step order from DYNAMICS.md:
1. Two-unit movement (shared MP pool)
2. Scrolls + hidden artifacts
3. Seer's visions
4. Monsters
5. Tether + death check
6. Artifact claiming
7. Artifact effects
8. Jhirle
9. Win/lose conditions
10. Polish

## Conventions

- No unit tests for this project
- No external libraries
- Keep mechanics codeable — if it can't be expressed as a clear algorithm, simplify it
- Artifacts as data, not snowflake code paths
