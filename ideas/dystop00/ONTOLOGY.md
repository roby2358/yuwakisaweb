# RADIO FREE SECTOR 9 — Ontology

The implementation reference: what exists, what each thing carries, how things relate, the
rules as short pseudocode, and the interface between the engine and any client. When code
and this doc disagree, that is a bug in one of them; raise it, don't silently pick a side.
CRITERIA.md turns each rule into testable rows; DYNAMICS.md says why it's fun.

**Tags.** **[D]** decided by the designer · **[P]** proposed by Claude, pending review ·
**[T]** tunable number · **[D, unbuilt]** decided but not yet in the code.
**Serves:** names the goal (`G-n`), quality, or DYNAMICS driver an item exists for —
*CORE* (Accumulation & Windfall: the Wake), *ALERT* (Escalating Commitment), *RIGS* (Loss
Aversion with Guardianship). IDs are stable and never reused; cite them, not sections.

---

## §0 Purpose [D]

A **sci-fi dystopian hex-and-counter game that leans hard on one dynamic and feeds it with
two smaller ones**, presented as a **1987 floppy-disk release**. Built on the Hex & Counters
base. [D]

**Qualities**
- **The windfall** — patient, furtive setup tipping into a city-wide chain reaction. [P]
- **The tightening noose** — success visibly summons the crackdown. [P]
- **Every rig matters** — five named transmitters, and losing one hurts. [P]
- **Readable** — the Wake is deterministic and previewed; Sweeper intent is drawn. [P]
- **Floppy-disk feel** — EGA palette, terminal font, boot screen, PC-speaker sound, DOS
  panels, a cheeky copy-protection check. [D]

**Goals, in priority order**
- **G-1 One core dynamic, leaned on hard.** Accumulation & Windfall via the Wake. Every
  way to win runs through it. [D]
- **G-2 Two lesser dynamics that feed the core, not distract.** Escalating Commitment
  (the Alert) and Loss Aversion (the Rigs). Each must change *how* you build the Wake,
  not give you a second thing to do. [D]
- **G-3 80s floppy release feel** across visuals, sound, and copy. [D]
- **G-4 Near-miss outcomes.** Wins are close; losses are one bridge short. [P]
- **G-5 Base-platform properties kept.** Server-portable State/Engine split, seeded
  reproducibility, double-click `index.html` to run, UI_CONTROLS Layers 1–2. [D]

**Priorities when goals conflict.** G-5's double-click and seam beat everything; then
G-1 > G-2 > G-4 > G-3. A mechanic that makes the Wake less central is cut even if it's fun. [P]

**Non-goals (for now)** [P]
- Combat. You can't hurt a Sweeper; the only weapon is the broadcast.
- A campaign, save games, or difficulty levels.
- Fog of war — the city is fully visible; the information game is Sweeper *sight*.
- Touch and gamepad input.

---

## §1 Entities

### GameState — the world struct
*Serves:* G-5. Authoritative, serializable data only.

| Field | Type | Notes |
|---|---|---|
| `seed` | uint32 | Reproducibility anchor. |
| `hexes` | `Map<"q,r", Hex>` | The city. Wake state lives on the hexes (`awake`). |
| `player` | `Piece` | The operator, label `'@'`. |
| `stations` | `Piece[]` | `stations[0]` is the Ministry (`'M'`); the rest are precincts (`'P'`). Sweeper spawn points; walls to everyone. |
| `rigs` | `Rig[]` | Fixed roster in `RIG_NAMES` order. |
| `sweepers` | `Sweeper[]` | Array order is move order. |
| `nextSweeperId` | int | Next Sweeper id; ids are never reused in a game. |
| `turn` | int ≥ 1 | |
| `mp` | int, 0…`PLAYER_MP` | Operator MP left this turn. |
| `phase` | `'player' \| 'broadcast' \| 'regime'` | `'player'` whenever a command returns. |
| `outcome` | `null \| 'won' \| 'captured' \| 'deadair'` | Non-null ⇒ game over. |

### Hex — one city cell (plain object)
*Serves:* CORE (terrain as language), G-5.

| Field | Type | Notes |
|---|---|---|
| `q`, `r`, `col`, `row` | int | Axial coords; `q = col - floor(row/2)`, `r = row`. |
| `elevation` | float | Generation-only (canal/arcology bands). |
| `density` | float | Generation-only (where blocks clump). |
| `isEdge` | bool | Outer ring of the rectangle. |
| `terrain` | `TERRAIN` | See Terrain. |
| `awake` | bool | Only ever true on a `BLOCK`. |

### Piece — a positioned token
*Serves:* G-5. `{ q, r, color, label }` with `key()`, `isAt()`, `moveTo()`; no rules.

### Rig extends Piece — a pirate transmitter
*Serves:* RIGS, CORE (the seed of every cascade).

| Field | Type | Notes |
|---|---|---|
| `id` | int | Index in the roster. |
| `name` | string | From `RIG_NAMES` (KILO-9, NOVA FM, …). |
| `label` | char | First letter of `name`. |
| `status` | `'carried' \| 'planted' \| 'smashed'` | `smashed` is permanent. |
| `q`, `r` | int \| null | Null while carried; a smashed rig keeps where it died. |
| `airtime` | int | Unjammed broadcasts since it was planted; 0 while carried. Its range is `rigRange(rig)`. |

### Sweeper extends Piece — a regime unit
*Serves:* ALERT; the counterforce to CORE and RIGS. A parameter set from the
`SWEEPER_KINDS` template table, not a type per kind.

| Field | Type | Notes |
|---|---|---|
| `id` | int | From `nextSweeperId`. |
| `kind` | `'WARDEN' \| 'HOUND' \| 'HUNTER'` | Rolled at spawn. |
| `mp` | int | From the kind; also the counter label (a wargame movement factor). |
| `prefers` | `'frontier' \| 'rig'` | Which target kind it hunts first. |
| `target` | `{ kind: 'player'\|'rig'\|'frontier'\|'patrol', key }` \| null | The commitment. |

### Board — query layer over `hexes`
*Serves:* G-5. Transient; rebuilt with the map; wraps the same `Map` as `state.hexes`.
`get/has`, `moveCost(hex)` (`MOVEMENT_COST[terrain] ?? Infinity`), `isPassable`,
`passableHexes()` (non-edge passable), `neighbors(q,r)`, `within(q,r,radius)` (on-map
hexes at distance ≤ radius), `isBlock(hex)`, `blocks()`, `hasPath(from,to)`.

### GameUI view state (client only — never in `GameState`)
*Serves:* G-3, readable.

| Field | Notes |
|---|---|
| `selection` | `{ reachable, attackable }`, computed at select time (L1.2). |
| `targeting` | L4 scaffold, always null. |
| `overlay` | `'insert' \| 'boot' \| 'title' \| 'end' \| null` (L5). |
| `anim` | Regime-phase playback: `{ t0, events, paths, woke, faded, spawned, duration, res }` or null. Input is locked while set. |
| `hoveredHex`, `panX/panY`, drag fields | As in the base. |
| `log` | The SIGNAL LOG lines, newest first. |
| `sound` | `GameSound`; uses `Math.random`, never `Rando`. |

### Static definitions
- **GameArtifacts** (rules data): `TERRAIN`, `MOVEMENT_COST`, `RIG_NAMES`,
  `SWEEPER_KINDS`, and every number in the Numbers table.
- **GameDisplayArtifacts** (client-only): the EGA palette, `TERRAIN_COLORS`,
  `TERRAIN_NAMES`, counter colors, tints, `HEX_SIZE`, `COUNTER_SIZE`, `HOP_MS`, `FLASH_MS`.

---

## §2 Relations and invariants

- `hexes.size === MAP_COLS × MAP_ROWS`; every edge hex is `CANAL`. [D]
- `hex.awake ⇒ hex.terrain === BLOCK`. [P]
- Stations stand on non-block passable hexes; nothing else ever stands on a station hex. [P]
- No two Sweepers share a hex; no Sweeper shares @'s hex unless `outcome === 'captured'`. [P]
- At most one planted rig per hex. A rig is `carried` ⇔ its position is null. [P]
- `TX_RANGE ≤ rigRange(rig) ≤ TX_RANGE_MAX`; a carried rig has `airtime 0`. [P]
- `0 ≤ mp ≤ PLAYER_MP`; `phase === 'player'` whenever a command returns. [P]
- `outcome !== null` ⇒ every command returns `{ ok:false }` and changes nothing. [P]
- `turn` increases by exactly 1 per `endTurn` that doesn't end the game. [P]
- **Engine-side modules never read the DOM, canvas, or `GameDisplayArtifacts`.** [D]
- **`GameUI` never mutates `GameState`**; it changes it only through engine commands. [D]
- **Determinism:** same seed + same commands ⇒ same state. Engine randomness goes through
  `Rando`; the engine never reads `Math.random` (the client draws the seed and passes it in). [D]

---

## §3 The city

### Coordinates [D]
Axial `(q, r)`, pointy-top hexes in a `MAP_COLS × MAP_ROWS` rectangle with per-row
`qOffset = -floor(row/2)`. "Left/right" mean by `col`.

### Terrain [P]
*Serves:* CORE — terrain is the percolation puzzle: blocks are tinder, everything else is
a firebreak.

| Terrain | @ / Sweeper cost | Wakes? | Placed by |
|---|---|---|---|
| `CANAL` | impassable | no | lowest elevation band; all edges |
| `ARCOLOGY` | impassable | no | highest elevation band |
| `BLOCK` | `MOVEMENT_COST[BLOCK]` (+`AWAKE_DRAG` for Sweepers if awake) | **yes** | densest `BLOCK_FRAC` of open hexes |
| `INDUSTRIAL` | `MOVEMENT_COST[INDUSTRIAL]` | no | `INDUSTRIAL_FRAC` of the remaining open |
| `RUINS` | `MOVEMENT_COST[RUINS]` | no | `RUINS_FRAC` of the remaining open |
| `PLAZA` | `MOVEMENT_COST[PLAZA]` | no | the rest |

---

## §4 Rules

### Generate the map — `newGame(seed)` [P]
*Serves:* G-5 (reproducible), CORE (a city worth bridging).
```
seed = seed >>> 0                                 # coerced to uint32; the client rolls it
if not generateMap(seed, GEN_MAX_ATTEMPTS): seed = KNOWN_GOOD_SEED; generateMap(seed, 1)
rigs = RIG_NAMES as carried Rigs; sweepers = []; turn 1; mp PLAYER_MP; phase player; outcome null
spawnSweepers(∞, [])                              # the opening patrol, up to the quota; not animated
generateMap(seed, n): Rando.seed(seed); repeat n: grid (elevation, density + DENSITY_JITTER·rand),
    assignTerrain, placePlayerAndStations; valid if stations all placed and hasPath(@, Ministry)
```

### Assign terrain [P]
*Serves:* CORE.
```
edges -> CANAL
inner by elevation percentile p: p < CANAL_PCT -> CANAL; p >= ARCOLOGY_PCT -> ARCOLOGY; else open
open by density, densest first: first round(BLOCK_FRAC × open) -> BLOCK
rest shuffled: first round(INDUSTRIAL_FRAC × rest) -> INDUSTRIAL, next round(RUINS_FRAC × rest) -> RUINS, else PLAZA
```

### Place @ and stations [P]
*Serves:* ALERT (the regime comes from the right; the left is quiet early).
```
passable sorted by col; slice = max(PLACE_SLICE_MIN, floor(PLACE_SLICE_FRAC × len))
@ = choice(first slice); Ministry = choice(non-block hexes of the last slice)
precincts: shuffled non-block passable hexes with col ≥ floor(PRECINCT_MIN_COL_FRAC × MAP_COLS),
           taken while ≥ STATION_SPACING from every station, until PRECINCT_COUNT
```

### Reachability — `computeReachable()` [P]
*Serves:* readable (the yellow highlight *is* the rule).
```
if mp <= 0 or over: {}
cost(hex) = Infinity on a Sweeper or station hex, else board.moveCost(hex)   # awake costs @ nothing extra
return bfsHexes(@, cost, maxCost = mp) minus @'s hex
```

### Move — `movePlayer(q, r)` [P]
```
if over or (q,r) not in computeReachable(): { ok:false }
@ moves; mp -= cost; afterSpend
```

### Plant — `plant()` [P]
*Serves:* RIGS, CORE. Cost baked into MP.
```
legal: not over, phase player, mp >= PLANT_MP, a rig carried, no planted rig on @'s hex
rig = first carried rig (roster order); rig planted at @'s hex; rig.airtime = 0
mp -= PLANT_MP; afterSpend
```

### Retrieve — `retrieve()` [P]
*Serves:* RIGS (strike-and-pull; carry it forward).
```
legal: not over, phase player, mp >= PLANT_MP, a planted rig on @'s hex
that rig -> carried (position null); rig.airtime = 0; mp -= PLANT_MP; afterSpend
```

### Auto end turn — `afterSpend` [P]
*Serves:* G-5 (L1.4).
```
if mp > 0: return result
end = endTurn(); return { ...result, endedTurn:true, events: end.events, outcome: end.outcome }
```

### End turn — `endTurn()` [P]
```
if over: { ok:false }
phase broadcast; broadcast()
if not over: phase regime; regime()
phase player; if not over: turn += 1; mp = PLAYER_MP
return { ok:true, events, outcome }
```

### Broadcast — the Wake [P]
*Serves:* **CORE**. Measured (D-3, D-15): over 40 maps with no Sweepers, the best single rig
settles at a median 16% of blocks if pulled after one broadcast and 24% if left on air.
One rig is a windfall, never a win.
```
plan = planBroadcast(null)
for h in plan.wake: h.awake = true                                # decided first, applied after
for h in plan.fade: h.awake = false
for rig in plan.live: rig.airtime += 1
if awakeCount >= ceil(WIN_FRAC × blockCount): outcome = 'won'
```

### Broadcast plan — `planBroadcast(without)` [P]
*Serves:* CORE (wake, fade), RIGS (holding a district up is a reason to stay on air),
readable (both previews call it). Everything is counted from the pre-phase state.
```
jam  = keys within JAM_RADIUS of any Sweeper
live = planted rigs, except `without` (a rig or null), whose hex is not in jam
held = hexes within rigRange(rig) of any live rig
wake = ∪ rigWakeSet(rig, rigRange(rig)) for live rigs
     ∪ sleeping BLOCKs not in jam with ≥ WAKE_THRESHOLD awake neighbors
fade = awake BLOCKs not in held with < FADE_THRESHOLD awake neighbors
```

### Rig range — `rigRange(rig)` [P]
*Serves:* RIGS (the longer it stays on air, the farther it reaches — and the longer a Hound
has to find it), CORE.
```
rigRange(rig) = min(TX_RANGE + rig.airtime, TX_RANGE_MAX)
rigWakeSet(q, r, jam, range) = [] if (q,r) in jam
    else sleeping BLOCKs within range of (q,r) not in jam
```
The UI's previews are the rule: the plant preview calls `rigWakeSet(q, r, jammedKeys(), TX_RANGE)`
(a fresh rig), and the pull preview shows `planBroadcast(rig).fade` minus `planBroadcast(null).fade`.

### Regime [P]
*Serves:* ALERT, RIGS.
```
for sw in sweepers (array order): walkSweeper(sw); stop the phase if over
sedate: each Sweeper's own hex -> asleep
if every rig is smashed: outcome = 'deadair'; stop
recall; spawn(SPAWN_PER_TURN)
```

### Sweeper sight [P]
*Serves:* ALERT, CORE (the woken city shelters you — asymmetry).
```
sees(sw) = distance(sw, @) <= SWEEPER_SIGHT and not (@'s hex is awake)
```

### Sweeper target choice [P]
*Serves:* readable (commitment patterns), RIGS (Hounds hunt rigs), CORE (Wardens choke the frontier).
```
if sees(sw): target = @
elif target still valid and reachable: keep        # rig still planted / hex still frontier / patrol not reached
else for kind in [sw.prefers, the other]: target = nearest by plan cost of that kind; break if found
else target = patrol to Rando.choice(reachable hexes)
frontier(hex) = BLOCK, asleep, with ≥ 1 awake neighbor
```

### Sweeper walk [P]
*Serves:* ALERT. Full-map Dijkstra (global vision), then walk within MP.
```
cost(hex) = Infinity on a station or another Sweeper, else moveCost(hex) + (hex.awake ? AWAKE_DRAG : 0)
path = shortest path to target; for each step: stop if cost > MP left; move; pay
  entering @'s hex: outcome = 'captured'; stop        # seen or not: a capture is an event
  entering a planted rig's hex: rig smashed; target = null; stop
```

### The Alert — spawn and recall [P]
*Serves:* **ALERT** (escalation tied to progress, with relief when the Wake shrinks).
```
quota = min(MAX_SWEEPERS, BASE_SWEEPERS + floor(awakeCount / AWAKE_PER_SWEEPER))
recall: up to RECALL_PER_TURN of the latest-spawned Sweepers not targeting @, while over quota
spawn(limit): repeat min(limit, quota - count): station = Rando.choice(stations);
    spot = Rando.choice(passable neighbors of station with no station, Sweeper, or @)
    skip if there is none; kind = SWEEPER_KINDS[d6 - 1]
```

### Win and loss [P]
*Serves:* G-4.
- **Won** — the Broadcast rule's win check.
- **Captured** — the Sweeper walk entering @'s hex.
- **Dead air** — the Regime's every-rig-smashed check.

### Extension points — inert [D]
`computeAttackable()` → empty Set (no combat); `locationAt()` → null; L4 `targeting` unused.

---

## §5 Agents — Sweepers [P]

Same terrain rules as @ plus `AWAKE_DRAG`. **Information limits:** they know the map,
every planted rig (transmitters can be triangulated), every awake block, and @'s
position only when `sees(sw)`. A hidden @ isn't avoided either: a path through @'s hex is a
capture. **Commitment:** a target is kept until it's invalid; only sighting @ overrides.
**Counterplay:** retrieve a hunted rig before the Hound arrives (at the cost of its range
and whatever it was holding up); plant deep in awake crowds
(drag); travel on awake blocks (shelter); bridge past a parked Warden (`TX_RANGE` >
`JAM_RADIUS`); lure with yourself (risky).

---

## §6 Numbers [T]

Refer to these by name everywhere else. The code constant in `GameArtifacts` (or
`GameDisplayArtifacts` / `gameui.js` for display-only ones) is the single source.

| Name | Value | Unit | Decision |
|---|---|---|---|
| `MAP_COLS` × `MAP_ROWS` | 48 × 32 | hexes | D-9 |
| `PLAYER_MP` | 6 | MP / turn | D-9 |
| `PLANT_MP` | 2 | MP | D-6 |
| `RIG_NAMES` (count) | 5 | rigs | D-6 |
| `MOVEMENT_COST[PLAZA/BLOCK]` | 1 | MP | D-2 |
| `MOVEMENT_COST[INDUSTRIAL/RUINS]` | 2 | MP | D-2 |
| `MOVEMENT_COST[CANAL/ARCOLOGY]` | Infinity | — | D-2 |
| `TX_RANGE` | 2 | hexes (a fresh rig) | D-1 |
| `TX_RANGE_MAX` | 4 | hexes (+1 per unjammed broadcast) | D-15 |
| `WAKE_THRESHOLD` | 2 | awake neighbors | D-1 |
| `FADE_THRESHOLD` | 2 | awake neighbors (below it, an unheld block sleeps) | D-16 |
| `WIN_FRAC` | 0.5 | of all blocks | D-4 |
| `JAM_RADIUS` | 1 | hexes | D-5 |
| `AWAKE_DRAG` | 1 | MP | D-7 |
| `SWEEPER_SIGHT` | 3 | hexes | D-7 |
| `BASE_SWEEPERS` | 2 | Sweepers | D-8 |
| `AWAKE_PER_SWEEPER` | 20 | awake blocks | D-8 |
| `SPAWN_PER_TURN` | 1 | Sweepers | D-8 |
| `RECALL_PER_TURN` | 1 | Sweepers | D-8 |
| `MAX_SWEEPERS` | 16 | Sweepers | D-8 |
| `SWEEPER_KINDS` | d6: 1–3 WARDEN (3 MP, frontier), 4–5 HOUND (4 MP, rig), 6 HUNTER (6 MP, rig) | — | D-10 |
| `GEN_MAX_ATTEMPTS` | 10 | tries | — |
| `KNOWN_GOOD_SEED` | 1 | seed (must pass R-6) | — |
| `HEIGHTMAP_SIZE` | 129 | 2ⁿ+1 | — |
| `HEIGHTMAP_ROUGHNESS` | 0.55 | — | — |
| `DENSITY_ROUGHNESS` | 0.7 | — | D-3 |
| `DENSITY_JITTER` | 80 | 0–100 scale | D-3 |
| `CANAL_PCT` / `ARCOLOGY_PCT` | 0.15 / 0.94 | elevation percentile | D-2 |
| `BLOCK_FRAC` | 0.45 | of open hexes | D-3 |
| `INDUSTRIAL_FRAC` / `RUINS_FRAC` | 0.3 / 0.2 | of non-block open | D-2 |
| `PLACE_SLICE_FRAC` / `PLACE_SLICE_MIN` | 0.03 / 5 | — | — |
| `PRECINCT_COUNT` | 2 | precincts | D-8 |
| `PRECINCT_MIN_COL_FRAC` | 0.5 | of `MAP_COLS` | D-8 |
| `STATION_SPACING` | 6 | hexes | — |
| `DRAG_THRESHOLD` | 4 | px (`gameui.js`) | — |
| `HOP_MS` / `FLASH_MS` | 110 / 320 | ms (display) | D-11 |

---

## §7 Commands, queries, and events

### Commands

| Command | Legal when | Effect | Result |
|---|---|---|---|
| `newGame(seed)` | always | Generate everything | `{ok:true}` |
| `movePlayer(q, r)` | not over, `(q,r)` ∈ `computeReachable()` | Move @, pay cost | `{ok}` (+ `endedTurn, events, outcome` at 0 MP) |
| `plant()` | `canPlant()` | First carried rig planted on @'s hex, pay `PLANT_MP` | `{ok, rig}` — `rig` is its id (+ end-turn fields at 0 MP) |
| `retrieve()` | `canRetrieve()` | Rig on @'s hex picked up, pay `PLANT_MP` | `{ok, rig}` — `rig` is its id (+ end-turn fields at 0 MP) |
| `endTurn()` | not over | Broadcast, regime, next turn | `{ok, events, outcome}` |

Every command re-checks its own legality; `ok:false` means illegal and nothing changed.

### Read-only queries
`computeReachable()`, `rigWakeSet(q, r, jam, range)` (the plant preview), `rigRange(rig)`,
`planBroadcast(without)` (the pull preview), `canPlant()`,
`canRetrieve()`, `sees(sw)`, `jammedKeys()`, `isFrontier(hex)`, `alertQuota()`,
`awakeCount()`, `blockCount()`, `winTarget()`, `plantedRigs()`, `carriedRigs()`,
`rigAt(q, r)`, `sweeperKeys()`, `stationKeys()`, `isOver()`, `computeAttackable()`,
`locationAt()`, and `board.*`.

### Events — returned in `events`, in the order they happened

| Event | Fields | Meaning |
|---|---|---|
| `woke` | `keys` | Blocks that woke this broadcast. |
| `faded` | `keys` | Blocks that drifted back to sleep this broadcast. |
| `won` | — | The win check passed. |
| `moved` | `id, path` | A Sweeper's walk, from its pre-move hex to where it stopped. |
| `smashed` | `rig, by` | A rig destroyed by Sweeper `by`. |
| `captured` | `by` | @ arrested. |
| `sedated` | `keys` | Blocks put to sleep under Sweepers. |
| `deadair` | — | The last rig is gone. |
| `recalled` | `id` | A Sweeper left the street. |
| `spawned` | `id, key` | A Sweeper deployed. |

`woke`, `faded` and `sedated` are emitted only when `keys` is non-empty, and `moved` only when
the Sweeper left its hex. All events are public (single player, full visibility).

### Client contract [D]
- The client **reads** `GameState` freely and calls commands and queries.
- It **never writes** `GameState`, never re-implements a rule (plant preview = `rigWakeSet`, pull preview = `planBroadcast`,
  highlight = `computeReachable`, SEEN = `sees`), and never calls `Rando`.
- It animates from `events`: state is already final when a command returns.
- Input dispatch follows UI_CONTROLS.md: `overlay` → `anim` → `targeting` → `selection`,
  gated by `phase === 'player'` and not over.
