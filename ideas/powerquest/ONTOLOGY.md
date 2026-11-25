# Power Quest — Ontology

The implementation reference: what exists, how it behaves, the numbers, and the command
interface. Why it is fun lives in [DYNAMICS.md](DYNAMICS.md); how we know it is right in
[CRITERIA.md](CRITERIA.md); why each choice in [RATIONALE.md](RATIONALE.md); history in
[ARCHITECTURE_LOG.md](ARCHITECTURE_LOG.md).

Tags: **[D]** decided by the designer · **[P]** proposed by Claude, pending review ·
**[T]** tunable number · **[D, unbuilt]** decided, not yet in code. *Serves:* names a §0 goal
or DYNAMICS driver. Constants are cited by name; their values are in §6 and in
`artifacts.js`.

## §0 Purpose [D]

A browser hex-and-counter game about a villager who finds ancient power armor and grows into
it: range a fogged jungle, plains and mesa wilderness, hunt the powered monsters and raiders
that menace the tribes, craft relic parts into armor modules, and level yourself and your
villages. It is an open-ended game: it does not end, and the player may at some point leave
the home village and found a new one.

**Qualities:** *awe and fragility* (the armor is bigger than you; early fights are close),
*earned escalation* (each level opens a new kind of fight), *belonging* (villages you chose
to help are named and mournable).

**Goals (priority order):**
- **G-1 Levels are the spine.** Hero level and village tier are the two numbers the player
  watches climb; each climb opens a concrete new option.
- **G-2 Hunting.** Monsters and raiders are named individuals; kills pay XP, parts and trust.
- **G-3 Crafting.** Parts plus found blueprints become armor modules in limited sockets.
- **G-4 Guardianship.** Villages are places the player earned the right to defend.
- **G-5 No turtling.** Power draws harder monsters; staying home earns less.
- **G-6 Readable consequences.** Costs show as highlights and numbers before you commit.

**Priorities when goals conflict:** G-1 over G-2 and G-3 over G-4 over G-5; G-6 breaks ties
(if a rule cannot be shown at the moment of decision, simplify it).

**Non-goals (for now):** a win or end state; recruited followers or commandable villagers;
multiplayer; sprites or animation beyond flat counters; save/load; line of sight for shots.

## §1 Entities

### GameState — the world struct [D]
*Serves: G-6 (everything the UI shows is a field here).* Plain serializable data; no behavior.

| Field | Type | Notes |
|---|---|---|
| seed | int | reproduces the whole game with the same commands |
| hexes | Map<"q,r", Hex> | terrain truth |
| hero | Hero | |
| villages | [Village] | |
| ruins | [Ruin] | |
| lairs | [Lair] | each lair has one guardian while `active` |
| enemies | [Creature] | |
| nemeses | [int] | ids of living enemies that shut the hero down |
| explored | {key: 1} | hexes whose terrain the hero has seen |
| turn | int | starts at 1; +1 per `endTurn` |
| mp | int | hero movement points left this turn |
| phase | 'hero' \| 'world' | whose phase is resolving |
| perkOffers | [[perkId]] | queued level-up offers; the first blocks other hero commands |
| nextId | int | id counter for creatures and sites |
| log | [string] | recent messages, capped at `LOG_MAX` |
| stats | {kills, shutdowns, found, crafted, deposited} | counters for the summary line |

### Hex — one map cell (plain object) [D]
`{ q, r, col, row, elevation, isEdge, terrain }`. Elevation and moisture are
generation-only. Terrain is one of WATER, PLAINS, JUNGLE, MESA (§3).

### Piece — a positioned token [D]
Base from the hex-and-counter platform: `{ q, r, color, label }` plus `key`/`isAt`/`moveTo`.

### Hero (extends Piece) [D/P]
*Serves: G-1, G-2, G-3.*

| Field | Type | Notes |
|---|---|---|
| level | int | starts 1 |
| xp | int | xp inside the current level; leaving level L costs `XP_STEP × L` |
| hp, charge | int | current; maxima derive from stats |
| shield | int | absorbs damage until the next hero phase |
| perks | {perkId: rank} | |
| sockets | [moduleId \| null] | length = socket count (§4 Sockets) |
| blueprints | [moduleId] | recipes learned from ruins |
| pack | {scrap, cells} | carried parts |
| sheltered | bool | convalescing in a village after a shutdown: enemies cannot attack (§4 Shutdown) |
| away | bool | true only while a shutdown's days are being resolved |

Derived **stats** (one function): `stat = base + Σ perk rank × amount + Σ passive module amounts`
for `hpMax, mp, chargeMax, chargeRegen, sight, melee, armor, loot`. Bases: `BASE_HP`, `BASE_MP`,
`BASE_CHARGE`, `CHARGE_REGEN_WILD`, `BASE_SIGHT`, `MELEE_BASE`, armor 0, loot 0.

### Creature (extends Piece) [D/P]
*Serves: G-2, G-5. One template, parameter sets from `ENEMY_KINDS` (D-12).*

| Field | Type | Notes |
|---|---|---|
| id | int | |
| kind | key of ENEMY_KINDS | gives group, tier, dmg, range, xp, drop |
| name | string | seeded two-syllable name; individuals are trackable (D-13) |
| hp, hpMax | int | guardians have hpMax × `GUARDIAN_HP_MULT` |
| speed | int | rolled once at spawn within the kind's range |
| home | lair id \| null | leash anchor for roamers and guardians |
| guardian | bool | holds a lair hex |
| slayer | bool | has shut the hero down; hunted for `REVENGE_XP_MULT` |

### Village (extends Piece) [D/P]
*Serves: G-4, G-1.*

| Field | Type | Notes |
|---|---|---|
| id, name | | |
| tier | 0..MAX_TIER | |
| stock | int | deposited value (scrap + `CELL_VALUE` × cells); tier is the highest index with `TIER_COSTS[i] ≤ stock`, never raised by anything else |
| trust | −∞..TRUST_MAX | below `OPEN_TRUST` the village refuses services |
| hp | int | defense; max `VILLAGE_HP_BASE + VILLAGE_HP_PER_TIER × tier` |
| giftBucket | float | trust it will still take from gifts; refills `GIFT_REFILL` per turn, cap `GIFT_CAP` |
| home | bool | the start village; always open to the hero (a safety net, D-16) |
| discovered | bool | on every site (village, ruin, lair): shown on the map once true |
| ruined | bool | fallen; drawn as a ruin and serves nobody |

### Ruin (extends Piece), Lair (extends Piece) [P]
- **Ruin:** `{ id, blueprint: moduleId|null, looted }`. A relic charger: a hero standing on it
  refills charge each world phase. The first visit loots it.
- **Lair:** `{ id, kind: 'camp'|'den', tier, active, timer }`. A camp breeds raiders, a den breeds
  beasts or relic monsters. Its guardian holds the lair hex until killed.

### GameUI view state — client only [D]
Pan, hover, selection, targeting mode, overlays, and the animation queue. Never in GameState.

### Static definitions [D]
`GameArtifacts` holds `TERRAIN`, `MOVEMENT_COST`, `MODULES`, `PERKS`, `ENEMY_KINDS`, and §6.
**Module templates (D-10):** *passive* `{stat, amount}`; *weapon* `{range, dmg, cost}`;
*active* `{effect: heal|shield, amount, cost}`. **Perk template (D-9):** `{stat, amount}`.

## §2 Relations and invariants

- INV-1 Same seed and same command sequence give the same state (all randomness routes through `Rando`).
- INV-2 Every site (village, ruin, lair) stands on a passable inner hex of the largest land mass; the
  home village connects to every other village by passable terrain.
- INV-3 At most one piece per hex among enemies; enemies never stand on village or ruin hexes,
  never on the hero; the only enemy on a lair hex is its guardian.
- INV-4 `0 ≤ hp ≤ hpMax`, `0 ≤ charge ≤ chargeMax`; `sockets.length` equals the socket count.
- INV-5 A village's tier never exceeds what `stock` pays for, except after a fall, which lowers both.
- INV-6 Every command returns `{ ok, events }`; `ok:false` changes nothing.
- INV-7 The engine never reads `GameDisplayArtifacts` or any DOM.

## §3 Map and terrain

Axial `(q,r)`, pointy-top, rectangle `MAP_COLS × MAP_ROWS` with per-row `qOffset = -floor(row/2)`
(from the platform). **Terrain [D]** — *Serves: terrain as language, G-6:*

| Terrain | Cost | Meaning |
|---|---|---|
| WATER | ∞ | impassable; the map edge ring |
| PLAINS | 1 | highway and killing floor |
| JUNGLE | 2 | cover: hero sight −`JUNGLE_SIGHT_PENALTY`; sites on it found only within `JUNGLE_HIDE_RADIUS` |
| MESA | 3 | elevated flat top: hero sight +`MESA_SIGHT_BONUS`, ranged reach +`MESA_RANGE_BONUS`; enemies without the `climber` rule never enter it (D-14) |

## §4 Rules

### Generate the world — `newGame(seed?)` [D/P]
*Serves: G-6, INV-1/INV-2.*
```
seed Rando; repeat up to GEN_MAX_ATTEMPTS:
  elevation = diamondSquare; moisture = diamondSquare
  edges -> WATER; inner ranked by elevation: < WATER_PCT water, >= MESA_PCT mesa, else plains
  the wettest JUNGLE_FRAC of plains -> jungle
  land = largest connected passable component; accept if |land| >= MIN_LAND_FRAC * inner
fall back to KNOWN_GOOD_SEED if none accepted (record it)
place VILLAGE_COUNT villages (plains, >= VILLAGE_MIN_DIST apart), home = random one
place one ruin at START_RUIN_DIST from home (blueprint = STARTER tier-1 module not owned),
  RUIN_COUNT-1 more ruins (blueprint weighted by siteTier), CAMP_COUNT camps, DEN_COUNT dens
  (>= SITE_MIN_DIST from every site; lairs >= HOME_SAFE_DIST from home, >= LAIR_VILLAGE_MIN from villages)
villages: home trust HOME_TRUST, others START_TRUST; hero on home, hp full, one starter weapon
each lair gets an active guardian (tier = min(MAX_ENEMY_TIER, siteTier+1))
spawn ROAMER_COUNT beasts/relic monsters on land at siteTier
```

### Stats, sockets, level — `heroStats()` [D/P]
*Serves: G-1.* Socket count `= min(MAX_SOCKETS, BASE_SOCKETS + floor((level-1) / SOCKET_LEVEL_STEP))`.
Gaining a socket appends a null. Level-up: while `xp ≥ XP_STEP × level`: subtract, `level++`, queue a
perk offer of `PERK_OFFER` distinct perks drawn at random (no cap on rank [D]), grow sockets, and raise
hp and charge by the change in max (not a free refill).

### Perk pick — `pickPerk(i)` [D/P]
```
legal: perkOffers.length > 0 and 0 <= i < offers[0].length
perks[offers[0][i]]++ ; offers.shift() ; recompute stats; hp,charge += gain in max
```

### Reachability and movement — `computeReachable()`, `move(q,r)` [D]
*Serves: G-6.* Cost-limited flood from the hero with budget `mp`; enemy hexes (a lair's guardian included) are walls;
the cost of a hex is `MOVEMENT_COST[terrain]`. The hero may enter village and ruin hexes. `move` re-derives legality itself:
```
legal: no perk offer pending, phase hero, (q,r) in computeReachable()
effect: hero.moveTo; mp -= cost; reveal(); arrival(): ruin loot if present; discover sites in sight
```

### Sight and fog [D/P]
*Serves: information as currency.* `sightRadius = max(MIN_SIGHT, stats.sight + terrainBonus)` where the
hero's terrain adds `MESA_SIGHT_BONUS` or subtracts `JUNGLE_SIGHT_PENALTY`. `reveal()`: every hex within
sightRadius is `explored`; sites in that radius are discovered (jungle sites only inside
`JUNGLE_HIDE_RADIUS`); the first discovery of a village or ruin pays xp. Enemies are *visible* only
within sightRadius of the hero. The world phase happens regardless of visibility.

### Melee — `attack(q,r)` [D]
*Serves: G-2; never stuck.*
```
legal: enemy adjacent, mp >= MELEE_MP
mp -= MELEE_MP; dmg = stats.melee + int(0, DMG_SPREAD); strike(enemy, dmg)
```

### Ranged — `shoot(slot,q,r)` [D]
*Serves: G-2, charge scarcity.*
```
legal: sockets[slot] is a weapon; enemy within range (+MESA_RANGE_BONUS if hero on MESA); charge >= cost
charge -= cost; dmg = weapon.dmg + int(0, DMG_SPREAD); strike(enemy, dmg)
```

### Strike and rewards [D/P]
```
strike(enemy, dmg): enemy.hp -= dmg; if hp <= 0: kill(enemy)
kill(e): remove e (and its slayer flag / nemeses entry); rewardXp = kind.xp * (REVENGE_XP_MULT if slayer)
          * (HOME_XP_MULT if within HOME_RADIUS of a village that is open)
         hero.xp += round(rewardXp); loot = kind.drop (+stats.loot of each part type that already drops > 0)
         hero.pack += loot; trust: each non-ruined village within TRUST_RADIUS gains KILL_TRUST_PER_TIER * kind.tier
         if guardian: lair.active = false, ruin-like spoils (kind.drop doubled once), discovery bonus
         levelUp check
```

### Active modules and boost — `activate(slot)`, `boost(n)` [D/P]
```
activate: sockets[slot] is active; charge >= cost; charge -= cost
          heal: hp = min(hpMax, hp + amount) | shield: shield += amount
boost(n): 1 <= n <= charge; charge -= n; mp += n * BOOST_MP_PER_CHARGE   (mp may exceed stats.mp)
```

### Village services [D/P]
A village is **open** to the hero when `!ruined && (home || trust >= OPEN_TRUST)`.
```
deposit(scrap,cells)  hero on a non-ruined village hex, 0 <= amounts <= pack, total > 0 (accepted even when closed)
   value = scrap + CELL_VALUE*cells; pack -= ; village.stock += value; retier()
   gift = min(value / GIFT_VALUE_PER_TRUST, giftBucket); giftBucket -= gift; trust = min(TRUST_MAX, trust + gift)
craft(moduleId, slot) hero on an OPEN village hex; moduleId in blueprints; slot a valid socket;
   village.tier >= module.tier - 1; pack >= price  ->  pack -= price; sockets[slot] = moduleId (replaces)
```
The village **rests** the hero in each world phase while the hero stands on its hex and it is open:
`hp += HEAL_BASE + HEAL_PER_TIER × tier` and `charge = chargeMax`.

### Founding — `found()` [D/P]
```
legal: hero on PLAINS, not on a site; pack >= FOUND_SCRAP scrap and FOUND_CELLS cells;
       distance to every village >= FOUND_MIN_DIST;
       an open village with trust >= FOUND_TRUST lies within FOUND_RADIUS, OR no open village exists
pack -= cost; new Village tier 0, trust FOUNDER_TRUST, hp full, giftBucket GIFT_CAP
```

### End turn and the world phase — `endTurn()` [D/P]
```
legal: no perk offer pending
phase = world; worldPhase(); phase = hero; turn++; mp = stats.mp; shield = 0
worldPhase(): enemy AI (§5); lairs spawn; villages tick; hero recovery
villages tick: hp += VILLAGE_HP_REGEN (cap), giftBucket += GIFT_REFILL;
  every DECAY_PERIOD turns, an open-or-not village with hero farther than NEGLECT_RADIUS loses 1 trust (floor 0 when ever positive)
hero recovery: charge += chargeRegen + CHARGE_REGEN_WILD (cap); on an open village rest (above);
  on a ruin hex charge = chargeMax
```

### Shutdown [D/P]
*Serves: loss aversion; revenge.* When hero hp reaches 0 in the world phase:
```
slayer = the attacker (flag it, add to nemeses); hero.away = true
run SHUTDOWN_DAYS world phases without the hero as a target
pack = floor(pack * (1 - LOSE_PACK_FRAC)); xp = floor(xp * (1 - LOSE_XP_FRAC)) (level kept)
shelter = nearest open village else nearest non-ruined village
  else (every village fallen) a new tier-0 village at FOUNDER_TRUST on the nearest free plains hex
shelter.trust -= SHUTDOWN_TRUST (an open shelter never drops below OPEN_TRUST); hero at shelter:
  hp = SHUTDOWN_HP, charge = 0, shield = 0, sheltered = true; turn += SHUTDOWN_DAYS
sheltered: enemies cannot attack the hero; cleared when the hero moves, or hp >= half of hpMax at recovery
```

### Wild respawn and lair re-arming [P]
*Serves: G-5, G-2 (the wilds never empty out).*
```
wildRespawn: if wild (non-guardian, no lair) < ROAMER_FLOOR and enemies < ENEMY_CAP and bool(ROAMER_SPAWN_CHANCE):
  pick a random ground hex >= ROAMER_SPAWN_MIN_DIST from the hero, free and enterable; spawn pickKind(beast|relic, tierFor(hex))
lair re-arm: an inactive lair counts timer; at LAIR_REARM, with its hex free and the hero beyond AGGRO,
  it gets a new guardian of tier min(MAX_ENEMY_TIER, tierFor(lair)+1) and becomes active
```

### Village under raid [D/P]
A raider (group raider) within 1 hex of a non-ruined village, instead of moving, hits it:
```
village.hp -= max(MIN_DMG, round(kind.dmg * RAID_DAMAGE_PER_HIT) - village.tier)
if hp <= 0: if tier > 0: tier--, stock = max(stock - cost of the lost tier, TIER_COSTS[tier]) , hp = hpMax / 2
            else: ruined = true  (drawn as fallen; it serves nobody and raiders ignore it)
```

### Tier for a place — `tierFor(hex)` [D/P]
*Serves: G-5 (escalation tied to progress).*
`siteTier = min(MAX_ENEMY_TIER, 1 + floor(minDistToVillage / TIER_DIST))`;
`tierFor(hex) = min(MAX_ENEMY_TIER, siteTier + floor((hero.level - 1) / TIER_LEVELS))`. Spawns pick a kind of
that group with tier ≤ `tierFor`, weight 1 at the cap, 0.5 one below, 0.25 lower.

## §5 Agents — enemies [D/P]

Every enemy follows one routine in the world phase, under the hero's rules (same terrain costs per hex,
walls, no teleporting; see D-12). Information limit: roamers and guardians react only to a hero within
`AGGRO`; raiders know where villages are (they are long-term hunters) but only attack the hero if it is
within reach.
```
for each enemy (in id order), for step in 1..speed:
  if hero present and distance(enemy, hero) <= range: attack once and stop (see below)
  else move one hex by behavior and continue
after steps: if not yet attacked and the hero is within range, attack once
behaviors by group:
  raider: if a non-ruined village exists: step down the cached cost field toward the nearest one; adjacent to it -> raid it
  beast, relic: if hero within AGGRO: step to the free neighbor minimizing distance to the hero;
                else random free neighbor, but never farther than ROAM_LEASH from home (if any)
  guardian: stay; chase only while hero within AGGRO and the step keeps it within GUARD_LEASH of the lair, else step back
attack: dmg = max(MIN_DMG, kind.dmg - stats.armor) after shield absorbs; hero.hp -= ; if hp <= 0 -> shutdown
```
Enemy movement rules: passable terrain only (MESA is closed unless the creature is a guardian on its lair or
its kind has the `climber` rule: none do today), free hex only, never a village or ruin hex. Lairs spawn:
```
lair.timer++ each world phase; if >= LAIR_SPAWN_PERIOD and living offspring (home == lair.id, not guardian) < LAIR_CAP and enemies < ENEMY_CAP:
  spawn a kind of the lair's group at tierFor(lair) on a free neighbor; timer = 0
```
Naming: each creature gets a seeded name; a creature with `slayer` is flagged with a ☠ in the UI.

## §6 Numbers [T]

Values live in `artifacts.js` (annotated there); this table is regenerated from it.

| Name | Value |
|---|---|
| `MAP_COLS` | 80 |
| `MAP_ROWS` | 60 |
| `GEN_MAX_ATTEMPTS` | 10 |
| `KNOWN_GOOD_SEED` | 1 |
| `MIN_LAND_FRAC` | 0.45 |
| `HEIGHTMAP_SIZE` | 129 |
| `HEIGHTMAP_ROUGHNESS` | 0.55 |
| `WATER_PCT` | 0.18 |
| `MESA_PCT` | 0.9 |
| `JUNGLE_FRAC` | 0.3 |
| `VILLAGE_COUNT` | 5 |
| `VILLAGE_MIN_DIST` | 14 |
| `RUIN_COUNT` | 14 |
| `CAMP_COUNT` | 4 |
| `DEN_COUNT` | 5 |
| `SITE_MIN_DIST` | 4 |
| `HOME_SAFE_DIST` | 10 |
| `LAIR_VILLAGE_MIN` | 7 |
| `START_RUIN_DIST` | [4,7] |
| `JUNGLE_HIDE_RADIUS` | 2 |
| `BASE_HP` | 20 |
| `BASE_MP` | 6 |
| `BASE_CHARGE` | 6 |
| `CHARGE_REGEN_WILD` | 1 |
| `BASE_SIGHT` | 4 |
| `MESA_SIGHT_BONUS` | 2 |
| `JUNGLE_SIGHT_PENALTY` | 2 |
| `MIN_SIGHT` | 1 |
| `MESA_RANGE_BONUS` | 1 |
| `MELEE_MP` | 1 |
| `MELEE_BASE` | 3 |
| `DMG_SPREAD` | 2 |
| `MIN_DMG` | 1 |
| `BOOST_MP_PER_CHARGE` | 1 |
| `BASE_SOCKETS` | 2 |
| `SOCKET_LEVEL_STEP` | 3 |
| `MAX_SOCKETS` | 6 |
| `XP_STEP` | 25 |
| `PERK_OFFER` | 3 |
| `START_TRUST` | -3 |
| `HOME_TRUST` | 6 |
| `TRUST_MAX` | 12 |
| `OPEN_TRUST` | 1 |
| `TRUST_RADIUS` | 8 |
| `KILL_TRUST_PER_TIER` | 1 |
| `CELL_VALUE` | 3 |
| `GIFT_VALUE_PER_TRUST` | 4 |
| `GIFT_CAP` | 4 |
| `GIFT_REFILL` | 0.25 |
| `TIER_COSTS` | [0,12,30,60,100,160] |
| `MAX_TIER` | 5 |
| `VILLAGE_HP_BASE` | 12 |
| `VILLAGE_HP_PER_TIER` | 6 |
| `VILLAGE_HP_REGEN` | 1 |
| `VILLAGE_REGEN_PER_TIER` | 1 |
| `HEAL_BASE` | 3 |
| `HEAL_PER_TIER` | 2 |
| `DECAY_PERIOD` | 10 |
| `NEGLECT_RADIUS` | 14 |
| `FOUND_SCRAP` | 15 |
| `FOUND_CELLS` | 3 |
| `FOUND_MIN_DIST` | 10 |
| `FOUND_TRUST` | 4 |
| `FOUND_RADIUS` | 20 |
| `FOUNDER_TRUST` | 4 |
| `SHUTDOWN_HP` | 1 |
| `SHUTDOWN_DAYS` | 3 |
| `LOSE_PACK_FRAC` | 0.5 |
| `LOSE_XP_FRAC` | 0.5 |
| `SHUTDOWN_TRUST` | 1 |
| `ROAMER_COUNT` | 16 |
| `LAIR_SPAWN_PERIOD` | 6 |
| `LAIR_CAP` | 3 |
| `ENEMY_CAP` | 60 |
| `ROAMER_FLOOR` | 16 |
| `ROAMER_SPAWN_CHANCE` | 0.5 |
| `ROAMER_SPAWN_MIN_DIST` | 8 |
| `LAIR_REARM` | 60 |
| `TIER_DIST` | 12 |
| `TIER_LEVELS` | 3 |
| `MAX_ENEMY_TIER` | 4 |
| `GUARDIAN_HP_MULT` | 1.5 |
| `AGGRO` | 4 |
| `ROAM_LEASH` | 8 |
| `GUARD_LEASH` | 4 |
| `HOME_RADIUS` | 6 |
| `HOME_XP_MULT` | 0.5 |
| `REVENGE_XP_MULT` | 2 |
| `DISCOVERY_XP` | 8 |
| `VILLAGE_DISCOVERY_XP` | 3 |
| `RUIN_CELLS` | 2 |
| `RAID_DAMAGE_PER_HIT` | 0.5 |
| `LOG_MAX` | 40 |

## §7 Commands, queries, and events

### Commands
Every command re-checks legality itself and returns `{ ok, events:[...] }`; `ok:false` changes nothing.
While `perkOffers` is non-empty only `pickPerk` and queries are legal.

| Command | Legal when | Effect |
|---|---|---|
| `newGame(seed?)` | always | generate (§4) |
| `move(q,r)` | in `computeReachable()` | move, spend mp, reveal, loot ruin |
| `attack(q,r)` | adjacent enemy, mp ≥ MELEE_MP | melee strike |
| `shoot(slot,q,r)` | weapon in slot, in range, charge | ranged strike |
| `activate(slot)` | active module, charge | heal or shield |
| `boost(n)` | 1 ≤ n ≤ charge | charge → mp |
| `deposit(scrap,cells)` | on a village | stock, tier, trust |
| `craft(moduleId,slot)` | on an open village with the blueprint and tier | fills a socket |
| `found()` | see Founding | new village |
| `pickPerk(i)` | an offer is pending | rank up a perk |
| `endTurn()` | no offer pending | world phase, new hero turn |

### Read-only queries (previews call the same rule code)
`computeReachable()`, `attackable()` (adjacent enemy keys), `shootable(slot)` (enemies in range),
`heroStats()`, `villageAt(hex)`, `isOpen(village)`, `canCraft(moduleId)` (reason string or null),
`canFound()` (reason or null), `visibleEnemies()`, `tierFor(hex)`, `sightRadius()`, `xpToNext()`.

### Events
| Type | Fields | Shown to |
|---|---|---|
| move | from, to | UI (animate hop) |
| hit | by:'hero'|enemyId, target, dmg, absorbed | UI |
| kill | enemyId, name, xp, loot, revenge | UI |
| enemyMove | id, from, to | UI, only if visible |
| levelUp | level, sockets | UI |
| perk | perkId, rank | UI |
| discover | site kind, id, xp | UI |
| loot | blueprint, cells | UI |
| trust | villageId, delta | UI |
| tier | villageId, tier | UI |
| raid | villageId, dmg | UI |
| villageFell | villageId, ruined | UI |
| spawn | id, kind, lairId | UI, only if visible |
| shutdown | byId, shelterId, lostPack, lostXp | UI |
| craft | moduleId, slot | UI |
| found | villageId | UI |

### Client contract [D]
`GameUI` may call engine commands and queries and read `GameState`. It may not mutate state, roll
dice, or compute legality itself. Fog is a *display* filter: the engine state holds everything; a future
server would filter by `explored`/visibility before sending.
