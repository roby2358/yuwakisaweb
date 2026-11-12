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
out of a source; get enough of them to the target. Bigger boards open more colors as you
pass milestones, each with its own target, and every milestone unlocks a new card. [D:
place-then-tick, deliver N, no time limit, board size picked at New Game, colors opened by
milestones, cards unlocked by milestones]

**Qualities**
- **Tinkerer's delight** — the fun is setting something up and watching it go. [P]
- **One verb per Thing** — you can predict any Thing by looking at it. [P]
- **Comedy** — gremlins ride your belts into the sea, a Puller yanks a wandering gremlin
  into the drink, and a spring flings a crate onto ice so it skids home. Overlapping Things are allowed to do silly things. [P]
- **Board-wargame feel** — flat hexes, chunky counters. [D]

**Goals, in priority order**
- **G-1 The contraption is the toy.** Placing a Thing should change what the machine does
  on the very next tick, visibly. Concretely: every command but turning a mover ticks, and the tick is animated
  from engine events. [P]
- **G-2 Readable.** Every Thing does one thing, shown by its glyph and facing arrow; the
  legal placement hexes highlight before you commit. [P]
- **G-3 Keep the base platform's seams.** Server-portable State/Engine split, seeded
  reproducibility, double-click to run. [D]

**Priorities when goals conflict.** G-3's double-click and seam constraints beat
everything; G-2 beats G-1 (a funny interaction that can't be read is a bug, not comedy). [P]

**Non-goals (for now)** [D]
- A defeat condition, a time limit, or an end. The factory runs forever; the score is the
  turn each milestone was reached.
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
| `size` | key of `MAP_SIZES` | The board size this game was generated at. |
| `hexes` | `Map<"q,r", Hex>` | The map; `Board` wraps it. |
| `sources` | `[{q, r, colors}]` | Where crates appear; each makes the crates of its `colors` (one or more). Things may sit on one, except a blocking one (Wall). [D] |
| `targets` | `[{q, r, color, delivered}]` | One per open color, in the order they opened: it takes only `color` crates, and `delivered` sums their `value` (a big crate counts 10). Nothing may be built on one. [D] |
| `pieces` | `Piece[]` | Every crate and gremlin, in creation order. |
| `things` | `Thing[]` | Every placed Thing, in placement order (the order they act, Pushers and Pullers first: Tick rule). |
| `hand` | `{kind}[]` | Cards, length `HAND_SIZE` (Draw rule). A card has no color; a `colored` kind gets its color when placed (D-32). |
| `unlocks` | int ≥ 1 | How many `UNLOCKS` steps are open; their kinds are the deck (Unlock rule). A new game opens 1. [D: pjpd card-unlock] |
| `turn` | int ≥ 1 | Goes up by 1 per tick. |
| `delivered` | int | Crates delivered, all colors together, each counted at its `value` (a big crate is 10; milestones count this, D-34). |
| `lost` | int | Crates that sank, were wrecked by a gremlin or were blasted, each counted at its `value` (D-34). |
| `exGremlins` | int | Gremlins gone any way but a Trap: sunk, splatted, or killed on a target (Tick rule). Shown in the tally. [D] |
| `trapped` | int | Gremlins a Trap caught (Tick rule). Shown in the tally. [D] |
| `idleTicks` | int | Ticks in a row with no card used (`place`, `discard`); at `IDLE_REDRAW_TICKS` one card is redrawn (Tick rule). [D] |
| `spawnTimer` | int | Ticks since the last spawn chance (one timer for the board; a chance every `SPAWN_INTERVAL`). The crate cap isn't stored: it's `crateCap(size)` plus `milestonesReached(delivered)` (D-31). |
| `nextId` | int | Next piece id. |
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
A `Piece` (position, color, label) with two fields set by the engine. Each kind is a row of `PIECES`.

| Field | Type | Notes |
|---|---|---|
| `q`, `r` | int | Position. |
| `id` | int | Unique, from `nextId`; events refer to it. |
| `kind` | `'crate' \| 'bigcrate' \| 'gremlin'` | Key into `PIECES`. |
| `label` | string | `PIECES[kind].label`: `'📦'` or `'👹'`. |
| `color` | `#rrggbb` \| `CRATE_COLORS` name | Gremlins get a seeded palette color; a crate gets the open color the spawn rolled. Only its color's target takes it (Step rule); the client draws it as a shaded isometric box. [D] |

`PIECES[kind]` is the template:

| Field | crate | bigcrate | gremlin | Meaning |
|---|---|---|---|---|
| `label` | `'📦'` | `'📦'` | `'👹'` | The counter's glyph (the client draws crates as a box instead; a big crate's box is `BIG_CRATE_SCALE` bigger). |
| `cargo` | yes | yes | no | Delivered on entering its color's target, blocked by other colors' targets; counted in `lost` when it sinks. |
| `value` | 1 | 10 | 0 | What a delivery adds to `delivered` and its target's count, and what losing it (sunk, wrecked, blasted) adds to `lost`. Toward the crate cap every cargo piece counts one (D-34). [D: pjpd big-crate] |
| `wanders` | no | no | yes | Takes a random step on a tick when no Thing moved it. |
| `splats` | no | no | yes | A Rocket's flight destroys it: the piece the flier lands on, and the launched piece once it lands; so does coming onto a Trap (Step and Push rules). [D] |
| `wrecks` | no | no | yes | Its own wandering step into a cargo piece's hex destroys that piece (counted in `lost`) and takes the hex; pushed, pulled or flung into one, it's just blocked (Push rule). [D] |
| `reemerges` | no | no | yes | When one sinks or splats, a new one climbs out on a shore hex (Emerge rule). |

A big crate is a crate in every rule but `value`: Things, ice, bumps, Traps, targets and
gremlins treat it the same (D-34).

### Thing — a placed fixture (plain object)
*Serves:* G-1, G-2. Templates over snowflakes: every kind is a row of `THINGS` (§6).

| Field | Type | Notes |
|---|---|---|
| `kind` | `ThingKind` | `BELT`, `SPRING`, `ROCKET`, `PUSHER`, `PULLER`, `WALL`, `TRAP`, `BRIDGE`, `SLIDE`. |
| `color` | `WHITE` \| `CRATE_COLORS` name | Set by `place` and kept for good (D-32): a `colored` kind takes the open color the player picked, every other kind `WHITE`. A colored one acts only on crates of its color and on every gremlin; white acts on every piece. [D] |
| `q`, `r` | int | Position. One Thing per hex; placing on an occupied hex replaces it (D-28). |
| `facing` | 0…5 \| null | Index into `Hex` neighbor directions; null for fixtures. Facing order E, NE, NW, W, SW, SE; clockwise is `(f+5) mod 6`. |

`THINGS[kind]` is the template:

| Field | Meaning |
|---|---|
| `push` | Hexes it shoves (or flies) the piece standing on it, along `facing` (Belt, Bridge, Spring, Rocket). [Bridge D] |
| `splat` | Its push splats pieces that splat: the one it lands on and the one it launches (Rocket). [D] |
| `flies` | Its push is airborne: it passes over inland open water (only the outer sea, an edge hex, takes the piece mid-flight), every hex counts (ice is no shortcut mid-air), and it sinks if it comes down on water (Spring, Rocket). [D] |
| `skids` | A flying push that runs its full range onto slick ground (bare ice or a Slide) slides on, on the ground (Spring). [D; Slide D-29] |
| `shove` | Hexes it pushes the piece on the **near hex** (the one it faces) on, along `facing` (Pusher). [D] |
| `pull` | Hexes it pulls the piece on the **far hex** (two ahead along `facing`) back toward itself, into the **near hex** (one ahead) (Puller). |
| `blocks` | Pieces can't enter (Wall). |
| `traps` | A piece that splats dies when it comes onto this hex: walked, pushed, slid, or coming down from a flight; a flight passing over doesn't count (Trap). Every target does the same, with no Thing (Step rule). [D] |
| `colored` | Placed in an open crate color the player picks, never white (`colorChoices`, D-32); its card is drawn plain, and only once two or more colors are open (Pusher, Puller). [D] |
| `slides` | Slick ground: a piece that comes onto it on the ground keeps going the same way, free, exactly like bare ice (Slide). The one slick test, `isSlick`, reads it: a Thing on a hex decides by `slides`; with no Thing, the hex is slick if it's ICE. [D-29] |
| `on` | `'land'` (plains/ice), `'water'`, or `'both'` (land or water) — where it may be built. [both D-29] |
| `weight` | Relative draw chance for the hand, among the kinds in the deck (Draw rule). |

### Board — query layer over `hexes`
`get`, `has`, `moveCost`, `isPassable`, `passableHexes` (non-edge only), `neighbors`,
`hasPath`. Passable means land (plains or ice). Transient, rebuilt with the map.

### GameUI view state (client only)
| Field | Notes |
|---|---|
| `picked` | `{ slot, legal: Set<key> }` \| null — the hand card being placed. |
| `facing` | 0…5 — the ghost's facing, remembered between placements. |
| `overlay` | `'intro'` \| `'size'` \| `'news'` \| `'help'` \| `'color'` \| null. `'intro'` and `'size'` are size pickers; picking a size starts a game, and `'size'` (New Game) also closes on Esc, back to the game. `'news'` shows the colors `open` events named and the cards `unlock` events named, on one panel, and closes on a click or any key (D-30). `'help'` is the keys legend: it opens after the intro's size pick and from the Help button, and closes on a click or any key. `'color'` is the color picker (D-32): a click on a legal hex with a card whose `colorChoices` has more than one color opens it beside that hex, one swatch per choice; a swatch click or its number key sends `place` in that color; Esc, right-click or a click off the swatches closes it with the card still picked. [D] |
| `choosing` | `{ q, r, colors }` \| null — the hex and swatches of the open color picker; the ghost stands there while it's open. [D-32] |
| `hoveredHex`, `panX/Y`, drag fields | The hex under the cursor, the screen-space pan offset, and left-drag tracking (`DRAG_THRESHOLD`). |
| `anim` | `{ t0, dur, tracks, before, hidden, milestone, opened, unlocked, redrawn, ends }` \| null — tick animation; input waits while it runs (picking a card doesn't). |
| `running` | bool — Go/Pause. While true, the client calls `wait()` `RUN_GAP_MS` after each animation ends, and holds while a card is picked. [D] |
| `sound` | `GameSound`, `Math.random` only. |

---

## §2 Relations and invariants

- `hexes.size === cols × rows` of `MAP_SIZES[size]`; every edge hex is `WATER`. [D]
- Sources and targets are on passable non-edge hexes, sources in the leftmost placement
  slice, targets in the rightmost, each target with a land path from its color's source. No
  two share a hex. [P; colors D]
- Each open color has exactly one target and comes out of exactly one source;
  `targets.length <= MAP_SIZES[size].colors`, and the targets' colors are distinct `CRATE_COLORS`. [D]
- At most one Thing per hex. No Thing on a target. Bridges only on water; Slides on land or
  water; every other kind only on land. [P; Slide D-29]
- At most one piece per hex. No piece on a Wall, on mountain, or on open water (water with no Thing over it). [P]
- `hand.length === HAND_SIZE` whenever a command returns. [P]
- `1 <= unlocks <= UNLOCKS.length`, and every `THINGS` kind is in exactly one `UNLOCKS` step. [D]
- Every command that returns `ok:true` ran exactly one tick and raised `turn` by 1, except `rotate`, which ran none and left everything but that facing alone. [P; rotate D]
- There is no won state: every command stays legal however many crates are delivered. [D]
- **Engine-side modules never read the DOM, canvas, or `GameDisplayArtifacts`.** [D]
- **Determinism:** same seed + same commands ⇒ same state and same events. [D]

---

## §3 Map and terrain

| Terrain | Pieces | Things | Placed by |
|---|---|---|---|
| `WATER` | sink on entry, unless a Thing covers it (Bridge, Slide); a flying push crosses inland water and sinks only if it comes down on it | Bridge, Slide | lowest band; all edges |
| `PLAINS` | enter normally | any land Thing | middle band |
| `ICE` | slide on through, unless a Thing that doesn't slide covers it | any land Thing | scattered onto plains |
| `MOUNTAIN` | can't enter | none | highest band |

*Serves:* terrain as language — water is the hazard, ice is the windfall, mountains are
walls you didn't have to spend a card on. [P]

---

## §4 Rules

### Generate — `newGame(seed, size)` [P; size D]
*Serves:* G-3, a fresh puzzle every board. The caller supplies the seed: the client rolls
one with `Math.random`, and tests and replays pass theirs. The engine never rolls one.
The player picks the size (D-3).
```
legal: seed is a non-negative integer; size is a key of MAP_SIZES
state.seed = seed; state.size = size
ends = generateMap(seed, GEN_MAX_ATTEMPTS) or (seed = knownGoodSeed; generateMap(seed, 1))
    # generateMap: Rando.seed; build cols×rows grid sampling a heightmap-side
    #   diamond-square grid; assignTerrain; placeSourceAndTarget; hasPath? → {source, target}
color = Rando.choice(CRATE_COLORS)
sources = [{ends.source, colors: [color]}]; targets = [{ends.target, color, delivered: 0}]
things = []; pieces = []; a crate of color on the source; spawnGremlins()
unlocks = 1; hand = HAND_SIZE draws (from UNLOCKS[0]); turn = 1; delivered = lost = exGremlins = trapped = spawnTimer = idleTicks = 0
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

### Open a color — `openColor()` [D; placement P]
*Serves:* escalating commitment (each milestone asks for a second line), comedy (crossing
lines of different colors). Runs once per milestone reached, from the Tick rule.
```
if targets.length >= MAP_SIZES[size].colors: nothing
color = Rando.choice(CRATE_COLORS not yet open)
if Rando.random() < ENHANCE_CHANCE: src = Rando.choice(sources)        # it adds this color
else: src = Rando.choice(free hexes in the left slice)                  # a new source
tgt = Rando.choice(free hexes in the right slice with a land path from src)
if no src or no tgt: nothing                                            # the next milestone tries again
add color to src (or add {src, colors: [color]}); add {tgt, color, delivered: 0}
emit open{color, source, target}
```
A free hex has no Thing, no piece, and no source or target. The slices are the Place source
and target rule's.

### Spawn gremlins [P; scales with area D]
*Serves:* comedy; moving obstacles.
```
dice = gremlinDice(size) = max(1, round(cols * rows / GREMLIN_HEXES_PER_DIE))
count = sum of dice rolls of d GREMLIN_DICE_SIDES
on shuffled passable hexes other than the source, the target, and the first crate
```

### Emerge — `emerge(goneKinds)` [D]
*Serves:* comedy, routes going stale (the board never goes quiet).
```
shoreHexes = passable hexes with an edge-hex neighbor, canEnter, not a source or target
for each sunk or splatted kind with PIECES[kind].reemerges (in event order):
    if shoreHexes is empty: stop                 # a walled-off shore keeps it drowned
    h = Rando.choice(shoreHexes); color = Rando.choice(a random palette)
    add a new piece of that kind on h; emit spawn{id, q, r}
```
Runs once at the end of every tick, for that tick's sinks and splats and for a piece
`remove` sank just before the tick (its kind comes first, as its `sink` does).

### Draw — `draw()` [P]
*Serves:* scarcity of agency (you build with what you're dealt).
```
deck = the unlocked kinds (UNLOCKS[0 … unlocks-1]), minus the colored ones while fewer than 2 colors are open
kind = chosen by Rando from deck with probability THINGS[kind].weight / deck's total weight
return {kind}                                # no color: a colored kind's is picked at place (D-32)
```

### Unlock — `unlock()` [D; skipping and kept hand D-30]
*Serves:* G-1 and escalating commitment: each milestone hands you one new toy to learn, so the
first board is a short list (Belt, Bridge, Wall, Trap) and the deck grows as the factory does.
Runs once per milestone reached, after Open a color, from the Tick rule.
```
everDealt(kind) = not THINGS[kind].colored or MAP_SIZES[size].colors > 1
step = the first UNLOCKS step after the open ones with some kind everDealt   # an all-colored step is passed over on a one-color board
if no such step: nothing                                                   # past the last step
unlocks = that step's index + 1
emit unlock{kinds: that step}
```
The cards already in hand stay as they are; new kinds arrive through later draws (D-30).

### Placement legality — `canPlace(kind, hex)` [P]
*Serves:* G-2 (the highlight *is* the rule). `place` calls it; `legalPlacements(kind)` is
the set of hexes where it holds.
```
hex exists, not a target                      # a Thing already there doesn't count: place replaces it (D-28)
terrain fits THINGS[kind].on:  'land' → PLAINS or ICE;  'water' → WATER;  'both' → either
THINGS[kind].blocks ⇒ no piece on hex, and not a source   # the crates must flow
```

### Step — `step(piece, dir, flies)` → `'moved' | 'blocked' | 'sank' | 'delivered' | 'trapped'` [P; trap D]
*Serves:* one code path for every way a piece moves (movers, springs, ice, Slides, gremlins).
```
next = piece + DIR[dir]
if next off-map or MOUNTAIN or a blocking Thing or a piece there: return 'blocked'
if not flies and next is a target of another color than this cargo: return 'blocked'
piece.moveTo(next)
if PIECES[kind].cargo and next is the target of its color: remove; that target's delivered += value; delivered += value; return 'delivered'
if not flies and (a Thing with traps or a target is there) and PIECES[kind].splats: remove; return 'trapped'
if next is WATER and no Thing there and not (flies and next is inland):
    remove; lost += PIECES[kind].value; return 'sank'   # 0 for a gremlin
return 'moved'
```

### Push — `push(piece, dir, {n, splat, flies, skids, wrecks}, moved, by)` [P; splat, flies, skids, wrecks, bump D]
*Serves:* G-1; ice as windfall; comedy (the Rocket, billiard bumps).
```
left = n
while left > 0:
    res = step(piece, dir, flies)
    if res == 'blocked' and splat and the blocker is a piece with PIECES.splats:
        remove it; emit splat{id: it, by: piece}; res = step(piece, dir); stop after it  # lands there
    if res == 'blocked' and wrecks and the blocker is cargo:
        remove it; lost += its value; emit splat{id: it, by: piece}; res = step(piece, dir); stop after it
    if res == 'blocked' and nothing was hit and not flies: bump(piece, dir, moved)   # D-33
    if res != 'moved': stop
    if not flies and isSlick(piece's hex): continue    # sliding is free: a Thing with slides, or ICE with no Thing
    left -= 1
if skids and it ran its full range onto slick ground: slide on with step(piece, dir, false); blocked: bump(piece, dir, moved)
if flies and it came down on a target of another color: back to the hex before (the start if none)
if flies and piece is still on the board, on open water: sink it      # came down on inland water
elif flies and it came down on a Trap and PIECES[piece.kind].splats: remove it; res = 'trapped'
if res == 'trapped': emit splat{id, by: null, trap: a Trap is on the hex}   # else it died on a target
if splat and piece didn't sink or deliver and PIECES[piece.kind].splats: remove piece; emit splat{id, by: null, trap: false}
# events: move{id, path, by} (if it moved), then the splats/sink/deliver above, then the bumped piece's events

bump(piece, dir, moved):                                  # D-33
    other = the piece on the hex ahead of piece in dir
    if no other, or other.id in moved, or not isSlick(other's hex): nothing (piece was just blocked)
    moved += other; push(other, dir, {n: 1, splat: false, flies: false, skids: false, wrecks: false}, moved, by: piece)
```
**Bump (D-33).** A piece stopped on the ground by a piece standing on slick ground (bare ice
or a Slide) passes its motion on, like a billiard ball: the bumper stays where it stopped, and
the bumped piece goes one hex the same way and slides on over slick ground, through the same
`step` (it can sink, deliver, die on a Trap or be blocked). If it is stopped by another piece
on slick ground it bumps that one too; the chain ends because a piece that already moved this
tick (bumped ones included, even if they couldn't budge) can't be bumped. Every piece bumps
and can be bumped, gremlins included; a gremlin's own step into cargo still wrecks it
instead. A flight (Spring, Rocket in the air) doesn't bump; it comes down short as before, but
a Spring's skid is on the ground and does.
A slide or a flight always ends: a straight line reaches the water edge. A Rocket's flight
(`flies`, range `THINGS.ROCKET.push`) crosses movers, Bridges, ice, inland water and other
colors' targets, delivers on its color's target, and sinks in the outer sea, or in inland water if it comes down there. A
Spring's throw (`flies`, `skids`) does the same over its 3 hexes, then skids on if it lands
on bare ice or a Slide (D-29). A Slide moves nothing standing on it; it only keeps a piece
that comes onto it going, and over water it keeps that piece from sinking. Splatted pieces aren't `lost`. A gremlin dies on a Trap however it comes onto it
(a wander, a push, a slide, a landing), but not when a flight carries it over one, and not
when a Trap is built under it.

### Tick — `tick()` [P]
*Serves:* G-1. Runs once per command.
```
phase = 'tick'; moved = {}; deliveredBefore = delivered
for thing in things with shove or pull, then the rest (each in placement order):   # D-24
    mover:  p = piece on thing's hex;  dir = facing;            n = push
    Pusher: p = piece on hex 1 ahead;  dir = facing;            n = shove
    Puller: p = piece on hex 2 ahead;  dir = opposite(facing);  n = pull
    skip p if thing.color != WHITE and p is cargo of another color   # affects(thing, p)
    if p and p.id not in moved: moved += p; push(p, dir, {n, splat, flies, skids of THINGS[kind], wrecks: false}, moved, null)
for piece with PIECES[kind].wanders (creation order), skipping it if in moved by now:   # a bump may have moved it
    moved += piece
    dirs = directions whose neighbor is land or covered water (Bridge, Slide), no blocking Thing, and empty or holding cargo it wrecks
    if dirs: push(piece, Rando.choice(dirs), {n: 1, splat: false, flies: false, skids: false, wrecks: PIECES[kind].wrecks}, moved, null)
spawnTimer += 1
if spawnTimer >= SPAWN_INTERVAL:                                    # a spawn chance (D-31)
    spawnTimer = 0
    if crates on the board < crateCap(size) + milestonesReached(delivered):   # crateCap ∝ √area
        color = Rando.choice(open colors); src = the source that makes color
        if no piece on src:                                         # else nothing until the next chance
            p = bigCrateChance(milestonesReached(delivered))          # D-34
            kind = 'bigcrate' if p > 0 and Rando.random() < p else 'crate'   # no roll while p is 0
            a kind of color on src; emit spawn{id, q, r}
idleTicks = 0 if the command used a card (place, discard) else idleTicks + 1   # D-26
if idleTicks >= IDLE_REDRAW_TICKS: slot = Rando.int(0, HAND_SIZE-1); hand[slot] = draw(); idleTicks = 0; emit redraw{slot}
gone = kinds of the command's own sink (remove) and this tick's sunk and splatted pieces
trapped += count of gremlins whose splat has trap
exGremlins += count of 'gremlin' in gone, less those trapped
emerge(gone)
for each milestone m with deliveredBefore < m <= delivered: emit milestone{count: m}; openColor(); unlock()   # reachMilestones
turn += 1; phase = 'player'
```
Each piece moves at most once per tick, a bumped one included (D-33). Gremlins never step into water on purpose, but a
gremlin that wanders onto ice, or is pulled into water, goes in. A Puller ignores pieces on
its own hex and on the near hex; a pulled piece that lands on bare ice slides on toward the
Puller and stops on it (a Thing covers its hex). A Pusher ignores a piece on its own hex. A
gremlin that comes onto a target dies there, the same way as on a Trap.

### Milestones — `nextMilestone(delivered)` [D]
*Serves:* accumulation (a factory that keeps paying off), G-1.
```
milestones = FIRST_MILESTONE × (1, 2, 5) × 10^k for k = 0, 1, 2, …   # 10, 20, 50, 100, 200, 500, 1000, …
nextMilestone(n) = the smallest milestone > n                        # there is no last one
```
Reaching a milestone ends nothing: it may open a color (Open a color rule) and unlock cards
(Unlock rule), the client shows a banner, and play goes on. An opened color or unlocked card
also gets the news panel, which waits for a click or any key.

### Commands
```
place(slot, q, r, facing, color):
    legal: 0 <= slot < HAND_SIZE, canPlace(hand[slot], hex at (q,r)),
           facing in 0..5 for Things with push, pull or shove (ignored, stored null, for fixtures),
           color in colorChoices(kind)                  # D-32
    if a Thing stands at (q,r): things.remove(it)       # replaced; its card is spent (D-28)
    things.push({kind, color, q, r, facing}); hand[slot] = draw(); tick()
colorChoices(kind) = THINGS[kind].colored ? open colors, in opening order : [WHITE]
    # the new Thing is last in placement order and acts this tick on a piece standing there
rotate(q, r):  legal: a Thing with a facing (push, pull or shove) stands at (q,r)
    facing = (facing + 5) mod 6               # no tick: events = [], turn unchanged
remove(q, r):  legal: a Thing stands at (q,r)
    things.remove(that Thing)                  # the card is spent; the hand is untouched
    if a piece stands there on open water: sink it (lost += its value)
    tick(), with that sink as its first event and that kind in its emerge
blast(q, r):   legal: a crate (PIECES cargo) stands at (q,r)        [D]
    remove it; lost += its value               # Things untouched; gremlins can't be blasted
    tick(), with splat{id, by: null, trap: false} as its first event
discard(slot): legal: 0 <= slot < HAND_SIZE                       [D]
    hand[slot] = draw(); tick()                # Things and the other cards untouched
wait():        always legal; tick()
```

---

## §5 Agents — gremlins [P]

*Serves:* comedy, routes going stale. Gremlins use the same `step` as everything else. They
know only the board and occupancy. They pick a random free land or covered-water (Bridge, Slide) neighbor, or
stay, and a crate on a neighbor counts as free: stepping there wrecks it. They never push
crates; a gremlin in the way is a wall until it moves, unless it steps onto the crate.
Pushed or pulled into a crate, a gremlin is only blocked, unless the crate stands on slick
ground: then it bumps it (D-33), and a gremlin on slick ground gets bumped like a crate. A gremlin standing on a
mover (a Bridge too) gets carried. One that drowns or splats is replaced by a new one on the shore.
The count only drops when the whole shore is walled off or full.

---

## §6 Numbers [T]

The code constant in `GameArtifacts` is the single source.

| Name | Value | Unit |
|---|---|---|
| `MAP_SIZES` small / medium / large / huge | 16 × 10 / 20 × 20 / 30 × 30 / 60 × 60 | cols × rows (D-3) |
| `MAP_SIZES.*.heightmap` | 33 / 33 / 33 / 65 | diamond-square grid side (2ⁿ+1, ≥ the longer side) |
| `MAP_SIZES.*.knownGoodSeed` | 1 at every size | seed (must pass R-23) |
| `MAP_SIZES.*.colors` | 1 / 2 / 3 / 4 | most colors the board opens [D] |
| `ENHANCE_CHANCE` | 0.5 | chance a new color comes out of an existing source [D] |
| `FIRST_MILESTONE` | 10 | crates (then the 1-2-5 series, forever) |
| `SPAWN_INTERVAL` | 3 | ticks between spawn chances, board-wide, shared by every color [D] |
| `CRATE_CAP_PER_ROOT` | 0.6 | crates of the cap per hex of √(board area); `crateCap(size)` = max(1, round(this × √(cols × rows))): small 8, medium 12, large 18, huge 36; +1 per milestone reached (D-31) [D: sqrt shape; T: the constant] |
| `BIG_CRATE_HALF` | 4 | milestones reached at which half the spawns are big crates; `bigCrateChance(m)` = m / (m + this): 0, 0.2, 0.33, 0.43, 0.5 at m = 0…4, toward 1 (D-34) [T] |
| `PIECES.bigcrate.value` | 10 | crates a big crate is worth (D-34) [D] |
| `HAND_SIZE` | 3 | cards |
| `IDLE_REDRAW_TICKS` | 10 | ticks in a row with no card used before one random card is redrawn (D-26) |
| `CRATE_COLORS` | red, green, blue, yellow | the colors a game can open [D] |
| `WHITE` | white | the color of a Thing that acts on every piece [D] |
| `THINGS.SPRING.push` | 3 | hexes |
| `THINGS.BELT.push` | 1 | hexes |
| `THINGS.BRIDGE.push` | 1 | hexes, on the ground: a Belt over water (D-27) [D] |
| `THINGS.ROCKET.push` | 8 | hexes (its range) [D] |
| `THINGS.PULLER.pull` | 1 | hexes |
| `THINGS.PUSHER.shove` | 1 | hexes [D] |
| `UNLOCKS` | [BELT, BRIDGE, WALL, TRAP], [PUSHER, PULLER], [SLIDE], [SPRING], [ROCKET] | the order cards join the deck, one step per milestone [D] |
| `THINGS.*.weight` BELT/SPRING/ROCKET/PUSHER/PULLER/WALL/TRAP/BRIDGE/SLIDE | 6 / 2 / 1 / 0.5 / 0.5 / 2 / 1 / 1 / 1 | relative (TRAP [D]: as ROCKET; PUSHER, PULLER [D]: rare, about one per color is plenty; SLIDE [D-29]: as BRIDGE) |
| `GREMLIN_HEXES_PER_DIE` / `GREMLIN_DICE_SIDES` | 160 / 4 | hexes of board area per die (the small board's area) [D] / sides; gremlins = `gremlinDice(size)` d sides |
| `GEN_MAX_ATTEMPTS` | 10 | tries per seed |
| `HEIGHTMAP_ROUGHNESS` | 0.55 | — |
| `WATER_PCT` | 0.18 | elevation percentile |
| `MOUNTAIN_PCT` | 0.90 | elevation percentile |
| `ICE_FRAC` | 0.08 | of inner hexes |
| `PLACE_SLICE_FRAC` / `PLACE_SLICE_MIN` | 0.05 / 3 | of passable hexes / hexes |
| `HOP_MS` | 140 | ms per animated hop (client) |
| `RUN_GAP_MS` | 250 | ms between ticks while Go runs (client) |
| `MILESTONE_MS` | 3500 | ms the milestone banner shows (client) |
| `DRAG_THRESHOLD` | 4 | px (client) |
| `SPLAT_BLOTS` | 8 | drops in the splat burst (client) |

---

## §7 Commands, queries, and events

### Commands

| Command | Legal when | Effect | Result |
|---|---|---|---|
| `newGame(seed, size)` | `seed` is a non-negative integer and `size` a key of `MAP_SIZES` | regenerate at that size | `{ok:true}` |
| `place(slot, q, r, facing, color)` | see Commands rule (`color` one of `colorChoices`) | build in `color` (replacing any Thing there), redraw slot, tick | `{ok, events}` |
| `rotate(q, r)` | a Belt, Bridge, Spring, Rocket, Pusher, or Puller is there | turn clockwise; no tick | `{ok, events: []}` |
| `remove(q, r)` | any Thing is there | take it off (a piece left on open water sinks), tick | `{ok, events}` |
| `blast(q, r)` | a crate (or big crate) is there | blow it up (lost + its value), tick | `{ok, events}` |
| `discard(slot)` | `0 <= slot < HAND_SIZE` | redraw that slot, tick | `{ok, events}` |
| `wait()` | always | tick | `{ok, events}` |

Illegal → `{ ok:false }` and nothing changed (hand and `Rando` included).

### Queries
- `canPlace(kind, hex)` → bool — the check `place` enforces.
- `legalPlacements(kind)` → `Set<key>` — every hex where `canPlace` holds.
- `colorChoices(kind)` → color names — the colors `place` accepts for that kind: the open colors for a `colored` kind (the client asks the player when there's more than one), `[WHITE]` for any other (D-32).
- `affects(thing, piece)` — whether a Thing's color lets it act on that piece.
- `thingAt(q, r)`, `pieceAt(q, r)`, `targetAt(q, r)`, `sourceOf(color)`, `openColors()`, `isEndpoint(hex)`.
- `unlockedKinds()`, `drawableKinds()` — the kinds open so far, and the deck the Draw rule uses.
- `spawnKind()` — `'bigcrate'` or `'crate'` for the next spawn (Tick rule; rolls `Rando` only once a milestone is reached, D-34).
- `board.*`.

### Events (in the order they happened during the tick)

| Event | Fields |
|---|---|
| `move` | `id, path: [{q,r}…], by` — every hex entered, in order, including slides; `by` is the bumper's id for a bumped piece (D-33), else null. A bumped piece's `move` comes after its bumper's |
| `sink` | `id` (the piece is gone after its last `move`, or where it stood if the Bridge or Slide under it was removed) |
| `deliver` | `id` |
| `splat` | `id, by, trap` — a piece destroyed by a Rocket's flight, a Trap, a target, a gremlin's step, or `blast`: `by` is the flier or gremlin that landed on it, or null for the launched piece itself, a trapped piece (after its `move`), or a blasted crate; `trap` is true only when a Trap killed it |
| `spawn` | `id, q, r` — a new crate on a source, or a gremlin climbing out on the shore |
| `redraw` | `slot` — the hand slot the idle rule redrew this tick |
| `milestone` | `count` — a milestone this tick's deliveries reached (after the tick's other events) |
| `open` | `color, source: {q,r}, target: {q,r}` — the color that milestone opened, right after its `milestone` |
| `unlock` | `kinds` — the `UNLOCKS` step that milestone opened, after its `milestone` and `open` |

A piece pushed into water gets a `move` whose path ends on the water hex, then `sink`.

### Client contract [D]
The client reads state, calls commands and queries, never writes state, never calls
`Rando`, and animates only from events.
