# RADIO FREE SECTOR 9 — Game Dynamics

> *BITROT SOFTWORKS presents — an insurrection simulation for one player.*
> *Disk 1 of 2. © 1987. Do not copy this disk. The Ministry is watching.*

Why the game works. Rules are specified in [ONTOLOGY.md](ONTOLOGY.md). Numbers are named
here, never quoted; their values live in ONTOLOGY's Numbers table. Every number is **[T]**.

## Theme — the feeling

**Whispering into a sleeping city until it screams back.**

Sector 9 is gray. Its tenement blocks are full of people who have been sedated by forty
years of state broadcast. You are a pirate radio operator (`@`) with a backpack of
hand-built transmitters. Each one, planted in the right alley, wakes a few blocks. Woken
blocks talk to their neighbors. Talk spreads. For a long while it is furtive, fragile
work — and then one transmitter in the right place bridges two neighborhoods and the city
lights up magenta in a chain reaction you set up five turns ago.

The emotional arc is **patience under a tightening noose, tipping into euphoria.**

## Drivers

One driver is load-bearing and leaned on hard; two others are deliberately smaller and
exist only to feed it.

### CORE — Accumulation and Windfall (the Wake)

Everything that wins the game comes from the Wake cascade. Small, careful plants compound;
the payoff is a chain reaction that can wake a whole district over a few turns. The
player is not collecting loot or killing anything — they are **arranging tinder and
lighting it**. Victory is a global meter (`WIN_FRAC` of the city's blocks awake at once),
so the only way to win is to make the cascade do the work.

### Lesser 1 — Escalating Commitment (the Alert)

Every awake block raises the Ministry's Alert, and the Alert is the number of Sweepers on
the street. **Your own success summons the crackdown.** It feeds the core by forcing the
cascade to be *big and fast* rather than slow and safe: a timid, trickling Wake lets
Sweepers arrive in proportion and grind it down; a bold one outruns them.

### Lesser 2 — Loss Aversion with Guardianship (the Rigs)

You own `RIG_COUNT` transmitters for the whole game, each with a call sign (KILO-9, NOVA
FM, ECHO BASE, VOLTAGE, ZERO HOUR). Sweepers smash them, permanently. Losing the last
one ends the game. It feeds the core because **every rig is the seed of a cascade** — the
question is never "where do I get more" but "where does *this one* do the most good,
and can I keep it alive long enough to matter?"

Supporting drivers that fall out of the above without their own mechanics: **readable
consequences** (the Wake rule is visible and deterministic), **near-miss architecture**
(the Alert ramps exactly as you approach `WIN_FRAC`), **comedy** (a Sweeper wading through
an awake crowd so slowly that the block it just jammed wakes back up behind it).

## Key mechanics — one sentence each

| Driver | Mechanic |
|---|---|
| CORE Accumulation & Windfall | **The Wake:** at each broadcast, a sleeping block wakes if it's in range of a live transmitter, or if at least `WAKE_THRESHOLD` of its neighbors are awake. |
| Lesser 1 Escalating Commitment | **The Alert:** the Ministry wants `BASE_SWEEPERS + floor(awake / AWAKE_PER_SWEEPER)` Sweepers on the street, spawning up to `SPAWN_PER_TURN` a turn at its stations and recalling `RECALL_PER_TURN` when over quota. |
| Lesser 2 Loss Aversion | **The Rigs:** you have `RIG_COUNT` named transmitters, planted or retrieved for `PLANT_MP`; a Sweeper that steps on one smashes it forever, and losing them all loses the game. |

## Secondary mechanics, woven in

Each one names the key mechanic it makes more interesting. None stands alone.

- **Terrain as language (→ the Wake).** Only `BLOCK` hexes (tenements) can wake. Plazas,
  factories, ruins, canals and arcologies are firebreaks. The map is a percolation puzzle:
  blocks clump into neighborhoods with gaps between them, and a one-hex-wide street of
  blocks *doesn't* carry the Wake (each hex has only one awake neighbor — fewer than
  `WAKE_THRESHOLD`). The player reads the city as tinder and firebreaks.
- **Range growth (→ the Rigs, → the Wake).** A rig starts at `TX_RANGE` and reaches one hex
  farther for every broadcast it makes, up to `TX_RANGE_MAX`. One more turn on air reaches
  across one more firebreak — and gives a Hound one more turn to arrive. This is what
  makes "how long do I leave it?" a real decision instead of "always pull at once."
- **Fading (→ the Wake, → the Rigs).** At each broadcast, an awake block with fewer than
  `FADE_THRESHOLD` awake neighbors drifts back to sleep, unless a live rig's range covers
  it. Solid districts hold themselves up; the ragged edges of a rig's patch stay awake only
  while it broadcasts. Pulling a rig is never free: hover it to see what would fade.
- **Jamming (→ the Wake, ← the Alert).** Nothing within `JAM_RADIUS` of a Sweeper can
  wake, and a transmitter there goes silent. The block a Sweeper stands on falls asleep.
  A Sweeper is a moving checkpoint: it can't un-wake a district, but parked on the
  frontier it stops the Wake cold. Because the Wake heals (the hole under a Sweeper
  re-wakes once it moves on), Sweepers matter at **chokepoints** — and Wardens seek the
  frontier, which is where chokepoints are. `TX_RANGE` > `JAM_RADIUS`, so a rig planted
  just outside a checkpoint's reach can still bridge past it.
- **Crowds (→ the Rigs, → the Wake).** Awake blocks cost Sweepers `AWAKE_DRAG` extra MP to
  enter — citizens in the street. A transmitter deep inside an awake district is hard to
  reach. The cascade protects its own seeds: compounding.
- **Shelter (→ capture, ← the Wake).** A Sweeper sees you only within `SWEEPER_SIGHT` and
  only if you are *not* standing on an awake block. The woken city hides you. Same hex,
  two meanings (asymmetry): awake blocks are cover and open road for you, mud and
  blindness for them.
- **Sweeper kinds (→ the Alert, → the Rigs).** Each Sweeper rolls a kind at spawn
  (`SWEEPER_KINDS`, one d6): slow **Wardens** go for the nearest frontier block (a
  sleeping block touching an awake one); faster
  **Hounds** and rare, very fast **Hunters** go for the nearest transmitter. Their MP is
  printed on the counter like an old wargame movement factor, so a `6` coming over the
  canal reads as dread at a glance (variable speed creates dread).
- **Capture (→ the Alert).** A Sweeper whose walk enters your hex captures you. That's an
  event in the regime phase, not an end-of-turn check — you watch it come.
- **Stations (→ the Alert).** The Ministry (far right) and `PRECINCT_COUNT` precincts
  (right half) are where Sweepers appear. The left of the map is quiet early; the right
  is the final push.

## Gut check

- *Woken people wake their neighbors.* Intuitive: rumor and riot spread by contact.
- *A crowd slows the police and hides the fugitive.* Intuitive.
- *A one-wide alley doesn't carry it, but two-wide streets do.* Slightly surprising, but
  it's visible the very first time: the line just stops. The highlight preview (blocks a
  plant would wake) and the frontier glow make it readable rather than a bug.
- *More awake blocks → more police.* Intuitive; the HUD shows the Alert climbing in
  lockstep with the awake count.
- *A jammed hole fills back in.* Intuitive (a crowd closes behind a patrol) and it's the
  seed of the comedy beat.
- *A signal reaches farther the longer it runs.* Intuitive enough (word gets around); the
  dashed range ring visibly widens each turn.
- *An isolated pocket of unrest dies out unless the radio keeps it going.* Intuitive, and
  it's the wake rule in reverse, so nothing new to learn.

## Code check — each mechanic is ≤5 lines of pseudocode

```
WAKE:     jam = hexes within JAM_RADIUS of a Sweeper; live = rigs not in jam
          wake = sleeping BLOCKs with (live rig within its range) or (≥ WAKE_THRESHOLD awake nbrs)
          for h in wake - jam: h.awake = true          # synchronous: one ring per turn
FADE:     awake BLOCKs outside every live rig's range with < FADE_THRESHOLD awake nbrs → asleep
GROW:     range = min(TX_RANGE + airtime, TX_RANGE_MAX); live rig: airtime += 1; plant/retrieve: 0
ALERT:    quota = BASE_SWEEPERS + floor(awakeCount / AWAKE_PER_SWEEPER)
          over quota: recall RECALL_PER_TURN (latest first, never one chasing @)
          under: repeat min(SPAWN_PER_TURN, quota - sweepers): spawn at a station
RIGS:     plant: mp ≥ PLANT_MP, carrying > 0, no rig here → rig.at = here; mp -= PLANT_MP
          sweeper enters a rig's hex → rig.smashed = true; if all smashed → lost
SEDATE:   after the regime moves, the block under each Sweeper → asleep
SHELTER:  visible = dist(sweeper, @) ≤ SWEEPER_SIGHT and not (@ on awake BLOCK)
```

## Turn structure

1. **Player turn.** Spend `PLAYER_MP` on moves, plants and retrievals. Ends at 0 MP or End
   Turn.
2. **Broadcast.** The Wake and fade rules run once, together; live rigs grow. If awake ≥
   `WIN_FRAC` × blocks, you win.
3. **Regime.** Each Sweeper picks (or keeps) a target and walks its path; entering a rig
   smashes it, entering you captures you. Then sedation. Then the Alert recalls or
   spawns.

## Victory and defeat

- **Win — THE CITY WAKES:** awake blocks ≥ `WIN_FRAC` of all blocks after a broadcast.
- **Lose — CAPTURED:** a Sweeper enters your hex.
- **Lose — DEAD AIR:** your last transmitter is smashed.

## Strategies

### Early (turns 1–~8): kindling
Few Sweepers, all spawning far right. Walk into the nearest big neighborhood and plant two
rigs at points where `TX_RANGE` touches the most blocks *and* the most frontier. Don't
wake too much too fast near a precinct.

### Mid: bridges, and when to pull
The left neighborhoods are lit; the Alert is climbing. The best plant now is a **bridge**:
a rig in a firebreak gap whose range reaches blocks on the far side, letting the Wake jump
into a new neighborhood. One broadcast lights its first ring; every turn after reaches a
hex farther and holds up the patch's ragged edges. So each turn you read the dashed rings
and the Hounds' target lines: **strike and pull** (keep the rig, accept the fade), or
**let it ride** one more turn for the far gap. A rig left too long is a rig waiting to be
smashed.

### Late: the push
You need the big neighborhoods near the Ministry. Sweepers are many and fast. Plant deep
inside awake crowds where Sweepers wade slowly, travel on awake blocks where they can't
see you, and accept that some rigs will be smashed. The last few percent are a race
between your bridges and their Wardens choking the frontier.

### Recurring tensions
- **Wake fast vs. wake safe.** Each awake block summons a fraction of a Sweeper.
- **Leave a rig vs. carry it.** A planted rig reaches farther every turn and holds its
  patch's edges awake, and it's a target; a carried rig is safe, does nothing, and its
  patch starts to fray.
- **Shelter vs. reach.** Awake ground hides you, but the next bridge is in the gray.
- **Hunters vs. Wardens.** Protecting rigs from Hounds means pulling them out of the
  frontier, which is exactly where Wardens are grinding the Wake down.

### Anti-strategies

| Anti-strategy | Prevention |
|---|---|
| Plant every rig in one cluster and wait for it to win alone | Single neighborhoods are smaller than `WIN_FRAC` even with a rig grown to `TX_RANGE_MAX` (map generation tuned — see the Wake measurement in RATIONALE); bridges are required |
| Park every rig forever and let them grow | `TX_RANGE_MAX` caps the reach; Hounds and Hunters target planted rigs, and the longer one sits the more of them find it |
| Wake a little and turtle forever | Turtling can't win: once a neighborhood is full nothing grows without new plants, and Wardens park on its frontier. There's no timer, so it doesn't *lose* either — it just stalls (see Q-1 in RATIONALE) |
| Stand on your own transmitter to guard it | Sweepers that enter the rig's hex enter yours too: that's a capture |
| Hide on awake blocks forever | Hiding blocks *sight*, not *movement*: a Sweeper whose path crosses your hex still captures you, and Hounds path straight to rigs you stand near |
| Plant in a one-wide alley to "wire" the city | One-wide lines carry nothing (`WAKE_THRESHOLD`), and fade once the rig is gone (`FADE_THRESHOLD`) |
| Retrieve and replant the same rig every turn to "pulse" a region | A rig wakes only on broadcast, plant + retrieve cost 2 × `PLANT_MP`, and retrieving resets its range to `TX_RANGE`: pulsing spends the whole turn for the smallest ring |
| Run in front of Sweepers to lure them | Allowed and intended (a real cost: you're visible and they're fast) |

### Strategy ↔ mechanic cross-check

| Mechanic | Used by |
|---|---|
| Wake (rig range) | kindling, bridges |
| Range growth | when-to-pull, leave-vs-carry tension, park-forever anti-strategy |
| Fading | when-to-pull (the cost of pulling), alley anti-strategy |
| Wake (threshold spread) | every phase; the windfall |
| Terrain firebreaks | bridges, one-wide alley anti-strategy |
| Alert quota (spawn and recall) | wake-fast-vs-safe tension, late push |
| Station placement | early kindling far from precincts |
| Rigs finite / smashed | leave-vs-carry tension, Dead Air loss |
| Plant / retrieve cost | bridges (retrieve and carry forward), pulsing anti-strategy |
| Jamming / sedation | Wardens choking the frontier, bridging past checkpoints, the comedy beat |
| Crowds (`AWAKE_DRAG`) | late push (plant deep) |
| Shelter (`SWEEPER_SIGHT`) | late push (travel on awake blocks), hide anti-strategy |
| Sweeper kinds | Hunters-vs-Wardens tension |
| Capture | guard-the-rig anti-strategy, lure strategy |

Every mechanic is used by some strategy, and every strategy uses only mechanics above.

## The floppy-disk feel

Not a mechanic, but the presentation is part of the theme: a 1987 MS-DOS release.
EGA 16-color palette (gray sleeping tenements, **magenta** awake blocks, cyan rigs, red
Sweepers), a VT323 terminal font, CRT scanlines, a disk-loading boot screen with drive
chatter, a cheeky copy-protection check, PC-speaker bleeps, and DOS box-drawing panels.
The player is `@`, because of course it is.
