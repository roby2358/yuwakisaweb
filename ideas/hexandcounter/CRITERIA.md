# Hex & Counters — Criteria

How we know the build is right. Each row has a stable ID that is never reused. Rules are in
ONTOLOGY.md, cited by name. Constants are cited by name, never by value.

**Instrument** is the row's status. It takes one of four forms: `automated`, `manual — <what
a human checks>`, `not yet covered`, or `retired`. An `automated` R-row owns `test/R-n/`. Each
test there asserts that one rule, with its cases commented in the test itself.

**Test command:** `node test/run.js` (add `-v` for every check). It runs each `test/R-n/`
file, the integration walkthrough, and `test/coverage.js`. The coverage test fails when this
table and the `test/R-n/` directories disagree.

---

## R — Rules (automated)

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | `newGame(seed)` | `hexes.size === MAP_COLS × MAP_ROWS`; each `(col,row)` appears once; every key is `"q,r"` with `q = col - floor(row/2)`, `r = row` | automated |
| R-2 | any generated map | `isEdge` is true exactly on the rectangle's outer ring, and every edge hex is `WATER` | automated |
| R-3 | any generated map | inner hexes ranked by elevation fall into bands split at `WATER_PCT`/`HILLS_PCT`/`MOUNTAIN_PCT`. FOREST and SCRUB are carved only out of the plains band and ROUGH only out of the hills band. Each count matches its `*_FRAC`/`*_MIN` constants | automated |
| R-4 | any generated map | the player is in the leftmost placement slice and the target in the rightmost. Both slices are drawn from the passable non-edge hexes sorted by `col`, with slice length `max(PLACE_SLICE_MIN, floor(PLACE_SLICE_FRAC × passable))` | automated |
| R-5 | many seeds | `board.hasPath(player, target)` holds after `newGame` | automated |
| R-6 | `newGame(seed)` | the enemy count is within `ENEMY_DICE_COUNT`d`ENEMY_DICE_SIDES`. Every enemy is a `Piece` labeled `'E'` with a `#rrggbb` color, standing on a passable non-edge hex. No two enemies share a hex, and none is on the player or the target | automated |
| R-7 | each `TERRAIN` value | `board.moveCost` equals `MOVEMENT_COST[terrain]` and an unknown terrain costs Infinity. `isPassable` is true exactly when the cost is finite. `passableHexes()` returns exactly the non-edge passable hexes | automated |
| R-8 | the player with `mp` left | `computeReachable()` maps every hex whose cheapest path cost is ≤ `mp` to that cost, treating enemy hexes as impassable. It excludes the player's own hex and is empty when `mp ≤ 0` | automated |
| R-9 | `movePlayer` to a hex outside `computeReachable()`: an enemy hex, an impassable hex, one out of range, one off the map, or the player's own hex | `{ ok:false }`; state is unchanged | automated |
| R-10 | `movePlayer` to a reachable hex that isn't the target and leaves MP over | the player moves there; `mp` drops by exactly the reachable cost; the result is `{ ok:true }` | automated |
| R-11 | `movePlayer` that spends the last MP and doesn't land on the target | the result is `{ ok:true, endedTurn:true }`, and the End-turn rule has run once | automated |
| R-12 | `movePlayer` onto the target, including with exactly the last MP | `gameWon` is true; the result is `{ ok:true, won:true }`; the enemy phase doesn't run | automated |
| R-13 | `endTurn()` while not won | the enemy phase runs once under `phase 'enemy'`; `turn` goes up by 1; `mp = PLAYER_MP`; `phase === 'player'` on return; the result is `{ ok:true }` | automated |
| R-14 | `endTurn()` after a win | `{ ok:false }`; state is unchanged | automated |
| R-15 | the enemy phase | each enemy stays put or steps to one adjacent passable hex. Afterward no two enemies share a hex and none is on the player | automated |
| R-16 | two games from the same seed | identical terrain, player, target, enemy positions, and enemy colors; different seeds give different maps | automated |
| R-17 | two engines with the same seed and the same command sequence | identical state after every command, including the enemies' moves. In the engine, `Math.random` is used only to draw the seed | automated |
| R-18 | the engine-side modules | they load and play a game with no DOM, no canvas, and no `GameDisplayArtifacts`, and their sources never reference any of them | automated |
| R-19 | after `newGame` | `player` and `target` are `Piece`s labeled `'P'` and `'★'`, with `color === null`. `engine.board` is a `Board` wrapping the same `Map` as `state.hexes`, and is rebuilt on every `newGame`. A move mutates the existing player `Piece` in place | automated |
| R-20 | any state | `computeAttackable()` returns an empty Set; `locationAt(hex)` returns null | automated |
| R-21 | a won game with MP left | `movePlayer` returns `{ ok:false }` and the player stays on the target | automated |
| R-22 | `GEN_MAX_ATTEMPTS` maps from a seed all lack a path | `newGame` falls back to `KNOWN_GOOD_SEED`, records it as `state.seed`, and builds the same game `newGame(KNOWN_GOOD_SEED)` does. `KNOWN_GOOD_SEED` has a path on its first attempt | automated |
| R-23 | any command | it returns an object with a boolean `ok`; `newGame` returns `{ ok:true }` | automated |

---

## U — UI / readability

| ID | Criterion | Instrument |
|---|---|---|
| U-1 | Double-clicking `index.html` runs the game from `file://` with no console errors | manual — open from the file manager, check the console |
| U-2 | Clicking P selects it: a white ring around P, and exactly the hexes in `computeReachable()` tinted yellow | manual — select P on a fresh map |
| U-3 | Clicking a yellow hex moves P there and re-highlights from the new position. Clicking P again, or a hex that isn't yellow, deselects | manual — move, then try both ways to deselect |
| U-4 | A left press that moves no more than `DRAG_THRESHOLD` is a click. Past that it pans and selects or moves nothing. Releasing off-canvas still ends the drag | manual — drag across a highlight, release outside the window |
| U-5 | Right-click never opens the browser context menu | manual — right-click the map |
| U-6 | Space, Enter, and the End Turn button do the same thing. They do nothing while an overlay is up or after a win, and make no sound then | manual — press each one mid-game, then after a win |
| U-7 | Esc peels back one modal layer (targeting, then selection) | manual — select P, press Esc |
| U-8 | The intro overlay and the victory overlay each consume the click or key that dismisses them; that input never reaches the map | manual — dismiss with a click on a highlighted hex |
| U-9 | After a win the board is view-only: map clicks do nothing | manual — win, dismiss, click around |
| U-10 | Counters are rounded squares with two 1-px gray depth lines below and to the right. P is `PLAYER_COLOR`; each enemy has its own palette color; each label is black or white, whichever contrasts | manual — look at the counters on a few maps |
| U-11 | The HUD shows `Turn N`, a "Progress to end" bar that grows as the distance closes, and the hovered hex's terrain name and `(q,r)`. The hover readout hides when the cursor is off the map | manual — move and hover |
| U-12 | The victory overlay reads "VICTORY!" and the number of turns taken | manual — win a game |
| U-13 | Each outcome plays exactly one cue: a step on a plain move, the end-turn cue on an automatic or manual end, a fanfare on a win and on dismissing the intro | manual — listen through one game |

---

## X — Experience / outcomes

| ID | Criterion | Linked · Instrument |
|---|---|---|
| X-1 | A fork adds combat by filling in `computeAttackable` and the attack branch without touching the dispatch order. Fails if a fork has to restructure `handleClick` or the modal-flag stack | G-1 · not yet covered |
| X-2 | `GameState` + `GameEngine` drop into a server unchanged. Fails if a port needs edits below `GameUI` beyond adding the deferred command and serialization layer | G-2 · not yet covered |
| X-3 | Nothing Realm-specific shapes a new fork's design. Fails if a reviewer finds inert fields or terrain names a fork has to explain or delete | G-6 · manual — read through the code before a fork |
| X-4 | Every game can be completed. Fails if any seed yields a map with no player→target path. R-22 guarantees it by construction, with the `KNOWN_GOOD_SEED` fallback | G-1 · not yet covered |
| X-5 | Enemies feel like moving obstacles, not a wall (see D-13: not measured; worst case the player waits) | movement puzzle · retired |

---

## Status — 2026-10-15

- **Not yet covered:** X-1, X-2, X-4.
- **Manual only:** U-1 to U-13, X-3.
- **Retired:** X-5.
- **Partial coverage, honestly:**
  - R-5 samples 60 seeds and R-16 samples 5, not every seed.
  - R-15 checks moves are legal steps but not that the choice is uniform over the legal
    neighbors, or that an enemy with a legal neighbor always moves.
  - R-17 checks `Math.random` by grepping the source, so a call reached through a helper
    library would slip past it.
  - R-18's DOM check is lexical, by name, and comments are stripped before it.
  - R-22's fallback is forced with a stubbed `hasPath`. No natural seed has been found that
    exhausts `GEN_MAX_ATTEMPTS`: 0 of 1000 sampled.
