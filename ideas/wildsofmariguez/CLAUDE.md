# Wilds of Mariguez

Single-player turn-based tactical game on a hex grid. Browser-based, vanilla JS + HTML5 Canvas.

## Key Documents

- **DYNAMICS.md** — Game design document (the "why"). Authoritative for mechanics rationale.
- **SPEC.md** — Formal specification (the "what"). Authoritative for implementation requirements.
- **king_of_mariguez.txt** — Source fiction. Reference only, not a spec.
- **superpowers.txt** — Artifact power inspiration table.

## Architecture

- Vanilla JS, no frameworks, no build tools
- Modules: `hex.js` (grid, BFS, A* pathfinding, neighbors), `rando.js` (random utilities), `colortheory.js`, `config.js`
- Game state lives in a single `gameState` object
- Artifacts are data objects using 4 templates (passive, activated-self, activated-targeted, one-use), not unique code paths
- `ARTIFACT_BY_ID` Map for O(1) artifact lookups
- Dark/light terrain variants for accessibility (BFS from start illuminates reachable terrain)

## Implementation Status

1. ~~Two-unit movement (shared MP pool)~~
2. ~~Scrolls + hidden artifacts~~
3. ~~Seer's visions~~
4. ~~Monsters (spawn ring, decay, hesitation, forest hiding)~~
5. ~~Tether + death check~~
6. ~~Artifact claiming (cost baked into BFS)~~
7. **Artifact effects** — next up
8. ~~Jhirle (A* pathfinding, monster avoidance, city return)~~
9. ~~Win/lose conditions (cities, tether, stuns, Jhirle)~~
10. Polish

## Key Mechanics

- **Cities**: 3 on eastern border. Units start adjacent to one. Win = Hecto on city + Evascor within 3 + 3 artifacts. Jhirle must also return to city with 4 artifacts to win.
- **Eastern approach**: No mountains or water within 3 columns of right edge.
- **Monsters**: Spawn 3-12 hexes from Hecto, target nearest of Hecto/Evascor/Jhirle (forest hides Hecto and Jhirle). Decay >5 hexes from all units.
- **Jhirle**: 4 MP, A* pathfinding, Hecto's terrain costs. Can't enter within 2 of monsters or Evascor's hex. Hides in forest when no target.
- **Inventory**: Max 5 artifacts. Claim cost +2 MP baked into BFS movement.

## Conventions

- No unit tests for this project
- No external libraries
- Keep mechanics codeable — if it can't be expressed as a clear algorithm, simplify it
- Artifacts as data, not snowflake code paths
- Hecto = red, Evascor = gray, Jhirle = purple, Monsters = colorful (ColorTheory)
