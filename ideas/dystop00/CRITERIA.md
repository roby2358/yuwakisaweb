# RADIO FREE SECTOR 9 — Criteria

How we know the build is right. Each row has a stable ID that is never reused. Rules are in
ONTOLOGY.md, cited by name. Constants are cited by name, never by value.

**Instrument** is the row's status: `automated`, `manual — <what a human checks>`,
`not yet covered`, or `retired`. An `automated` R-row owns `test/R-n/`; each test there
asserts that one rule, with its cases commented in the test itself.

**Test command:** `node test/run.js` (`-v` for every check). It runs each `test/R-n/` file,
the integration tests (`smoke.js`, an engine walkthrough; `ui_boot.js`, the real UI booted
under a DOM/canvas stub and driven through boot, select, move, plant, and animated turns —
it catches runtime errors, not looks), and `test/coverage.js`, which fails when this table and the
`test/R-n/` directories disagree. **Tuning harness:** `node test/sim.js [N] [--maps]
[--pull-early] [--set NAME=v,…] [-t --seed S]` (not part of the test command).

---

## R — Rules (automated)

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | `newGame(seed)` | `hexes.size === MAP_COLS × MAP_ROWS`; each `(col,row)` once; keys `"q,r"` with `q = col - floor(row/2)`, `r = row` | automated |
| R-2 | any generated map | `isEdge` exactly on the outer ring; every edge hex is `CANAL` | automated |
| R-3 | any generated map | Assign-terrain rule: elevation bands at `CANAL_PCT`/`ARCOLOGY_PCT`; the densest `BLOCK_FRAC` of open hexes are `BLOCK`; `INDUSTRIAL_FRAC`/`RUINS_FRAC` of the rest; the remainder `PLAZA` | automated |
| R-4 | any generated map | Place rule: @ in the left slice; the Ministry in the right slice on a non-block; `PRECINCT_COUNT` precincts, non-block, col ≥ `PRECINCT_MIN_COL_FRAC × MAP_COLS`; stations pairwise ≥ `STATION_SPACING` | automated |
| R-5 | many seeds | `board.hasPath(@, Ministry)` after `newGame` | automated |
| R-6 | `GEN_MAX_ATTEMPTS` invalid maps | `newGame` falls back to `KNOWN_GOOD_SEED`, records it, and equals `newGame(KNOWN_GOOD_SEED)`; `KNOWN_GOOD_SEED` is valid on its first attempt | automated |
| R-7 | after `newGame` | one carried `Rig` per `RIG_NAMES` entry in order, labeled by first letter; `BASE_SWEEPERS` Sweepers each adjacent to a station; nothing awake; turn 1, `mp = PLAYER_MP`, phase `'player'`, outcome null; @ is a `Piece` labeled `'@'` | automated |
| R-8 | each `TERRAIN` value / any map | `moveCost = MOVEMENT_COST[terrain]` (unknown → Infinity); `isPassable` ⇔ finite; `passableHexes`, `within`, `blocks` return exactly their sets | automated |
| R-9 | @ with `mp` left | `computeReachable` = terrain-cost Dijkstra ≤ `mp`; Sweeper and station hexes are walls; awake blocks cost @ nothing extra; excludes @'s hex; empty at `mp ≤ 0` or when over | automated |
| R-10 | `movePlayer` | reachable → @ moves, `mp` drops by the reachable cost, `{ok:true}`; anything else → `{ok:false}`, state unchanged | automated |
| R-11 | `plant()` | legal per the Plant rule → first carried rig planted on @'s hex, `mp -= PLANT_MP`, `{ok:true, rig}`; each illegal case → `{ok:false}`, unchanged | automated |
| R-12 | `retrieve()` | legal per the Retrieve rule → that rig carried with null position, `mp -= PLANT_MP`; illegal → `{ok:false}`, unchanged | automated |
| R-13 | a move, plant, or retrieve that leaves `mp = 0` | `endTurn` runs once; result carries `endedTurn:true`, `events`, `outcome` | automated |
| R-14 | a broadcast | exactly the Wake: sleeping unjammed blocks in range of an unjammed rig, or with ≥ `WAKE_THRESHOLD` awake neighbors counted before the phase; synchronous; non-blocks never wake; one awake neighbor isn't enough | automated |
| R-15 | a Sweeper near a rig or a frontier | nothing within `JAM_RADIUS` of a Sweeper wakes; a rig there is silent; `rigWakeSet` equals what the broadcast applies | automated |
| R-16 | a broadcast reaching `ceil(WIN_FRAC × blocks)` awake | outcome `'won'`; the regime doesn't run; every later command `{ok:false}`, unchanged | automated |
| R-17 | `endTurn()` not over | broadcast under phase `'broadcast'`, then regime under `'regime'`; turn +1; `mp = PLAYER_MP`; phase `'player'`; `{ok:true, events, outcome}` | automated |
| R-18 | Sweeper target choice | seen @ (within `SWEEPER_SIGHT`, not on an awake block) overrides; valid commitment kept; else nearest-by-plan-cost of `prefers`, then the other kind; else patrol; awake blocks shelter @ | automated |
| R-19 | a Sweeper walk | follows the shortest plan path, paying terrain + `AWAKE_DRAG` on awake blocks; stations and other Sweepers are walls, @ isn't; stops before a step it can't afford | automated |
| R-20 | a walk entering a planted rig | rig `'smashed'` permanently; walk ends there; target cleared; `smashed` event | automated |
| R-21 | a walk entering @'s hex, seen or not | outcome `'captured'`; the regime stops (no later moves, sedation, or spawn); `captured` event | automated |
| R-22 | after the walks | each Sweeper's own hex falls asleep; other awake blocks, even within `JAM_RADIUS`, stay awake | automated |
| R-23 | the regime leaves every rig smashed | outcome `'deadair'`; no spawn | automated |
| R-24 | the Alert | quota formula with `MAX_SWEEPERS` cap; spawns `min(SPAWN_PER_TURN, quota − count)` on free passable station neighbors; kind from `SWEEPER_KINDS`; MP as label | automated |
| R-25 | Sweepers over quota | up to `RECALL_PER_TURN` recalled per phase, latest-spawned first, never one targeting @ | automated |
| R-26 | same seed / same commands | identical map, pieces, and state after every command; different seeds differ; the engine never reads `Math.random` (the client draws the seed) | automated |
| R-27 | the engine-side modules | load and play with no DOM, canvas, or `GameDisplayArtifacts`; sources don't reference them | automated |
| R-28 | any command | returns an object with boolean `ok`; `newGame` returns `{ok:true}` | automated |
| R-29 | any state | `computeAttackable()` empty; `locationAt()` null | automated |
| R-30 | `endTurn` events | `woke` keys = blocks that became awake; `faded` keys = blocks that fell asleep at broadcast; each `moved` path runs pre-turn hex → post-move hex; `spawned` ids are new Sweepers; `recalled` ids are gone | automated |
| R-31 | an awake block at broadcast | falls asleep ⇔ fewer than `FADE_THRESHOLD` awake neighbors (pre-phase) and outside every live rig's current range; a jammed rig holds nothing; decided together with the wake; `planBroadcast(rig)` equals the broadcast after that rig is pulled | automated |
| R-32 | a planted rig | `rigRange = min(TX_RANGE + airtime, TX_RANGE_MAX)`; plant and retrieve set `airtime` 0; +1 per unjammed broadcast, +0 when jammed; the broadcast wakes with the range at the start of the phase | automated |

---

## U — UI / readability

| ID | Criterion | Instrument |
|---|---|---|
| U-1 | Double-clicking `index.html` runs from `file://` with no console errors (offline falls back from VT323 to Courier) | manual — open from the file manager, check the console |
| U-2 | Boot flow: INSERT DISK → any key → typed boot log with drive chatter → title card → any key → play. Each step's key never reaches the map; boot is skippable | manual — boot twice, once skipping |
| U-3 | Clicking @ highlights exactly `computeReachable()` in yellow; clicking a yellow hex moves; clicking @ or a non-yellow hex deselects | manual — select and move |
| U-4 | With a rig carried, hovering @'s hex or a yellow hex with `PLANT_MP` to spare tints exactly `rigWakeSet` cyan, and the hover bar says how many it wakes | manual — hover before planting, then end turn and compare |
| U-13 | Hovering a planted rig shades black the blocks that would fade next broadcast if it were pulled, and the hover bar shows its range and "PULL NOW: n FADE" | manual — hover a rig at a district's edge, pull it, end turn, compare |
| U-5 | Planted rigs show their current range as dashed cyan outlines that widen each turn on air; the roster reads ON AIR R*n*; jam zones are tinted red; jammed rigs read JAMMED in the roster | manual — plant near a Sweeper |
| U-6 | Every Sweeper's committed target is a dashed red line (bright when chasing @, medium for rigs, faint otherwise); hovering a Sweeper shows kind, MP, and target | manual — hover Sweepers mid-game |
| U-7 | The regime phase animates: woken blocks flash white, faded blocks flash black, Sweepers hop along their paths, spawns appear at the end, smashed rigs burst; input is locked during playback | manual — end several turns |
| U-8 | HUD: turn, MP pips, HIDDEN / SHELTERED / SEEN!, WAKE meter with the `WIN_FRAC` marker, ALERT level and quota; buttons disable when illegal | manual — play a few turns |
| U-9 | The SIGNAL LOG records wakes, fades, plants, retrievals, deployments, recalls, smashes, and capture | manual — read the log over a game |
| U-10 | End cards: THE CITY WAKES / ARRESTED / DEAD AIR, each with turn and stats; any key dismisses to a view-only board | manual — reach each ending |
| U-11 | Space, Enter, and END TURN do the same thing; T and R match their buttons; C recenters on @; Esc deselects | manual — try each |
| U-12 | Each outcome has one cue: step, plant, retrieve, end-turn bleep plus wake arpeggio, alarm on deployment, thud on smash, fanfares on start/win, a dirge on loss | manual — listen through a game |

---

## X — Experience / outcomes

| ID | Criterion | Linked · Instrument |
|---|---|---|
| X-1 | One rig is a windfall, never a win: even left on air, the best single rig settles well under `WIN_FRAC` on most maps. Fails if the median best "left on air" result exceeds half of `WIN_FRAC` over 40 maps | D-3, D-15 · manual — `node test/sim.js 40 --maps` |
| X-2 | The game is winnable but close: the greedy bot wins a meaningful share, and its wins usually cost most of the rigs. Fails if the bot wins under 20% or over 80% of 40 games, or if its median rigs lost is under 2 | G-4, D-8 · manual — `node test/sim.js 40` |
| X-3 | The lesser dynamics feed the core: in playtest, players describe their turns in terms of the Wake ("bridge here", "pull before the Hound") rather than as a separate stealth game | G-2 · manual — playtest debrief |
| X-4 | Stalls are rare for a human: a playtester can always find a productive plant when the bot would stall. Fails if a playtest game reaches a state with no useful plant and no way to lose | Q-1 · not yet covered |
| X-5 | It feels like a 1987 floppy release | G-3 · manual — playtest |
| X-6 | Leaving a rig on air is a real choice: neither "pull as soon as its base range is spent" nor "leave it until full range" dominates. Fails if one bot policy beats the other by more than 10 wins of 40 *and* loses no more rigs | D-15, D-16 · manual — `node test/sim.js 40` vs `node test/sim.js 40 --pull-early` |

---

## Status — 2026-11-08 (range growth and fading added)

- **Not yet covered:** X-4.
- **Manual only:** U-1 to U-13, X-1, X-2, X-3, X-5, X-6.
- **Retired:** none.
- **Partial coverage, honestly:**
  - R-5 samples 40 seeds; R-26 samples 3 seeds and 25 turns.
  - R-6 forces the fallback by stubbing `generateMap`; no natural seed exhausting
    `GEN_MAX_ATTEMPTS` has been found.
  - R-14's one-neighbor case runs only when the staged map has such a block.
  - R-31's triangle/pair cases run only at `FADE_THRESHOLD` 2; its jammed-rig case checks
    one staged block, not a whole district.
  - R-18 checks commitment with a staged nearer frontier, but not that a Hunter keeps a far
    rig target when a nearer rig appears.
  - R-19 checks the walk against the plan path but not tie-breaking between equal paths.
  - R-24 checks the kind comes from the table, not the d6 distribution.
  - R-27's DOM check is lexical, by name; `hex.js` is exempt (its pixel helpers read
    display artifacts lazily, unused by the engine).
