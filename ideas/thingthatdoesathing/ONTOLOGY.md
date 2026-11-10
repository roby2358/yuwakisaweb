# Thing Factory — Ontology

The implementation reference for Thing Factory: what exists, what each thing carries, how
things relate, the rules as short pseudocode, and the interface between the engine and any
client. When the code and this doc disagree, that is a bug in one of them; raise it, don't
silently pick a side. CRITERIA.md turns each rule here into testable rows.

**Tags.** **[D]** decided by the designer · **[P]** proposed by Claude, pending review ·
**[T]** tunable number · **[D, unbuilt]** decided but not yet in the code.
**Serves:** names the goal (`G-n`), quality, or DYNAMICS driver an item exists for.
IDs (`G-n`, `D-n`, `Q-n`, `R-n`/`U-n`/`X-n`) are stable and never reused; cite them, not
section numbers.

---

## §0 Purpose

Thing Factory is **a small hex board where you build a contraption one Thing at a time
while it runs**. Each Thing does exactly one thing, every tick. Crates come
out of a source; get enough of them to the target. [D: place-then-tick, deliver N, no time
limit, small board]

**Qualities**
- **Tinkerer's delight** — the fun is setting something up and watching it go. [P]
- **One verb per Thing** — you can predict any Thing by looking at it. [P]
- **Comedy** — gremlins ride your belts into the sea, a Puller yanks a wandering gremlin
  into the drink, and a spring flings a crate onto ice so it skids home. Overlapping Things are allowed to do silly things. [P]
- **Board-wargame feel** — flat hexes, chunky counters, inherited from the base. [D]

**Goals, in priority order**
- **G-1 The contraption is the toy.** Placing a Thing should change what the machine does
  on the very next tick, visibly. Concretely: every command ticks, and the tick is animated
  from engine events. [P]
- **G-2 Readable.** Every Thing does one thing, shown by its glyph and facing arrow; the
  legal placement hexes highlight before you commit. [P]
- **G-3 Keep the base platform's seams.** Server-portable State/Engine split, seeded
  reproducibility, double-click to run. [D]

**Priorities when goals conflict.** G-3's double-click and seam constraints beat
everything; G-2 beats G-1 (a funny interaction that can't be read is a bug, not comedy). [P]

**Non-goals (for now)** [D]
- A defeat condition or a time limit. The score is the turn count.
- Combat, unit stats.
- Levels or a campaign; every board is generated.
- Undo, or picking a Thing back up.
- A network layer.

---

## §1 Entities

### GameState — the world struct
*Serves:* G-3. Authoritative, serializable data only.

| Field | Type | Notes |
|---|---|---|
| `seed` | uint32 | Reproducibility anchor. |
| `hexes` | `Map<"q,r", Hex>` | The map; `Board` wraps it. |
| `source` | `{q, r}` | Where crates appear. Things may sit on it. |
| `target` | `{q, r}` | Where crates are delivered. Nothing may be built on it. |
| `pieces` | `Piece[]` | Every crate and gremlin, in creation order. |
| `things` | `Thing[]` | Every placed Thing, in placement order (the order they act). |
| `hand` | `ThingKind[]` | Length `HAND_SIZE`. |
| `turn` | int ≥ 1 | Goes up by 1 per tick. |
| `delivered` | int | Crates that reached the target. |
| `lost` | int | Crates that sank. |
| `spawnTimer` | int | Ticks since the source last spawned. |
| `nextId` | int | Next piece id. |
| `gameWon` | bool | `delivered ≥ DELIVER_GOAL`. |
| `phase` | `'player' \| 'tick'` | `'tick'` only while a tick resolves inside a command. |

### Hex — one map cell (plain object)
| Field | Type | Notes |
|---|---|---|
| `q`, `r` | int | Axial, pointy-top. Key `"q,r"`. |
| `col`, `row` | int | Rectangle position; `q = col - floor(row/2)`. |
| `elevation` | float 0…100 | Generation only. |
| `isEdge` | bool | Outer ring. |
| `terrain` | `TERRAIN` | `WATER`, `PLAINS`, `MOUNTAIN`, `ICE`. |

### Piece — a crate or gremlin
*Serves:* G-1 (the things the machine moves), comedy (gremlins).
`Piece` from the base, with two fields set by the engine.

| Field | Type | Notes |
|---|---|---|
| `q`, `r` | int | Position. |
| `id` | int | Unique, from `nextId`; events refer to it. |
| `kind` | `'crate' \| 'gremlin'` | |
| `label` | string | `'C'` or `'G'`. |
| `color` | `#rrggbb` \| null | Gremlins get a seeded palette color; crates null. |

### Thing — a placed fixture (plain object)
*Serves:* G-1, G-2. Templates over snowflakes: every kind is a row of `THINGS` (§6).

| Field | Type | Notes |
|---|---|---|
| `kind` | `ThingKind` | `BELT`, `SPRING`, `PULLER`, `WALL`, `BRIDGE`. |
| `q`, `r` | int | Position. One Thing per hex. |
| `facing` | 0…5 \| null | Index into `Hex` neighbor directions; null for fixtures. Facing order E, NE, NW, W, SW, SE; clockwise is `(f+5) mod 6`. |

`THINGS[kind]` is the template:

| Field | Meaning |
|---|---|
| `push` | Hexes it shoves the piece standing on it, along `facing` (Belt, Spring). |
| `pull` | Hexes it pulls the piece on the **far hex** (two ahead along `facing`) back toward itself, into the **near hex** (one ahead) (Puller). |
| `blocks` | Pieces can't enter (Wall). |
| `on` | `'land'` (plains/ice) or `'water'` — where it may be built. |
| `weight` | Relative draw chance for the hand. |

### Board — query layer over `hexes`
From the base: `get`, `has`, `moveCost`, `isPassable`, `passableHexes`, `neighbors`,
`hasPath`. Passable means land (plains or ice). Transient, rebuilt with the map.

### GameUI view state (client only)
| Field | Notes |
|---|---|
| `picked` | `{ slot, facing, legal: Set<key> }` \| null — the hand card being placed. |
| `overlay` | `'intro' \| 'victory'` \| null. |
| `hoveredHex`, `panX/Y`, drag fields | As in the base. |
| `anim` | `{ t0, tracks, done }` \| null — tick animation; input waits while it runs. |
| `sound` | `GameSound`, `Math.random` only. |

---

## §2 Relations and invariants

- `hexes.size === MAP_COLS × MAP_ROWS`; every edge hex is `WATER`. [D]
- Source and target are on passable non-edge hexes, source in the leftmost placement slice,
  target in the rightmost, with a land path between them. [P]
- At most one Thing per hex. No Thing on the target. Bridges only on water; every other
  kind only on land. [P]
- At most one piece per hex. No piece on a Wall, on mountain, or on unbridged water. [P]
- `hand.length === HAND_SIZE` whenever a command returns. [P]
- Every command that returns `ok:true` ran exactly one tick and raised `turn` by 1. [P]
- `gameWon ⇔ delivered ≥ DELIVER_GOAL`. Once won, every command returns `{ ok:false }` and
  changes nothing. [D]
- **Engine-side modules never read the DOM, canvas, or `GameDisplayArtifacts`.** [D]
- **Determinism:** same seed + same commands ⇒ same state and same events. [D]

---

## §3 Map and terrain

| Terrain | Pieces | Things | Placed by |
|---|---|---|---|
| `WATER` | sink on entry, unless bridged | Bridge only | lowest band; all edges |
| `PLAINS` | enter normally | any land Thing | middle band |
| `ICE` | slide on through, unless a Thing covers it | any land Thing | scattered onto plains |
| `MOUNTAIN` | can't enter | none | highest band |

*Serves:* terrain as language — water is the hazard, ice is the windfall, mountains are
walls you didn't have to spend a card on. [P]

---

## §4 Rules

### Generate — `newGame(seed?)` [P]
*Serves:* G-3, a fresh puzzle every board.
```
state.seed = seed ?? floor(Math.random() * 2^32)
if not generateMap(seed, GEN_MAX_ATTEMPTS): seed = KNOWN_GOOD_SEED; generateMap(seed, 1)
    # generateMap: Rando.seed; build grid; assignTerrain; placeSourceAndTarget; hasPath?
things = []; pieces = []; spawn crate on source; spawnGremlins()
hand = HAND_SIZE draws; turn = 1; delivered = lost = spawnTimer = 0; gameWon = false
```

### Assign terrain [P]
```
edges -> WATER; inner sorted by elevation, by percentile p:
    p < WATER_PCT -> WATER; p < MOUNTAIN_PCT -> PLAINS; else MOUNTAIN
shuffle plains: first round(ICE_FRAC * inner) -> ICE
```

### Place source and target [P]
```
passable = board.passableHexes() sorted by col
slice = max(PLACE_SLICE_MIN, floor(PLACE_SLICE_FRAC * len))
source = Rando.choice(first slice); target = Rando.choice(last slice)
```

### Spawn gremlins [P]
*Serves:* comedy; moving obstacles.
```
count = sum of GREMLIN_DICE_COUNT rolls of d GREMLIN_DICE_SIDES
on shuffled passable hexes other than source, target, and the first crate
```

### Draw — `draw()` [P]
*Serves:* scarcity of agency (you build with what you're dealt).
```
return a kind chosen by Rando with probability THINGS[kind].weight / total weight
```

### Placement legality — `legalPlacements(kind)` [P]
*Serves:* G-2 (the highlight *is* the rule).
```
hex exists, no Thing there, not the target
THINGS[kind].on == 'water' ? terrain == WATER : terrain in {PLAINS, ICE}
THINGS[kind].blocks ⇒ no piece on hex
```

### Step — `step(piece, dir)` → `'moved' | 'blocked' | 'sank' | 'delivered'` [P]
*Serves:* one code path for every way a piece moves (movers, springs, ice, gremlins).
```
next = piece + DIR[dir]
if next off-map or MOUNTAIN or a blocking Thing or a piece there: return 'blocked'
piece.moveTo(next)
if piece is a crate and next == target: remove; delivered += 1; return 'delivered'
if next is WATER and no Thing there: remove; if crate: lost += 1; return 'sank'
return 'moved'
```

### Push — `push(piece, dir, n)` [P]
*Serves:* G-1; ice as windfall.
```
left = n
while left > 0:
    res = step(piece, dir); if res != 'moved': stop
    if piece's hex is ICE with no Thing: continue    # sliding is free
    left -= 1
```
A slide always ends: a straight line reaches the water edge.

### Tick — `tick()` [P]
*Serves:* G-1. Runs once per command.
```
phase = 'tick'; moved = {}
for thing in things (placement order):
    pusher: p = piece on thing's hex;  dir = facing;            n = push
    puller: p = piece on hex 2 ahead;  dir = opposite(facing);  n = pull
    if p and p.id not in moved: moved += p; push(p, dir, n)
for gremlin not in moved (creation order):
    dirs = directions whose neighbor is land or a bridge, empty, no blocking Thing
    if dirs: push(gremlin, Rando.choice(dirs), 1)
spawnTimer += 1
if spawnTimer >= SOURCE_INTERVAL and no piece on source: spawn crate; spawnTimer = 0
turn += 1; gameWon = delivered >= DELIVER_GOAL; phase = 'player'
```
Each piece moves at most once per tick. Gremlins never step into water on purpose, but a
gremlin that wanders onto ice, or is pulled into water, goes in. A Puller ignores pieces on
its own hex and on the near hex; a pulled piece that lands on bare ice slides on toward the
Puller and stops on it (a Thing covers its hex).

### Commands
```
place(slot, q, r, facing):
    legal: !gameWon, 0 <= slot < HAND_SIZE, (q,r) in legalPlacements(hand[slot]),
           facing in 0..5 for Things with push or pull (ignored, stored null, for fixtures)
    things.push({kind, q, r, facing}); hand[slot] = draw(); tick()
rotate(q, r):  legal: !gameWon and a Thing with a facing (push or pull) stands at (q,r)
    facing = (facing + 5) mod 6; tick()
wait():        legal: !gameWon; tick()
```

---

## §5 Agents — gremlins [P]

*Serves:* comedy, routes going stale. Gremlins use the same `step` as everything else. They
know only the board and occupancy. They pick a random free land or bridge neighbor, or
stay. They never push crates; a gremlin in the way is a wall until it moves. A gremlin
standing on a mover gets carried.

---

## §6 Numbers [T]

The code constant in `GameArtifacts` is the single source.

| Name | Value | Unit |
|---|---|---|
| `MAP_COLS` × `MAP_ROWS` | 16 × 10 | hexes |
| `DELIVER_GOAL` | 5 | crates |
| `SOURCE_INTERVAL` | 3 | ticks |
| `HAND_SIZE` | 3 | cards |
| `THINGS.SPRING.push` | 3 | hexes |
| `THINGS.BELT.push` | 1 | hexes |
| `THINGS.PULLER.pull` | 1 | hexes |
| `THINGS.*.weight` BELT/SPRING/PULLER/WALL/BRIDGE | 6 / 2 / 2 / 2 / 2 | relative |
| `GREMLIN_DICE_COUNT` / `GREMLIN_DICE_SIDES` | 1 / 4 | gremlins = count d sides |
| `GEN_MAX_ATTEMPTS` | 10 | tries per seed |
| `KNOWN_GOOD_SEED` | 1 | seed (must pass R-23) |
| `HEIGHTMAP_SIZE` | 33 | grid side (2ⁿ+1) |
| `HEIGHTMAP_ROUGHNESS` | 0.55 | — |
| `WATER_PCT` | 0.18 | elevation percentile |
| `MOUNTAIN_PCT` | 0.90 | elevation percentile |
| `ICE_FRAC` | 0.08 | of inner hexes |
| `PLACE_SLICE_FRAC` / `PLACE_SLICE_MIN` | 0.05 / 3 | of passable hexes / hexes |
| `HOP_MS` | 140 | ms per animated hop (client) |
| `DRAG_THRESHOLD` | 4 | px (client) |

---

## §7 Commands, queries, and events

### Commands

| Command | Legal when | Effect | Result |
|---|---|---|---|
| `newGame(seed?)` | always | regenerate | `{ok:true}` |
| `place(slot, q, r, facing)` | see Commands rule | build, redraw slot, tick | `{ok, events, won?}` |
| `rotate(q, r)` | a Belt, Spring, or Puller is there | turn clockwise, tick | `{ok, events, won?}` |
| `wait()` | `!gameWon` | tick | `{ok, events, won?}` |

Illegal → `{ ok:false }` and nothing changed (hand and `Rando` included).

### Queries
- `legalPlacements(kind)` → `Set<key>` — the same check `place` enforces.
- `thingAt(q, r)`, `pieceAt(q, r)`.
- `board.*`.

### Events (in the order they happened during the tick)

| Event | Fields |
|---|---|
| `move` | `id, path: [{q,r}…]` — every hex entered, in order, including slides |
| `sink` | `id` (the piece is gone after its last `move`) |
| `deliver` | `id` |
| `spawn` | `id, q, r` |

A piece pushed into water gets a `move` whose path ends on the water hex, then `sink`.

### Client contract [D]
The client reads state, calls commands and queries, never writes state, never calls
`Rando`, and animates only from events.
