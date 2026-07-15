# Game Dynamics

## Theme

**Making a name for yourself in a world that would grow without you — but grows better
because of you.** The player is a wandering protector in a living countryside. Villages
plow new fields, prosperity draws raiders out of the wilds, and the player's deeds in
defense of that prosperity earn a reputation that must be constantly renewed. There is no
victory and no game over — the fun is the long climb, and the world you watch flourish
(or burn) along the way.

## Key Drivers

1. **Accumulation and Windfall** — farmland spreads hex by hex, prestige accumulates deed
   by deed, status ratchets up rank by rank. The map itself is the progress bar.
2. **Guardianship** — villages and their fields are specific, visible, growing things the
   player protects. A burned farm is a hex the player watched appear.
3. **Escalating Commitment** — the player's own success raises the stakes: prosperity
   scales raider pressure, and each status rank demands more prestige to hold.

## The Core Loop

Villages grow farmland → farmland attracts raiders → the player defends → deeds earn
prestige → prestige climbs status → status grants privileges → privileges let the player
defend more → villages grow bigger.

The double edge that holds it together: **the world you protect is the source of the
danger, and the danger is the source of your fame.** A player who lets the world burn
starves their own ladder; a player who wants to climb must want the big raid to come.

## Map

- Rectangular hex grid (60 columns x 40 rows), pointy-top hexes
- Generated via diamond-square heightmap, then terrain assigned by elevation percentile
- Terrain distribution: 25% water, 50% plains, 10% forest, 10% hills, 1% gold, 2% quarry,
  5% mountains
- Edge hexes are always water
- 3–5 **villages** placed on plains hexes, at least 10 hexes apart, away from the map edge
- Gold and quarry are currently inert flavor terrain (future: trade)

## Terrain Movement Costs

| Terrain  | Cost      |
|----------|-----------|
| Plains   | 1         |
| Farmland | 1         |
| Village  | 1         |
| Forest   | 2         |
| Hills    | 2         |
| Gold     | 2         |
| Quarry   | 2         |
| Water    | Impassable|
| Mountain | Impassable|

## Villages and Farmland

*Serves: accumulation (the map visibly improves), guardianship (something specific to
protect).*

- Each village, at the end of each turn, has a **20% chance** to convert one random
  passable, non-farm hex adjacent to its farm cluster (or to the village itself) into
  **farmland**.
- A village's **prosperity** is the number of farmland hexes in its cluster. Prosperity is
  never spent — it is the thing being protected, and it drives raider pressure (below).
- Villages are durable but not immortal. Each village has **3 HP**. Raiders always burn
  fields first (see targeting, below), so a village only takes structural hits once its
  farms are stripped bare — abandonment isn't a flag, it's what being farmless *means*. A
  raider striking the village hex deals 1 damage, plunders it (instantly sated), and flees.
- A village with at least one farm **regains 1 HP per turn** — the fields sustain it.
  Rescuing a battered village is therefore real: drive off the raiders, let one farm grow
  back, and it recovers.
- At 0 HP the village **falls**: its hex reverts to plains, and a new village founds
  itself on a random valid plains hex elsewhere on the map. The world heals — the player's
  accumulated position doesn't. All that prosperity, and the patrol geography built around
  it, is gone. *Serves: loss aversion (specific, earned loss), accumulation (what was lost
  was visible progress) — without ever ending the long game.*

Pseudocode (world phase):

```
for each village:
    if rando() < 0.20:
        frontier = passable hexes adjacent to (village ∪ its farms) that are not farms
        if frontier not empty: convert random frontier hex to farmland
```

## Danger: Raiders

*Serves: guardianship, escalating commitment (escalation tied to progress — prosperity,
not time, drives pressure), variable reinforcement (speed rolls, spawn rolls).*

- Each turn there is a chance a raider spawns: **spawnChance = totalFarmland × 1%**
  (so a young world is quiet; a rich one is under steady threat).
- Raiders spawn on wild passable hexes (distance > 8 from every village) and path via
  **full A\*** toward the nearest target hex — global vision, no local-BFS horizon.
- **Targeting**: the target set is all farmland hexes, plus the hexes of any villages with
  *zero* farms. So a prosperous village shields itself with its own fields (eaten outer
  ring inward), and only a stripped village takes hits to the body.
- **Variable speed, rolled at spawn** (1d6): 1–3 → 1 hex/turn, 4–5 → 2, 6 → 3. Any spawn
  might be the fast one.
- Entering a farmland hex **burns it** back to plains; the raider then paths to the next
  nearest target.
- After burning **3** farms a raider is *sated* and paths back to its spawn point to leave
  the world. The return trip is interceptable — killing a sated raider recovers the
  plunder (bonus prestige). Rivals make the round trip too; the player can cut them off.
- The player's hex is pathable but never entered: a raider stalls in front of the player
  rather than walking through, so the player can physically bar a road or stand on a farm
  to deny it. *Serves: scarcity of agency (your body is a piece too).*
- Raiders are individually trackable counters (per-enemy color already exists) — the one
  that burned your field is identifiable and huntable. *Serves: revenge.*

Raiders replace the old random-walk enemies entirely (simplify until it hurts).

## Combat

*Serves: scarcity of agency (attacks spend the same MP as movement), readable
consequences, revenge.*

- Fills the inert L3 extension point: `computeAttackable` returns enemy-occupied hexes
  adjacent to the player.
- **Attacking costs 2 MP** and kills the raider (raiders have 1 HP in v1). The cost is
  baked into the action, not a separate check — an attack simply isn't offered below 2 MP.
- The player has **3 HP**. During the enemy phase, each raider adjacent to the player
  deals 1 damage — an animated, visible event, not a state check.
- At 0 HP the player is **carried to the nearest village**: HP restored, **prestige
  halved**. No game over — defeat is a fine, paid in fame. *Serves: loss aversion without
  ending the long game.*
- Healing: ending the turn on a village hex restores 1 HP — but only once the player holds
  Rank 1 (see Privileges). Below that, the knockout is the only way back to full.

## Prestige

*Serves: accumulation and windfall, variable reinforcement on a competence backbone.*

Prestige is earned by deeds and fades with time:

| Deed | Prestige |
|---|---|
| Kill a raider | +1 |
| …within 3 hexes of farmland or a village (defense, witnessed) | +2 more |
| …while it was sated (plunder recovered) | +2 more |

**Decay** (end of every turn): `prestige -= floor(prestige / 10)`

Small fame lingers; great fame fades. Below 10 prestige there is no decay at all, so the
early ladder is gentle — but a Lord bleeds renown every quiet week. The decay is the
anti-turtle mechanic: sitting still is mechanically a slow demotion.

The windfall structure falls out of the numbers: promotion requires a *burst* of deeds too
fast for decay to eat — which only a big raid provides. Patient patrolling holds rank;
repelling a warband is what climbs it. **The player learns to welcome the storm.**

## Status and Privilege

*Serves: escalating commitment (each rank raises the maintenance floor), loss aversion
(demotion takes back something concrete).*

Checked at end of turn, one step per turn:

- If `prestige > 3 × status` → **status +1**
- If `prestige < status` → **status −1** (never below 0)

So Rank 1 needs a single deed; Rank 5 needs a prestige spike above 12 to reach and steady
deeds to hold. The floor rises with the ceiling.

Each rank grants one concrete privilege, implemented as a single passive-modifier table
(`PRIVILEGES[status]`) — template, not snowflake. Losing the rank loses the privilege.

| Status | Title | Privilege |
|---|---|---|
| 0 | Wanderer | — |
| 1 | Yeoman | Rest: end turn on a village to heal 1 HP |
| 2 | Reeve | +1 MP (6 total) |
| 3 | Protector | Attacks cost **1 MP** instead of 2 |
| 4 | Warden | Inspiration: villages within 3 hexes of you roll growth twice |
| 5 | Lord | Dread: raiders adjacent to you have a 50% chance to hesitate (skip their move) |

Every privilege is a one-line field check against the table — no bespoke systems. Demotion
is specific loss: attacks get expensive again, the extra MP vanishes mid-campaign. That is
what makes the maintenance treadmill *felt* rather than read off a number.

## Turn Structure

1. **Player phase** — spend MP on movement and attacks; end turn (auto-ends at 0 MP)
2. **Enemy phase** — raiders move hop by hop (animated), burn farms, strike the adjacent
   player; sated raiders flee
3. **World phase** — village growth rolls, village HP regen, raider spawn roll, prestige
   decay, status check

## State Model

Everything new fits in the struct:

```
state.villages    = [{ q, r, hp, name, farms: ["q,r", ...] }]
state.enemies     = [{ id, q, r, speed, burned, sated, hp, color, homeQ, homeR }]
state.player      += { hp }
state.prestige    = 0
state.status      = 0
hex.terrain       += FARM | VILLAGE
```

`resource`, `units`, `controlled` on hexes remain inert placeholders.

## Strategies

- **Early (Wanderer → Yeoman):** shadow one village, pick off lone slow raiders. One kill
  promotes; low prestige doesn't decay, so Rank 1–2 is stable ground to learn from.
- **Patrol (holding rank):** orbit between two villages, spending each turn's MP so that
  you end within striking range of the likeliest approach. The recurring tension: MP spent
  traveling is MP not available for attacking.
- **Triage (the core decision):** two raids at once and you can reach one. Which village
  eats the loss? Prosperity lost is future spawn pressure *and* future prestige income —
  and a village stripped to zero farms starts taking structural hits. The player is
  choosing which problem to ignore, and the ignored problem can become permanent.
  *Scarcity of agency.*
- **The rescue:** a battered, farmless village is not yet lost — clear the raiders, and
  one regrown farm both re-shields it (raiders retarget the farm) and starts its HP
  recovery. Riding to the relief of a village at 1 HP is the design's intended drama peak.
- **The climb:** to break a promotion threshold, let farmland (and thus raid pressure)
  build, then intercept a burst of raiders in a few turns — deeds faster than decay.
  Deliberately courting the storm is the intended path upward.
- **The cutoff:** a sated raider must walk out. Reading its exit path and ambushing it is
  the highest-prestige-per-MP play, at the cost of letting it burn first.
- **The write-off (dark, legal):** a village founded somewhere indefensible can be
  deliberately abandoned — it falls and refounds at a random location, maybe a better one.
  The price is everything it had grown plus a die roll on the new spot; expensive enough
  to be a judgment call, not an exploit.

### Anti-strategies (and what prevents them)

- **"Let the world burn, farm kills at leisure"** — burned farmland lowers total
  prosperity, which lowers spawn rate, which starves prestige income while decay
  continues. The ladder is fueled by the world's health; arson-adjacent play is
  self-defeating *mechanically*, not just morally.
- **"Turtle in one village"** — unguarded villages get eaten back, total prosperity
  plateaus low, raids become too rare to outpace decay at higher ranks. Prestige decay is
  the anti-turtle pressure and it is mechanical, not advisory.
- **"Stand adjacent and tank"** — 3 HP against per-raider strikes makes bodyblocking a
  losing trade; knockout halves prestige, which at Rank 3+ can cascade a demotion.
- **"Grind Rank 5 and idle"** — decay at high prestige (−10%/turn) exceeds what quiet
  turns provide. Lordship is a treadmill by design.

## Tuning Notes

All first-guess numbers; tune by halve-and-double:

- Village growth 20%/turn, raider spawn 1%/farm/turn — these two set the world's tempo
  against each other; growth should visibly outpace raiding when the player defends well.
- Sated threshold 3 farms; raider speed die weights; attack cost 2 MP; player 3 HP.
- Village HP 3, regen 1/turn with ≥1 farm — together these set how long a rescue window
  stays open once a village is stripped.
- Prestige awards (1 / +2 / +2), decay divisor 10, promotion multiplier 3× — the 3×
  multiplier and the decay divisor together set how "bursty" promotion must be.
- Raiders have no population decay: in a fully neglected world (headless sim, passive
  player, 300 turns) about 80 accumulate on the board. The player's blade is the only
  cull. If that overwhelms real play, add a small per-turn decay chance for raiders far
  from any target (ecology over choreography), rather than a spawn cap.
