# Hex & Counters — Ontology

The implementation reference for Hex & Counters: what exists, what each thing carries, how
things relate, the rules as short pseudocode, and the interface between the engine and any
client. When the code and this doc disagree, that is a bug in one of them; raise it, don't
silently pick a side. CRITERIA.md turns each rule here into testable rows.

**Tags.** **[D]** decided by the designer · **[P]** proposed by Claude, pending review ·
**[T]** tunable number · **[D, unbuilt]** decided but not yet in the code.
**Serves:** names the goal (`G-n`), quality, or DYNAMICS driver an item exists for.
IDs (`G-n`, `D-n`, `Q-n`, `R-n`/`U-n`/`X-n`) are stable and never reused; cite them, not
section numbers.

---

## §0 Purpose [D]

Hex & Counters is a **clean, minimal baseline for board-wargame-style hex-and-counter
games**. The game on it today is a movement puzzle: march the player counter across a
procedurally generated map to a target hex while wandering enemies get in the way. The
game is the vehicle; the platform is the product.

**Qualities**
- **Clean** — nothing from earlier projects (Realm's danger points, resources,
  installations) leaks in to shape a new game. [D]
- **Board-wargame feel** — flat terrain hexes, chunky counters with a printed-cardboard
  depth edge, deliberate select-then-act moves. [D]
- **Legible** — the legal moves are always shown before you commit; nothing is hidden. [D]
- **Forkable** — a new game starts by copying this and filling in extension points, not
  by ripping things out. [P]

**Goals, in priority order**
- **G-1 Baseline for future games.** Other hex games fork this (Founders' Road, The Waking
  Isle, …). Concretely: `Piece`, `Board`, and the engine hooks (`computeAttackable`,
  `locationAt`, `targeting`) are the extension points; the dispatch already routes to them. [D]
- **G-2 Server-portable split.** `GameState` + `GameEngine` (+ `Board`, `Piece`,
  `GameArtifacts`) run headless and unchanged on a server; `GameUI` is the only
  browser-coupled code. Concretely: no DOM, canvas, or display-artifact reads below
  `GameUI`; all randomness seeded. [D]
- **G-3 Reference implementation of UI_CONTROLS.md Layers 1–2.** Phase gating,
  select-then-act, click-vs-drag pan, one primary action, Esc peels a layer, overlays
  consume input. [D]
- **G-4 Reproducibility.** A game is reproducible from `state.seed`. [D]
- **G-5 Double-click to run.** Plain `<script>` globals, no build, runs from `file://`. [D]
- **G-6 Strip Realm leftovers.** Remove artifacts of other games so they don't influence
  new ones. [D]

**Priorities when goals conflict.** G-5 (it must run on a double-click) and G-2 (the
seam) beat everything; G-1 beats adding gameplay — a feature that makes the base harder
to fork doesn't belong here, it belongs in a fork. [P]

**Non-goals (for now)** [D]
- Combat, damage, unit stats, and any defeat condition.
- Abilities/aimed targeting (UI_CONTROLS Layer 4) and interactive locations — scaffolded,
  inert.
- A real network layer: serialized commands, `GameState` (de)serialization.
- Sprites/images — hexes are flat color fills.
- Touch and gamepad input.
- Balance or replay depth. The puzzle only has to be completable and readable.

---

## §1 Entities

### GameState — the world struct
*Serves:* G-2, G-4. Authoritative, serializable data only — no behavior, no DOM, no view
or interaction state.

| Field | Type | Notes |
|---|---|---|
| `seed` | uint32 | Reproducibility anchor; drawn once by `newGame` if not supplied. |
| `hexes` | `Map<"q,r", Hex>` | The map. Plain data; `Board` wraps it. |
| `player` | `Piece` | Label `'P'`, `color` null (drawn with a display constant). |
| `target` | `Piece` | Goal marker. Label `'★'`, `color` null. |
| `enemies` | `Piece[]` | Label `'E'`, each with its own seeded `#rrggbb` color. |
| `turn` | int ≥ 1 | Current turn number. |
| `mp` | int, 0…`PLAYER_MP` | Player movement points left this turn. |
| `gameWon` | bool | True once the player stands on the target. |
| `phase` | `'player' \| 'enemy'` | Whose turn is resolving. |

### Hex — one map cell (plain object)
*Serves:* G-1, G-2.

| Field | Type | Notes |
|---|---|---|
| `q`, `r` | int | Axial coordinates (pointy-top). Key is `"q,r"`. |
| `col`, `row` | int | Rectangle position; `q = col - floor(row/2)`, `r = row`. |
| `elevation` | float 0…100 | Generation-only: read by `assignTerrain`, nothing after. |
| `isEdge` | bool | Outer ring of the rectangle. |
| `terrain` | `TERRAIN` enum | See Terrain below. |

Forks add their own per-hex fields (units, control, resources) when a rule needs them.

### Piece — a positioned token
*Serves:* G-1 (forks subclass it for hp, faction, movement), G-2 (DOM-free record).

| Field | Type | Notes |
|---|---|---|
| `q`, `r` | int | Position. |
| `color` | `#rrggbb` \| null | Intrinsic color (state). Null means the client draws it with a display constant. |
| `label` | string | One glyph: `'P'`, `'E'`, `'★'`. |

Methods are pure conveniences: `key()`, `isAt(q, r)`, `moveTo(q, r)`. No rules.

### Board — query layer over `hexes`
*Serves:* G-1 (forks extend it with zones of control, roads, elevation), G-2.
Transient, not state: rebuilt by the engine whenever the map is, and wraps the **same**
`Map` reference that `GameState.hexes` holds.

| Member | Notes |
|---|---|
| `hexes` | The wrapped `Map`. |
| `get` / `has(q, r)` | Lookup. |
| `moveCost(hex)` | `MOVEMENT_COST[terrain] ?? Infinity`. The single source of passability. |
| `isPassable(hex)` | `moveCost(hex) !== Infinity`. |
| `passableHexes()` | Non-edge passable hexes, as a fresh array. |
| `neighbors(q, r)` | On-map adjacent hexes. |
| `hasPath(from, to)` | Reachable over terrain, ignoring pieces. |

### GameEngine
*Serves:* G-2. Rules + generation over a `GameState`. Mutates state and *returns
outcomes*; never renders. Holds `state` and `board`.

### GameUI view/interaction state (client only — never in `GameState`)
*Serves:* G-3. Listed so every piece of state has a home.

| Field | Type | Notes |
|---|---|---|
| `selection` | `{ reachable: Map<key,cost>, attackable: Set<key> }` \| null | Computed once at select time (L1.2). |
| `targeting` | `{ what, validHexes: Set<key> }` \| null | L4 scaffold; always null today. |
| `overlay` | `'intro' \| 'victory'` \| null | L5 input-capturing layer. |
| `hoveredHex` | `{q, r}` \| null | L1.3 HUD readout. |
| `panX`, `panY` | px | Render-only camera offset. |
| `dragCandidate`, `panning`, `panStart*`, `panOrig*` | — | Click-vs-drag gesture state. |
| `startDist` | int | Player→target hex distance at `newGame`; baseline for the progress meter. |
| `sound` | `GameSound` | Client-only audio; uses `Math.random`, never `Rando`. |

### Static definitions
- **GameArtifacts** (server-side rules data): `TERRAIN`, `MOVEMENT_COST`, and every
  tunable number in the Numbers table. *Serves:* G-2.
- **GameDisplayArtifacts** (client-only): `HEX_SIZE`, `COUNTER_SIZE`, `TERRAIN_COLORS`,
  `TERRAIN_NAMES`, `PLAYER_COLOR`, `TARGET_COLOR`, canvas chrome `BG_COLOR`/`UI_FONT`/`REACH_COLOR`, keyed off `GameArtifacts.TERRAIN`.
  *Serves:* G-2, board-wargame feel.

---

## §2 Relations and invariants

- `hexes.size === MAP_COLS × MAP_ROWS`; every key is `"q,r"` with `q = col - floor(row/2)`. [D]
- Every edge hex is `WATER`. [D]
- `board.hexes === state.hexes` (same reference) after every `newGame`. [D]
- The player, target, and every enemy stand on a passable, non-edge hex at generation. [D]
- No two enemies share a hex; no enemy ever shares the player's hex. [D]
- At spawn, no enemy is on the target hex. After spawn, enemies may walk onto it and
  block the win until they wander off. [D]
- `0 ≤ mp ≤ PLAYER_MP`. [D]
- `phase === 'player'` whenever a command returns; the enemy phase resolves synchronously
  inside `endTurn`. [D]
- `gameWon ⇒ player.isAt(target)`. Once won, `movePlayer` and `endTurn` return
  `{ ok:false }` and change nothing; the engine enforces this, not the UI. [D]
- `turn` starts at 1 and only increases, by exactly 1 per `endTurn`. [D]
- **Engine-side modules never read the DOM, canvas, or `GameDisplayArtifacts`.** [D]
- **`GameState` holds no view or interaction state.** [D]
- **`GameUI` never mutates `GameState` directly**; it changes it only through engine
  commands. [D]
- **Determinism:** same seed + same command sequence ⇒ same state. All engine randomness
  goes through `Rando`; nothing in the engine calls `Math.random` except to draw the seed. [D]

---

## §3 Map and terrain

### Coordinates [D]
Axial `(q, r)`, pointy-top hexes. The map is a rectangle `MAP_COLS × MAP_ROWS` laid out
with a per-row `qOffset = -floor(row/2)`, so each hex also carries `col`/`row`.
"Left" and "right" mean by `col`.

### Terrain [D]
*Serves:* the movement puzzle (routing around impassables and slow ground), board-wargame feel.

| Terrain | Enters for | Placed by |
|---|---|---|
| `WATER` | impassable | lowest elevation band; all edges |
| `PLAINS` | `MOVEMENT_COST[PLAINS]` | middle band, minus what forest/scrub take |
| `FOREST` | `MOVEMENT_COST[FOREST]` | scattered onto plains |
| `SCRUB` | `MOVEMENT_COST[SCRUB]` | scattered onto plains |
| `HILLS` | `MOVEMENT_COST[HILLS]` | upper band, minus what rough takes |
| `ROUGH` | `MOVEMENT_COST[ROUGH]` | scattered onto hills |
| `MOUNTAIN` | impassable | highest band |

Every terrain is pure movement cost; none carries resources or other meaning.

---

## §4 Rules

### Generate the map — `newGame(seed?)` [D]
*Serves:* G-4, the movement puzzle.
```
state.seed = seed ?? floor(Math.random() * 2^32)
if not generateMap(state.seed, GEN_MAX_ATTEMPTS):
    state.seed = KNOWN_GOOD_SEED; generateMap(state.seed, 1)
spawnEnemies(); turn = 1; mp = PLAYER_MP; phase = 'player'; gameWon = false
return { ok:true }

generateMap(seed, attempts):          # true at the first map with a path
    Rando.seed(seed)
    repeat attempts: build grid (elevation from diamondSquare(HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS)),
                     board = new Board(hexes), assignTerrain(), placePlayerAndTarget()
                     if board.hasPath(player, target): return true
    return false
```
`KNOWN_GOOD_SEED` builds a path on its first attempt, so every game is winnable, and the
fallback game is exactly `newGame(KNOWN_GOOD_SEED)`.

### Assign terrain [D]
*Serves:* the movement puzzle.
```
edges -> WATER
inner hexes sorted by elevation; by percentile p:
    p < WATER_PCT -> WATER;  p < HILLS_PCT -> PLAINS;  p < MOUNTAIN_PCT -> HILLS;  else MOUNTAIN
shuffle plains: first round(FOREST_FRAC*n) -> FOREST, next max(SCRUB_MIN, round(SCRUB_FRAC*n)) -> SCRUB
shuffle hills:  first max(ROUGH_MIN, round(ROUGH_FRAC*n)) -> ROUGH
```

### Place player and target [D]
*Serves:* the movement puzzle (a full crossing of the map).
```
passable = board.passableHexes() sorted by col
slice = max(PLACE_SLICE_MIN, floor(PLACE_SLICE_FRAC * len))
player = Piece(Rando.choice(first slice), color=null, 'P')
target = Piece(Rando.choice(last slice),  color=null, '★')
```

### Spawn enemies [D]
*Serves:* the movement puzzle (moving obstacles), board-wargame feel (colored counters).
```
count = sum of ENEMY_DICE_COUNT rolls of Rando.int(1, ENEMY_DICE_SIDES)
candidates = shuffled passableHexes() minus {player, target}
scheme = ColorTheory.randomScheme(Rando.random)
enemies = first `count` candidates as Piece(color = scheme[i % len], 'E')
```

### Reachability — `computeReachable()` [D]
*Serves:* legible (the highlight *is* the rule), G-3 (selection cache).
```
if mp <= 0: return {}
cost(hex) = Infinity if an enemy is on hex else board.moveCost(hex)
reach = bfsHexes(player, hexes, cost, maxCost = mp)   # Dijkstra: cheapest total cost
return reach minus player's own hex                     # Map<key, cost>
```

### Move — `movePlayer(q, r)` [D]
*Serves:* the movement puzzle; G-2 ("never trust the client": legality re-derived here).
```
if gameWon: return { ok:false }
cost = computeReachable()[q,r];  if undefined: return { ok:false }
player.moveTo(q, r);  mp -= cost
if player is on target: gameWon = true; return { ok:true, won:true }
if mp <= 0: endTurn(); return { ok:true, endedTurn:true }
return { ok:true }
```
The win check comes first: winning on the last MP does not run the enemy phase.

### End turn — `endTurn()` [D]
*Serves:* the turn structure; G-3 (L1.4 auto-end, L2.1 primary action).
```
if gameWon: return { ok:false }
phase = 'enemy'; moveEnemies(); phase = 'player'
turn += 1; mp = PLAYER_MP
return { ok:true }
```

### Win [D]
*Serves:* the movement puzzle. The player wins by entering the target hex (see Move). There
is no defeat condition and no combat; entering an enemy hex is impossible, not an attack.

### Extension points — inert [D]
*Serves:* G-1.
```
computeAttackable() -> empty Set       # L3: fill in for combat
locationAt(hex)     -> null            # L2.1: fill in for interactive locations
```

---

## §5 Agents — enemies [D]

*Serves:* the movement puzzle (moving walls that make a planned route go stale).
Enemies follow the same terrain rules as the player but move one hex, randomly, with no
goal. They know only the board and current occupancy; they don't know the target or the
player's plans.
```
occupied = enemy hexes + player hex
for enemy in enemies (in array order):
    options = on-map neighbors that are passable and not in occupied
    if options empty: stay
    else: move to Rando.choice(options); update occupied
```
Moves resolve in array order, so a later enemy sees earlier enemies' new positions.
The target hex is not excluded: an enemy standing on it blocks the win until it moves on.

---

## §6 Numbers [T]

Refer to these by name everywhere else. The code constant in `GameArtifacts` is the single
source, except `DRAG_THRESHOLD`, which is client-only.

| Name | Value | Unit |
|---|---|---|
| `PLAYER_MP` | 6 | MP / turn |
| `MAP_COLS` | 60 | hexes |
| `MAP_ROWS` | 40 | hexes |
| `MOVEMENT_COST[PLAINS]` | 1 | MP |
| `MOVEMENT_COST[FOREST/HILLS/SCRUB/ROUGH]` | 2 | MP |
| `MOVEMENT_COST[WATER/MOUNTAIN]` | Infinity | — |
| `GEN_MAX_ATTEMPTS` | 10 | tries per seed |
| `KNOWN_GOOD_SEED` | 1 | seed (must pass R-22) |
| `HEIGHTMAP_SIZE` | 129 | grid side (2ⁿ+1) |
| `HEIGHTMAP_ROUGHNESS` | 0.55 | — |
| `WATER_PCT` | 0.25 | elevation percentile |
| `HILLS_PCT` | 0.85 | elevation percentile |
| `MOUNTAIN_PCT` | 0.95 | elevation percentile |
| `FOREST_FRAC` | 0.10 | of inner hexes |
| `SCRUB_FRAC` / `SCRUB_MIN` | 0.01 / 3 | of inner hexes / hexes |
| `ROUGH_FRAC` / `ROUGH_MIN` | 0.02 / 2 | of inner hexes / hexes |
| `PLACE_SLICE_FRAC` / `PLACE_SLICE_MIN` | 0.03 / 5 | of passable hexes / hexes |
| `ENEMY_DICE_COUNT` / `ENEMY_DICE_SIDES` | 2 / 6 | enemies = count d sides |
| `DRAG_THRESHOLD` | 4 | px (`gameui.js`) |

---

## §7 Commands, queries, and events

The seam between the engine and any client (the UI today, a network handler tomorrow).

### Commands

| Command | Legal when | Effect | Result | Side effects |
|---|---|---|---|---|
| `newGame(seed?)` | always | Regenerate everything (see Generate the map) | `{ok:true}` | — |
| `movePlayer(q, r)` | `!gameWon` and `(q,r)` ∈ `computeReachable()` | Move player, spend cost | `{ok:false}` · `{ok:true}` · `{ok:true, won:true}` · `{ok:true, endedTurn:true}` | Wins, or runs `endTurn` at 0 MP |
| `endTurn()` | `!gameWon` | Enemy phase, `turn+1`, refill MP | `{ok:false}` · `{ok:true}` | — |

Every command re-checks its own legality and returns `{ ok, ... }`. `ok:false` means
illegal and nothing changed.

### Read-only queries
- `computeReachable()` → `Map<key, cost>` — the same function `movePlayer` enforces, so
  the yellow highlight *is* the rule.
- `computeAttackable()` → `Set<key>` (always empty).
- `locationAt(hex)` → `null`.
- `enemyKeys()` → `Set<key>`.
- `board.*` terrain queries (§1 Board).

### Events — [P, unbuilt]
None exist; the client re-renders from state after each command. Proposed for when a
client needs to animate or a server needs to broadcast:

| Event | Fields | Who learns of it |
|---|---|---|
| `PlayerMoved` | `from, to, cost, mpLeft` | all |
| `EnemyMoved` | `index, from, to` | all |
| `TurnEnded` | `turn` (new) | all |
| `GameWon` | `turn` | all |

### Client contract [D]
- The client **reads** `GameState` freely and calls commands and queries.
- The client **never writes** `GameState`, never re-implements a rule (it asks
  `computeReachable`), and never calls `Rando` (sound uses `Math.random`).
- View state (selection, targeting, overlay, hover, pan) lives only in the client.
- Input dispatch follows UI_CONTROLS.md: `overlay` → `targeting` → `selection`, all gated
  by `phase === 'player'` and `!gameWon`.
