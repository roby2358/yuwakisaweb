# Thing Factory — Criteria

How we know the build is right. Each row has a stable ID that is never reused. Rules are in
ONTOLOGY.md, cited by name. Constants are cited by name, never by value.

**Instrument** is the row's status. It takes one of four forms: `automated`, `manual — <what
a human checks>`, `not yet covered`, or `retired`. An `automated` R-row owns `test/R-n/`. Each
test there asserts that one rule, with its cases commented in the test itself.

**Test command:** `node test/run.js` (add `-v` for every check). It runs each `test/R-n/`
file, the integration tests (`smoke.js`: random legal play with invariant checks;
`uiboot.js`: the real UI booted on a stub DOM and played to a win by simulated clicks), and
`test/coverage.js`. **Tuning harness:**
`node test/sim.js [games]` (a greedy builder bot; not pass/fail).

---

## R — Rules (automated)

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | `newGame(seed)` | `MAP_COLS × MAP_ROWS` hexes, each `(col,row)` once, keyed `"q,r"` with `q = col - floor(row/2)` | automated |
| R-2 | any generated map | `isEdge` exactly on the outer ring, and every edge hex is `WATER` | automated |
| R-3 | any generated map | inner hexes ranked by elevation split at `WATER_PCT`/`MOUNTAIN_PCT`; ICE only in the plains band, `round(ICE_FRAC × inner)` of it | automated |
| R-4 | any generated map | source in the leftmost placement slice, target in the rightmost (Place source and target rule) | automated |
| R-5 | many seeds | a land path from source to target | automated |
| R-6 | `newGame(seed)` | one crate on the source; gremlin count in `GREMLIN_DICE_COUNT`d`GREMLIN_DICE_SIDES` on distinct passable inner hexes off source/target, each colored; no Things; `HAND_SIZE` cards; counters reset; unique ids | automated |
| R-7 | a step | blocked (piece stays) into off-map, mountain, Wall, or another piece; accepted onto plains, ice, a bridge, or a mover | automated |
| R-8 | `legalPlacements(kind)` | exactly the Placement legality rule: no Thing, not the target, right ground, no piece under a blocking kind | automated |
| R-9 | `place(slot, q, r, facing)` | legal: Thing appended (fixture facing null), slot redrawn, hand stays `HAND_SIZE`, one tick. Illegal (slot, facing, hex, won): `{ok:false}`, state and `Rando` unchanged | automated |
| R-10 | `rotate(q, r)` | on a Belt, Spring, or Puller: facing turns clockwise, one tick. On a fixture, empty hex, or after a win: `{ok:false}`, unchanged | automated |
| R-11 | `wait()` | one tick, hand and Things untouched; after a win `{ok:false}`, unchanged | automated |
| R-12 | a piece on a mover during a tick | pushed `THINGS[kind].push` hexes in the facing, stopping before a blocked hex | automated |
| R-13 | a tick | each piece moves at most once (a line of belts advances a crate one hex per tick; a carried gremlin doesn't also wander) | automated |
| R-14 | a piece entering bare ICE | keeps going the same way, free, until non-ice or blocked; ice under a Thing doesn't slide | automated |
| R-15 | a piece entering water | removed if no Thing is there (crate: `lost` +1); a bridge carries it | automated |
| R-16 | a piece entering the target | a crate is removed and `delivered` +1; a gremlin stays and blocks crates | automated |
| R-17 | a spinner during a tick | the Spinner was replaced by the Puller (R-28) | retired |
| R-18 | gremlins in a tick | each unmoved gremlin steps to a random enterable non-water neighbor or stays; boxed in → stays; never walks into open water; pieces never share a hex | automated |
| R-19 | ticks | `spawnTimer` counts up; at `SOURCE_INTERVAL` with the source empty a crate spawns and the timer resets; while occupied it waits | automated |
| R-20 | the tick that reaches `DELIVER_GOAL` | `gameWon`, result `{ok:true, won:true}`; every command afterward `{ok:false}`, unchanged | automated |
| R-21 | two games, same seed | identical terrain, source, target, pieces, hand; different seeds differ | automated |
| R-22 | two engines, same seed and commands | identical state and events after every command; `Math.random` only draws the seed | automated |
| R-23 | `GEN_MAX_ATTEMPTS` pathless maps | falls back to `KNOWN_GOOD_SEED`, records it, equals `newGame(KNOWN_GOOD_SEED)`; that seed has a path on attempt 1 | automated |
| R-24 | the engine-side modules | load and play with no DOM, canvas, or `GameDisplayArtifacts`, and never reference them | automated |
| R-25 | any command | a boolean `ok`; `ok:true` from place/rotate/wait carries `events[]`; `ok:false` carries nothing else | automated |
| R-26 | a tick's events | `move` paths list every hex entered and end where the piece is or vanished; `sink`/`deliver` follow their `move`; `spawn` reports the new crate; replaying events reproduces every position | automated |
| R-27 | many draws | only known kinds; each kind's share ≈ `weight / total` | automated |
| R-28 | a Puller during a tick | the piece on the far hex (two ahead) is pulled one step back into the near hex by the ordinary step rule (blocked → stays, water → sinks, ice → slides onto the Puller); pieces on the Puller or the near hex are left alone; a piece already moved this tick isn't pulled | automated |

---

## U — UI / readability

| ID | Criterion | Instrument |
|---|---|---|
| U-1 | Double-clicking `index.html` runs from `file://` with no console errors | manual — open from the file manager, check the console |
| U-2 | The whole 16×10 board fits a desktop window without panning, centered | manual — open at 1280×720 |
| U-3 | Picking a card (click or `1`–`3`) lifts it and tints exactly `legalPlacements` yellow; a ghost with a facing arrow follows the cursor over legal hexes | manual — pick each kind |
| U-4 | `R`, `Shift+R`, and the wheel turn the ghost; the card's picture turns with it | manual — pick a Belt, turn it all three ways |
| U-5 | Clicking a yellow hex places the Thing and the tick plays: pieces hop along their paths, sinking/delivered pieces fade | manual — build a belt into water and one into the target |
| U-6 | With no card picked, hovering a mover outlines it and the hover bar says "click to turn"; clicking turns it and ticks | manual — hover and click a placed Belt |
| U-7 | Esc and right-click put the card back; a click on a non-yellow hex also does | manual — try all three with a card picked |
| U-8 | Space, Enter, and Wait all tick; none of them, nor clicks, act during the animation, an overlay, or after a win | manual — mash Space mid-animation, then after a win |
| U-9 | Each Thing is recognizable by look alone: belt chevrons, spring coil, puller magnet, wall bricks, bridge planks | manual — glance test |
| U-10 | The HUD shows Turn, Delivered k / `DELIVER_GOAL` with a bar, crates lost, and the hover bar names terrain, Thing (with its verb), and piece | manual — hover a crate on a belt, then lose one at sea |
| U-11 | The victory card reads "IT DOES THE THING" with crates, turns, and crates lost | manual — win a game |

---

## X — Experience / outcomes

| ID | Criterion | Link · Instrument |
|---|---|---|
| X-1 | Every board is completable: the greedy bot wins at least 90% of 200 boards | D-8 · manual — `node test/sim.js 200` |
| X-2 | A first-time player gets their first crate delivered within about 25 turns | D-7 · not yet covered |
| X-3 | Players laugh at least once a game (a gremlin rides a belt into the sea, an ice skid lands a crate) | G-1 · not yet covered |
| X-4 | The machine keeps running without the player once it's built: after the first delivery, the rest arrive mostly on Wait | D-7 · not yet covered |

---

## Status (2026-11-10)

- **Manual only:** U-1…U-11, X-1.
- **Retired:** R-17 (Spinner).
- **Not yet covered:** X-2, X-3, X-4 (need playtests).
- **Partial coverage:** R-18 checks that wandering gremlins land on land and never step into
  water on purpose, but not that the direction choice is uniform. R-22 drives a scripted
  command mix rather than every command shape.
