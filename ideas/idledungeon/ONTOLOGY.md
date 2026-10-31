# IDLE DUNGEON — Ontology

This is the implementation reference for Idle Dungeon: what exists, what each thing
carries, the rules, and the interface between the engine and the UI. It is the only doc
in the set for now; open questions live in its last section instead of a RATIONALE.

**Tags.** **[D]** decided by the designer. **[P]** proposed by Claude, pending review.
**[T]** tunable number (see Numbers). **Serves:** the goal or quality an item exists for.
Constants are referred to by NAME everywhere except the Numbers table.

---

## §0 Purpose [D]

An idle dungeon crawl you steer only by **ordering a shopping list**. A party of four
(warrior, archer, mage, priest) roams a crude dungeon on its own, fighting oddly named
monsters; XP trickles in with time and kills; the head of your purchase queue buys itself
when XP allows. Costs, rewards and depth all grow exponentially, so every choice of order
is a bet on which exponential to feed next.

**Qualities**
- **Anticipation** — watching XP fill toward the item at the head of the queue.
- **Recognition** — the same hundred strange names recur; you learn to fear *Gleefully Ossemar*.
- **Greed has a price** — descending too early means dying a lot, visibly.
- **Crude charm** — blocky rectangles, gray lines on black, nothing more.

**Goals** (priority order)
- **G-1 Order is the decision.** The purchase queue's order is the player's only lever, and
  it must matter: a different order yields a visibly different run.
- **G-2 The exponential race.** Upgrade price, upgrade effect, and depth difficulty all grow
  exponentially; progress feels like soft walls followed by breakthroughs.
- **G-3 Watchable.** The party's fights are legible at a glance in a cropped, tank-centered view.
- **G-4 Double-click to launch.** Plain HTML/CSS/JS with `<script>` tags, no modules, no
  build; works on desktop and phone.

**When goals conflict:** G-1 > G-2 > G-3 > G-4, except G-4 is a hard constraint on tech.

**Non-goals (for now)**
- Any direct control of the party.
- Speed toggle — you live through it in real time. [D]
- Monster abilities (archers, fire breathers, freezers…) — the slot exists, empty. [D]
- Arena / wave mode — liked, deferred. [D]
- Save versioning or migration — prototype saves may break. [D]
- Sound.

---

## §1 Entities

### Game (top-level state)
*Serves: everything — the one struct the engine mutates and the save serializes.*

| Field | Type | Notes |
|---|---|---|
| seed | int | Game seed; roster and every level map derive from it. [D] (via determinism) |
| rng | Rng | Seeded PRNG for in-level randomness (spawns, wander picks). Re-seeded at level entry. |
| time | float s | Simulated seconds since game start. |
| xp | float | Unspent XP. ≥ 0. |
| depth | int ≥ 1 | Current dungeon level. |
| upgrades | map id → Upgrade | The catalog, with levels. |
| available | id[] | Upgrades not queued. Kept in catalog order. [P] |
| purchase | id[] | The queue; index 0 is the head. |
| roster | Species[] | ~ROSTER_SIZE monster species, generated once at new game. [D] |
| level | Level | The current map and its live contents. |
| heroes | Hero[4] | Warrior, Archer, Mage, Priest — fixed order. |
| wipeTimer | float s \| null | Counting down to reset after a party wipe. |
| earned, best, kills, wipes | float, int, int, int | Lifetime XP earned (drives the measured XP/s), deepest depth, totals. |
| acc, ticks, nextId, fieldCell, events | | Tick accumulator, tick count, monster id counter, leader cell of the flow field, pending events. |
| savedAt | epoch ms | Only in the save object: wall-clock time of the save (for offline XP). |

### Upgrade
*Serves: G-1, G-2.*

| Field | Type | Notes |
|---|---|---|
| id | string | e.g. `warrior.hp`, `party.xpRate`, `nextLevel`. |
| label | string | Shown in the lists. |
| owner | `warrior` \| `archer` \| `mage` \| `priest` \| `party` \| `dungeon` | Groups/colors the row. |
| baseCost | float | Cost at level 0. [T] |
| level | int ≥ 0 | Times bought. |
| effect | `mul` \| `div` \| `add` \| `faster` \| `quicker` | How level maps to the stat (see the effective-stat rule). |
| stat | string | Which stat it modifies (e.g. `archer.damage`). `nextLevel` has none. |

**Catalog** [D]

| Owner | Upgrades |
|---|---|
| Warrior | Max HP (`mul`), Armor (`mul`, flat reduction), Taunt radius (`mul`) |
| Archer | Damage (`mul`), Attack speed (`quicker` interval), Pierce (`add`, +1 enemy per level) |
| Mage | Damage (`mul`), Blast radius (`mul`), Cast speed (`quicker` interval) |
| Priest | Heal power (`mul`), Heal speed (`quicker` interval), Revive cooldown (`div`) |
| Party | XP per second (`mul`), XP per kill (`mul`), Move speed (`faster`) |
| Dungeon | Next Level |

### Hero
*Serves: G-3, Recognition (of your own party), Crude charm.*

| Field | Type | Notes |
|---|---|---|
| cls | `warrior` \| `archer` \| `mage` \| `priest` | Template key; base stats in Numbers. |
| x, y | float | World position (free movement, not cell-locked). [D] |
| hp | float | 0 ≤ hp ≤ maxHp (effective). |
| alive | bool | Dead heroes leave a corpse at x, y and do nothing. |
| cooldown | float s | Time until next attack / heal. |
| reviveCooldown | float s | Priest only; time until a revive is ready. [D] |
| targetId | int \| null | Current monster. |
| facing | float rad | For formation offsets and drawing the bow/staff side. |
| corpseFor, corpseField | Hero, Int16Array | Priest only: BFS field toward the corpse being walked to. |
| flash | float s | Display-only hit flash; never read by rules. |

### Species (roster entry)
*Serves: Recognition; future monster abilities.*

| Field | Type | Notes |
|---|---|---|
| name | string | `Adjective Body [title]`, e.g. *Brittle Squenmor*, *Ashen Rhodent the Leviathan*. [D] |
| adjective | string | From ADJECTIVES (adjectives and adverbs). [D] |
| body | string | Markov-generated from a character-trigram model. [D] |
| color | hsl | Derived from a hash of `body`. [D] |
| shape | ShapeId | Silhouette template, derived from hash of `body`. [D] |
| size | float | Radius in world units. |
| hpMult, dmgMult, speedMult | float | Species multipliers on the monster base stats: hashed from `Adjective Body`, then × each ability's multipliers. [P] |
| xpMult | float | Kill-XP multiplier: base hpMult × base dmgMult × each ability's `xp`. |
| abilities | string[] | Keys into the ability table; most species have none. [D] |
| labelColor | css \| null | Name color for species with an ability. |

Everything about a species is a pure function of its name, so the same name always looks
and fights the same. [D]

### Ability (template) [D]
*Serves: Recognition, Greed has a price.*

| Ability | Title | HP | Damage | Size | Kill XP | Roster count |
|---|---|---|---|---|---|---|
| beast | the Beast | ×2 | ×2 | ×1.5 | ×2 | 4 |
| leviathan | the Leviathan | ×3 | ×3 | ×2 | ×3 | 1 |

Abilities are parameter sets, multiplied into the species at roster generation. Roster counts are
`ROSTER_ABILITIES`; slots are drawn from the roster seed, so with uniform species picks about 4% of
spawns are Beasts and 1% Leviathans. Future abilities (archers, fire breathers, freezers) add rows
plus whatever behaviour hook they need.

### Monster
*Serves: G-2 (difficulty scales with depth), G-3.*

| Field | Type | Notes |
|---|---|---|
| id | int | Unique within the level. |
| species | index into roster | |
| x, y | float | World position. |
| hp, maxHp | float | maxHp = MONSTER_HP × hpMult × DEPTH_MULT^(depth−1) × foeScale. |
| damage | float | MONSTER_DMG × dmgMult × DEPTH_MULT^(depth−1) × foeScale. |
| cooldown | float s | Until next attack. |
| homeRoom | int | Room it spawned in; it idles there. |
| aggro | bool | Chasing a hero. |
| wanderTo, pause | {x,y} \| null, float s | Idle drift target inside homeRoom, and the wait before the next drift. |
| speed, size, facing, flash | | Copied from species at spawn; facing/flash for drawing only. |

### Projectile
*Serves: G-3 (you can see who is hitting what).*

| Field | Type | Notes |
|---|---|---|
| kind | `arrow` \| `bolt` \| `heal` | Arrow = thin rectangle; bolt = circle; heal = small gold circle. [D] |
| x, y, vx, vy | float | |
| damage | float | Or heal amount. |
| pierceLeft | int | Arrows: enemies it may pass through after the first. |
| hitIds | int[] | Monsters already hit (arrows don't double-hit). |
| radius | float | Bolts: blast radius on impact. |
| target | hero index | Heal orbs home on their ally. |

### Level
*Serves: G-3; the stage for everything.*

| Field | Type | Notes |
|---|---|---|
| depth | int | Which level this map is for. |
| w, h | int | Grid size in cells. |
| cells | Uint8Array | 0 = floor, 1 = wall. |
| rooms | Rect[] | Room rectangles (cell coords). rooms[0] is the entrance room. |
| roomOf | Int16Array | Cell → room index, −1 for corridor/wall. |
| entrance | {x,y} | Center of rooms[0]; party start. [D] |
| monsters | Monster[] | |
| projectiles | Projectile[] | |
| respawnTimer | float s | Until the next spawn attempt. |
| flow | Int16Array | BFS distance field from the leader's cell; rebuilt when the leader changes cell. [P] |
| visited | float[] per room | Last time the leader stood in each room (wander prefers stale rooms). |
| goalRoom, goalField | int, Int16Array | The leader's wander destination and its BFS field. |
| goalBest, goalSince | float, float s | Closest approach to the goal so far and when; drives the stuck valve. |

---

## §2 Relations and invariants

- Every upgrade id is in **exactly one** of `available` or `purchase`. [D]
- `xp ≥ 0` always; buying never drives it negative.
- `cost(u) = u.baseCost × COST_MULT^u.level` for every upgrade except `nextLevel`, whose cost
  is `NEXT_LEVEL_BASE × NEXT_LEVEL_MULT^u.level`. [D]
- The **leader** is the warrior while alive, else the first living hero in fixed order; the camera,
  the formation and the flow field all follow the leader. [P]
- `0 ≤ hp ≤ maxHp` for every hero and monster; a hero with `alive = false` has `hp = 0`.
- No unit's center is ever inside a wall cell.
- `level.monsters.length ≤ MONSTER_CAP`.
- Dead heroes take no actions and are not targeted.
- The level map is a pure function of `(seed, depth)`: a wipe returns the party to the same map. [D]
- **Determinism:** same seed + same commands at the same ticks ⇒ same state. The renderer and
  the UI only read state. [P]
- The engine never touches the DOM; it runs headless in Node. [P]

---

## §3 Map, look, and layout

### §3.1 Dungeon generation [D: big rooms, corridors, no doors or stairs]
*Serves: G-3.*

```
rng = Rng(hash(seed, depth))
place ROOM_COUNT rooms, sizes ROOM_MIN..ROOM_MAX cells, non-overlapping with a 2-cell margin
sort rooms by x; connect each to the next with an L-shaped corridor CORRIDOR_W wide
add EXTRA_LINKS extra corridors between random room pairs (loops, so the walk isn't a line)
everything else is wall; entrance = center of rooms[0]
```

### §3.2 Drawing [D]
*Serves: Crude charm, G-3.*

- **Background** black. **Walls** are gray lines drawn on every edge between a floor cell and a
  wall cell (no filled walls). A faint dark grid on floors is optional. [P]
- **Camera** centered on the leader (the warrior while it lives), smoothed but never trailing more
  than CAM_LAG cells; the shorter screen side shows VIEW_CELLS cells, cropped. [D]
- **Motion** is interpolated between ticks (units carry display-only `px, py`, the position at the
  start of the tick), so fast movement draws smoothly at any frame rate. Walking heroes bob with a
  fixed step cadence regardless of speed: speed upgrades lengthen the stride, not the steps. A
  sprite only turns when it moves more than FACING_MIN in a tick. [D cadence, P method]
- **Health bar** on every hero and monster: a vertical bar down the center of the body, black
  backing with red fill that drains toward the bottom. At 0 HP it's all black. [D]
- **Projectiles:** arrows are thin rectangles along their velocity; bolts are circles that
  flash to blast radius on impact; heal orbs are small gold circles. [D]
- **Heroes** are stacks of rectangles, no animated limbs, no letters. [D shape/colors, P details]
  - *Warrior* — wide, steel gray; a squat head block, a broad torso, and a darker shield
    slab on the facing side. The biggest silhouette; you always know where the leader is.
  - *Archer* — narrow, forest green; a thin hood block and a tall brown bow stave (a 2-px
    rectangle) on the facing side.
  - *Mage* — tall, deep blue; a peaked hat made of three shrinking stacked rectangles, and a
    staff with a small cyan block on top.
  - *Priest* — white robe widening at the hem (two stacked rects), a gold halo bar floating
    above the head.
  - *Corpse* — the same rectangles laid flat (rotated 90°), desaturated.
- **Monsters** are a colored silhouette from a small set of shape templates, scaled by size:
  - `squat` — wide low block with two small eye blocks on top
  - `tall` — narrow column with a cap block
  - `wide` — broad slab with stubby leg blocks
  - `blob` — a cluster of 4–6 overlapping offset squares
  - `spiky` — a core block with small rectangle spikes on each side
  - `stack` — three blocks of decreasing size piled up, slightly askew

  The name floats above in small gray text. [D: name/color/shape; P: templates]
- **Display effects** (owned by the renderer, spawned from events): "+N" XP floaters on kills,
  "Archer down" floaters, blast rings, warrior slash marks, a gold pillar on revive, and a
  centered banner for "DEPTH n" and "THE PARTY HAS FALLEN". [P]

### §3.3 Screen layout [D]
*Serves: G-3, G-4.*

- **Wide screens:** map canvas on the left filling the height; a right column with the status
  bar on top, then **Purchase** (the queue) and **Available**.
- **Narrow screens (phone):** map on top (~half the height), then the status bar, then
  Purchase and Available side by side.
- **Status bar:** depth, XP, XP/sec, `foes ×N`, and the head item with its ETA.
- **List rows:** owner + label, cost, level, and a preview of the stat now → after the next buy
  (e.g. `Lv 3 · 9.4 → 11.7`), tinted by owner. Purchase rows also show an ETA: cumulative cost
  down to that row ÷ the measured XP/s (30 s window, never below passive). The head row has a
  fill bar. [P]
- **Event log** under the lists: last 8 notable lines (who killed whom, revives, wipes, descents,
  purchases, time-away credit). Names the monster that felled a hero, for Recognition. [P]
- **Drag:** mouse drags anywhere on a row; touch drags by the ⋮⋮ grip so the lists still scroll.
  Double-click is a shortcut for queue-at-end / unqueue. [P]
- **New dungeon** button (with confirm) wipes the save and starts fresh. [P]

### §3.4 Code layout [D: script tags, no modules]

```
index.html          loads the scripts below in order, plain <script src>
style.css
js/rng.js           seeded PRNG + string hash
js/names.js         ADJECTIVES, CORPUS, trigram model, roster generation
js/data.js          Numbers constants, hero templates, upgrade catalog
js/map.js           dungeon generation, LOS, BFS flow field, wall collision
js/engine.js        Game state, tick, rules, commands, events (DOM-free)
js/render.js        canvas drawing (reads state only)
js/ui.js            lists, drag and drop, status bar, save/load, the main loop
test/sim.js         headless fast-forward under fixed queue strategies, with a stuck detector
test/smoke.js       engine + real renderer on a no-op canvas, save/load round trip
```

Each file attaches to a single global namespace (`window.ID` or similar) so Node can load
the engine via `vm` for headless sims. [P]

---

## §4 Rules

### Effective stat [D]
*Serves: G-2.*

```
stat(name) = base(name) applied with each upgrade u whose u.stat == name:
  mul:     base × EFFECT_MULT^L
  div:     base / EFFECT_MULT^L
  add:     base + L
  faster:  base × EFFECT_MULT^(L^SPEED_TAPER)     // speed tapers: super fast is possible,
  quicker: base / EFFECT_MULT^(L^SPEED_TAPER)     // but costs grow far faster than the speed
```
The effects are a lookup table, not a branch per upgrade. Speed upgrades (attack, cast, heal,
move) taper; everything else compounds fully. [D]

### Auto-purchase [D]
*Serves: G-1, Anticipation.*

```
each tick:
  while purchase nonempty and xp ≥ cost(head):
    u = purchase.shift()
    xp -= cost(u); u.level += 1
    purchase.push(u.id)                   // back to the end of the queue
    if u.id == 'nextLevel': enterLevel(depth + 1)
    emit purchased(u.id, u.level)
```
A head the player can't yet afford blocks everything behind it. [D]

### XP gain [D]
*Serves: G-2, Anticipation.*

```
each tick:  xp += stat('party.xpRate') × dt                  // passive
on kill:    xp += MONSTER_XP × sp.xpMult × DEPTH_MULT^(depth−1) × stat('party.xpKill')
```

### Foe scale [D]
*Serves: G-1 (XP per kill is a trade-off, not a free win), G-2.*

```
foeScale = Π over upgrades of def.foeMult ^ level      // only XP per kill has foeMult = FOE_MULT
applied to monster HP and damage at spawn, at every depth; never to kill XP
```
The status bar shows `foes ×N` once it's above 1; the XP-per-kill row's preview adds `foes ×FOE_MULT`.

### Damage, armor, healing [D armor, P rest]
*Serves: G-3.*

```
hero hit by monster:  taken = max(1, damage − stat(cls + '.armor'))   // flat; only the warrior has armor > 0
                      hp -= taken; if hp ≤ 0: hp = 0, alive = false, emit heroDied
monster hit:          hp -= damage; if hp ≤ 0: remove, award kill XP, emit killed
heal:                 hp = min(maxHp, hp + stat('priest.heal'))
```

### Combat actions [D roles, P details]
*Serves: G-3.*

```
strike:  while cooldown ≤ 0 (at most 8 per tick): act; cooldown += interval   // very fast attackers exceed 1/tick
warrior: if target within reach (HERO_R + size + MELEE_PAD): hit for warrior.damage
archer:  if target in range and LOS and cooldown ≤ 0: fire arrow (pierceLeft = stat archer.pierce)
mage:    if target in range and LOS and cooldown ≤ 0: fire bolt; on contact, damage every
         monster within stat('mage.radius')
priest:  if reviveCooldown ≤ 0 and a corpse exists: walk to it; within REVIVE_RANGE revive at
         REVIVE_HP_FRAC × maxHp, reviveCooldown = stat('priest.revive')
         else if an ally below 100% is in range and cooldown ≤ 0: send heal orb to the lowest-fraction ally
monster: if target within reach and cooldown ≤ 0: hit target for damage
```
Arrows travel until they hit a wall, exhaust pierce, or exceed range.
Without a living priest, dead heroes stay dead until a wipe or the next level. [D]

### Movement and collision [D free movement, P method]
*Serves: G-3.*

```
move(unit, goal):  step toward goal at speed × dt, in substeps ≤ CELL/4 (fast units never tunnel)
  each substep: try x, then y; an axis whose move would overlap a wall cell is skipped (slides along walls)
navigate(unit, goal, field): direct if a body-wide line of sight (centre ± radius) reaches the goal,
  else step to the neighbour cell one closer on the BFS field
separate: push apart every overlapping pair of living units (heroes and monsters) by half the overlap
```

### Monster spawning [D respawn, P details]
*Serves: G-2 (endless XP source), Greed has a price.*
*Measured (test/sim.js, 30 min, seed 1, Numbers as listed): queueing only Next Level wipes 27 times
by depth 3; queueing everything reaches depth 5 with ~100 hero deaths and 13 wipes; Next Level at
the head of everything reaches depth 4 with 18 wipes.*

```
respawnTimer -= dt
if respawnTimer ≤ 0 and monsters < MONSTER_CAP:
  pick a room whose center is ≥ SPAWN_MIN_DIST from the warrior
  pick a species uniformly from the roster
  spawn at a random floor cell in that room; respawnTimer = RESPAWN_INTERVAL
```
On level entry, fill to MONSTER_CAP immediately, excluding the entrance room.

### Party wipe [D]
*Serves: Greed has a price.*

```
if no hero alive and wipeTimer == null: wipeTimer = WIPE_DELAY; emit wiped
if wipeTimer counts to 0: enterLevel(depth)          // same map, same stats, XP kept
```

### Enter level [D]
*Serves: G-2.*

```
enterLevel(d):
  depth = d; level = generate(seed, d); rng = Rng(hash(seed, d, time))
  heroes at entrance in formation, all alive, hp = maxHp, cooldowns = 0, reviveCooldown = 0
  fill monsters; wipeTimer = null; emit levelEntered(d)
```
Buying Next Level calls this immediately, wherever the party is. [D]

### Offline XP [D]
*Serves: Anticipation (coming back to a bigger number).*

```
on load: away = (now − savedAt) / 1000
         xp += stat('party.xpRate') × away; emit offline(away, gained)
frame gap > AWAY_THRESHOLD (hidden tab): same credit instead of simulating the gap
```
Passive rate only, no kills. [D] The next tick's auto-purchase loop then buys through the queue,
which may include Next Level. [P]

### Save [D]
*Serves: G-4.*

```
every SAVE_INTERVAL and on page hide: localStorage[SAVE_KEY] = {seed, xp, earned, depth, best,
  kills, wipes, time, levels: {id: level}, available, purchase, savedAt: now}
a save whose lists don't hold every catalog id exactly once is refused (fresh game instead)
```
The roster and map regenerate from the seed. Mid-level positions are not saved; a load
starts at the current depth's entrance. [P] No versioning. [D]

---

## §5 Agents (party and monster AI)

Nobody is controlled by the player. [D] All agents act through the movement and combat rules
above. Agents see only what has line of sight within their aggro range, except the warrior's
wander choice, which knows the room list.

### The leader [D warrior leads, P behavior]
```
if any monster within TANK_AGGRO with LOS: target the nearest; close to reach × LEAD_CLOSE[cls]
else: if no goal, goal reached, or no progress for STUCK_TIME:
        goal = one of the 3 least-recently-visited rooms ≠ current; goalField = BFS(goal centre)
      navigate to the goal's centre on goalField
```
When the warrior dies the next living hero leads with the same brain; a lone priest wanders and
revives when it can.

### Followers (archer, mage, priest) [P]
```
formation point = leader position + offset rotated by leader.facing, scaled by FORMATION_DIST
  archer: back-left, mage: back-right, priest: straight back
  if that spot is in a wall: straight behind the leader; if that too: just stay within 2 spacings
step away from any monster within KITE_DIST, else navigate to the formation point on the flow field
archer and mage attack the leader's target if in range and visible, else the nearest visible monster
priest: walk to and revive a corpse when the revive is ready; else heal the lowest-fraction ally in range
```

### Monsters [P]
```
target = warrior if alive and within stat('warrior.taunt') of this monster,
         else the nearest living hero within MONSTER_AGGRO with LOS
if target: aggro = true; move to reach (direct if LOS, else descend the flow field)
else: drift to a random point in homeRoom, pause, repeat
```

---

## §6 Numbers [T]

| Name | Value | Unit | Notes |
|---|---|---|---|
| COST_MULT | 1.6 | × per purchase | [D] |
| EFFECT_MULT | 1.25 | × per purchase | [D] |
| DEPTH_MULT | 1.4 | × per depth | Monster HP, damage, kill XP. [D] |
| SPEED_TAPER | 0.6 | exponent | Speed upgrades: EFFECT_MULT^(L^SPEED_TAPER). [D taper, T value] |
| NEXT_LEVEL_BASE | 500 | XP | [P] |
| NEXT_LEVEL_MULT | 2 | × per level | [D] |
| FOE_MULT | 1.1 | × per XP-per-kill level | Monster HP and damage, all depths. [D rule, P value] |
| TICK | 1/30 | s | Fixed simulation step. |
| MAX_STEPS_PER_FRAME | 10 | | Catch-up cap per frame. |
| AWAY_THRESHOLD | 2 | s | Longer frame gaps are credited as time away. |
| CELL | 32 | world units | One grid cell. |
| MAP_W × MAP_H | 72 × 48 | cells | |
| ROOM_COUNT | 9 | | |
| ROOM_MIN / ROOM_MAX | 8 / 16 | cells | Big rooms. [D] |
| CORRIDOR_W | 3 | cells | |
| EXTRA_LINKS | 2 | | |
| VIEW_CELLS | 16 | cells | Shown along the shorter screen side. |
| CAM_LAG | 2 | cells | Max camera trail behind the leader. |
| FACING_MIN | 4 | units | Shorter moves keep the current facing. |
| XP_RATE | 1 | XP/s | Passive base. |
| MONSTER_HP / MONSTER_DMG | 60 / 6 | | Depth 1 base before species mults. [D: HP doubled for grind] |
| MONSTER_INTERVAL | 1.2 | s | |
| MONSTER_SPEED | 50 | units/s | |
| MONSTER_XP | 5 | XP | |
| SPECIES_MULT_RANGE | 0.6 – 1.8 | | Range of hpMult / dmgMult / speedMult. |
| MONSTER_CAP | 20 | | |
| RESPAWN_INTERVAL | 3 | s | |
| SPAWN_MIN_DIST | 12 | cells | |
| MONSTER_AGGRO | 6 | cells | |
| TANK_AGGRO | 8 | cells | |
| party.move base | 80 | units/s | In the hero base stats table in code (`N.BASE`). |
| HERO_R | 10 | units | Hero body radius. |
| MELEE_PAD | 6 | units | Melee reach beyond touching. |
| ARROW_SPEED / BOLT_SPEED / HEAL_SPEED | 400 / 250 / 300 | units/s | |
| STUCK_TIME | 4 | s | Leader picks a new room after this long without progress. |
| FORMATION_DIST | 1.5 | cells | |
| KITE_DIST | 2 | cells | |
| WIPE_DELAY | 3 | s | |
| REVIVE_RANGE | 1 | cell | |
| REVIVE_HP_FRAC | 0.5 | | |
| ROSTER_SIZE | 100 | | [D] |
| ROSTER_ABILITIES | beast 4, leviathan 1 | names | [D] |
| SAVE_INTERVAL | 10 | s | |
| SAVE_KEY | `idledungeon.save` | | |

**Hero base stats**

| Class | HP | Damage / Heal | Interval s | Reach / Range cells | Other |
|---|---|---|---|---|---|
| Warrior | 120 | 8 | 1.0 | 1 | armor 1, taunt 3 cells |
| Archer | 60 | 6 | 0.8 | 7 | pierce 0 |
| Mage | 50 | 10 | 1.6 | 6 | blast 1.5 cells |
| Priest | 60 | 8 heal | 1.2 | 6 | revive cooldown 30 s |

**Upgrade base costs**

| Upgrade | baseCost | Upgrade | baseCost |
|---|---|---|---|
| warrior.hp | 10 | priest.heal | 15 |
| warrior.armor | 25 | priest.healSpeed | 20 |
| warrior.taunt | 40 | priest.revive | 50 |
| archer.damage | 10 | party.xpRate | 15 |
| archer.speed | 20 | party.xpKill | 25 |
| archer.pierce | 60 | party.move | 40 |
| mage.damage | 10 | nextLevel | NEXT_LEVEL_BASE |
| mage.radius | 30 | | |
| mage.speed | 20 | | |

**Starting lists** [P]: purchase = `warrior.hp, archer.damage, mage.damage, priest.heal`;
everything else, including Next Level, starts in available.

**Big numbers** [P]: plain with separators below 1e6; then K/M/B/T suffixes; beyond 1e15,
`1.23e18`.

---

## §7 Commands and events

### Commands
Every command re-checks legality; illegal → `{ ok: false }` and no change. Legal →
`{ ok: true, events }`.

| Command | Legal when | Effect |
|---|---|---|
| `newGame(seed)` | always | Fresh state: roster from seed, depth 1, starting lists, xp 0. |
| `load(save, now)` | save parses | Restore lists/levels/xp/depth, enter current depth, apply offline XP. |
| `queue(id, index)` | id in available; 0 ≤ index ≤ purchase.length | Move id from available into purchase at index. [D] |
| `reorder(id, index)` | id in purchase | Move id within purchase to index. [D] |
| `unqueue(id)` | id in purchase | Move id back to available (catalog order). [D] |
| `tick(dt)` | dt > 0 | Advance the sim by whole TICKs (accumulator); returns events. |

There is no delete; dragging out of the purchase list means dropping it on Available. [D]

- `away(seconds)` — legal when seconds > 0: credit passive XP, run auto-purchase, emit `offline`.

### Read-only queries
- `cost(id)`, `stat(name)` — the same functions the rules use, so the UI shows real values (the
  list preview bumps a level, reads `stat`, and restores it).
- `leader()` — who the camera follows.
- `serialize(now)` — the save object.
- The renderer reads the game struct directly, read-only.

### Events

| Event | Fields | Used for |
|---|---|---|
| `purchased` | id, level, cost | Flash the row; re-render lists. |
| `killed` | monsterId, name, xp, x, y | Floater "+xp". |
| `heroDied` | cls, by, x, y | `by` is the monster's name, for the log. |
| `revived` | cls, x, y | Gold pillar. |
| `wiped` | depth | Status bar message during WIPE_DELAY. |
| `levelEntered` | depth, reason (`start`/`descend`/`wipe`/`load`) | Banner; camera snap. |
| `swing` | x, y | Warrior slash mark. |
| `blast` | x, y, r | Mage blast ring. |
| `offline` | seconds, xp | "While you were away: +N XP" log line. |

### Client contract
The UI reads state only through queries and changes it only through commands. The renderer
never mutates. The engine never touches the DOM, `Date.now()`, or `Math.random()`; wall time
enters only through `load(save, now)` and `serialize(now)`. [P]

---

## §8 Settled and open questions

Settled with the designer:
- **Armor** Flat armor, at least 1 damage always lands (simplest).
- **Speed** Speed upgrades taper (`faster`/`quicker`, SPEED_TAPER) so huge speed is possible but
  extra expensive; other upgrades compound fully.
- **Passive XP** doesn't scale with depth; depth pays through kill XP.
- **Roster** The whole roster appears at every depth with uniform odds; difficulty is DEPTH_MULT.

- **Grind** Monster HP doubled; XP per kill toughens all foes (FOE_MULT); Next Level grows ×2.
- **First abilities** Beast and Leviathan, flat 2× / 3× kill XP, titled names.

Open: FOE_MULT's value (1.1 chosen by Claude). Candidates for after playtest: more abilities
(archers, fire breathers, freezers), arena mode, packs instead of single spawns, a bestiary.
