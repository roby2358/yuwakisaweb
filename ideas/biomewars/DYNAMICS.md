# Biome Wars — Dynamics

*A design journal: why this is fun first, what the rules are second.*

## Theme

An alien planet is at war with itself. The landscape is the combatant: living biomes
grind against each other hex by hex, and every front line is visible on the map. You are
one small hero **thriving in the cracks of that war** — tending a garden inside a
battlefield. The war never ends and cannot be won; the fun is growing anyway: putting
down roots, championing the settlements that shelter you, and striking back at the
blights that drive the enemy tide.

The emotional experience: *the ground itself is alive and taking sides, and my little
acts — gather, feed, cull, strike — visibly tilt it.*

## Key Drivers

1. **Accumulation & Windfall** — hero talents and settlement prosperity compound across
   a long-running, persistent world (the game saves every turn and resumes). Cleansing a
   blight is the earned explosion: a fat essence windfall and a whole front collapsing.
2. **Guardianship & Loss Aversion** — settlements are *named*, heal you, and catch you
   when you fall. They can be swallowed hex by hex while you watch. The defeat condition
   is **their** extinction, not yours.
3. **Variable Reinforcement on a Competence Backbone** — the biome war reshuffles the
   fronts every turn by simple pressure rules the player can read at a glance (vitality
   shading = front health) and deliberately tilt.

## Key Mechanics (one per driver)

1. **Thriving loop** — gather essence from the land (richer where it's hostile), then
   spend it on talents (yourself) or feed it to settlements (the world).
2. **Anchors** — settlements and blights are the *same aura engine* with opposite
   allegiance: each projects biome pressure scaled by its prosperity; you feed one kind
   and destroy the other.
3. **Biome pressure tick** — each turn every war-torn hex compares neighbor + aura
   pressure; a pressure deficit drains its vitality, and at zero the hex flips to the
   winning biome.

## Secondary Mechanics (each woven into a key mechanic, driver named)

- **Hazard biomes** — hostile biomes hurt you each turn you stand in them, but their
  essence yield is 2–4× the safe lands. *Weaves into: thriving loop. Driver: variable
  reinforcement (risk/reward), double-edged.*
- **Gathering drains the land and roots you** — a harvest costs the hex 40 vitality,
  making it easier to flip, and takes the rest of your turn, so you weather the hex's
  hazard where you harvest. Harvest enemy borderland and you're a saboteur paying in
  blood; harvest beside your own settlement and you're eating your ally. *Weaves into:
  pressure tick. Driver: readable consequences, double-edged.*
- **Creatures are bound to their biome** — wildlife never crosses a front line, so
  biome borders are visible safety lines and a moving front literally swallows the
  creatures on it. *Weaves into: pressure tick. Driver: readable consequences; rival
  constraint.*
- **Friendly wildlife heals** — grazers and drifters nuzzle +1 HP when adjacent, but can
  be hunted for essence. Kill your healers for a snack, or keep them alive. *Weaves
  into: thriving loop. Driver: guardianship vs. greed, double-edged.*
- **Siege** — any anchor standing on a foreign biome bleeds prosperity and dies at zero.
  One rule for both kinds: your settlements can be strangled, and a blight can be
  starved by flipping the land under it instead of storming it. *Weaves into: anchors.
  Driver: loss aversion; revenge (the front that took your town has a named source).*
- **Fall and rise** — at 0 HP you lose half your essence and wake at the strongest
  surviving settlement. No permadeath: this is a long game, and dying while there's
  still a hearth is a setback, not an ending. *Weaves into: anchors. Driver: loss
  aversion without despair.*
- **Golden age → eruption** — cleanse every blight and the settlements boom for 12
  turns; then the planet convulses and *more, stronger* blights erupt. Escalation is
  tied to your success, and the long game never runs dry. *Weaves into: anchors.
  Driver: escalating commitment; accumulation & windfall.*
- **Blights grow without limit** — +1 prosperity every turn, uncapped, and prosperity
  buys aura *reach*. An untended world measurably falls (first settlement lost around
  turn 130–170 in probes); cleansing blights is how the player resets the doom clock.
  Settlements self-grow only to 50 — beyond that, prosperity is the hero's gift alone.
  *Weaves into: anchors. Driver: escalating commitment (anti-turtle); the player is the
  difference between holding and losing.*
- **Sea and crag are neutral** — impassable, unconquerable firebreaks. Fronts pinch and
  stall at them; geography is strategy. *Weaves into: pressure tick. Driver: terrain as
  language.*

**Gut checks:** burning land burns you ✓; feeding a town makes it stronger ✓;
over-harvesting kills the land ✓; creatures never leave their biome (they *are* the
biome — stated in the intro) ✓; a besieged town starves rather than vanishing
instantly ✓.

## The World

Seven biomes. Two are neutral terrain; five are combatants.

| Biome | Feel | Move | Hazard/turn | Gather yield | Anchors | Creature |
|---|---|---|---|---|---|---|
| Sea | neutral firebreak | — | — | — | — | — |
| Crag | neutral firebreak | — | — | — | — | — |
| Verdant Meadow | lush, familiar | 1 | 0 | 2 | settlements | Puffgrazer (friendly) |
| Spore Forest | strange, livable | 2 | 0 | 3 | settlements | Spore Drifter (friendly) |
| Crystal Barrens | inhospitable | 2 | 1 | 4 | settlements | Shardling (hostile) |
| Ash Waste | hostile | 2 | 2 | 6 | blights | Cinder Hound (hostile) |
| The Writhe | strange *and* hostile | 3 | 3 | 9 | blights | Null Horror (hostile) |

Crystal is the deliberate middle case: settled, but the land nicks you and its wildlife
bites — inhospitable, not evil.

### Creatures

| Creature | HP | Dmg | Speed | Aggro | Essence | Behavior |
|---|---|---|---|---|---|---|
| Puffgrazer | 4 | — | 1 | — | 2 | wanders; +1 HP to adjacent hero |
| Spore Drifter | 4 | — | 1 | — | 3 | wanders; +1 HP to adjacent hero |
| Shardling | 5 | 2 | 1 | 3 | 4 | chases hero in-biome |
| Cinder Hound | 8 | 3 | 2 | 4 | 7 | fast chaser |
| Null Horror | 14 | 5 | 1 | 5 | 15 | slow, terrifying |

Ecology, not choreography: each warring biome rolls a 15% spawn chance per turn while
under its cap of 6, spawning at a random hex of that biome ≥3 from the hero. A creature
whose hex is flipped out from under it perishes with the front.

### Anchors

| | Settlement | Blight |
|---|---|---|
| Starting prosperity | 30 | 50 (+10 per eruption) |
| Growth | +1/turn if ≥60% of radius-2 land is home biome, self-capped at 50; +1 more in a golden age (cap 100); +5 (+2/Voice) per feed (cap 100) | +1/turn, **uncapped** |
| Aura | power = 1 + prosperity/20, pushes home biome, falloff −0.5 per hex (prosperity buys reach) | same |
| Dies by | siege (−3 prosperity/turn on foreign biome) → "has fallen" | siege ("starved out") or attack (25 HP, +10 per eruption) → +30 essence |
| Also | heals hero +5 when ending turn there; respawn point; feedable | named — a revenge target, not a swarm |

## The Hero

- 20 HP, 5 MP/turn, 3 attack damage, 0 essence at start. Starts at a Meadow settlement.
- **Actions** (all spend MP; hitting 0 MP auto-ends the turn):
  move (terrain cost) · gather (all remaining MP — ends the turn; hex vitality ≥40,
  drains 40) · attack (2 MP, adjacent creature or blight) · feed (1 MP, 10 essence →
  prosperity, on a settlement). Gathering roots you: one harvest per turn, and you eat
  the hex's hazard where you harvest — no grab-and-run out of the Writhe.
- **Talents** — one template: a passive stat bump, repeatable levels, cost =
  base × (level+1). No snowflake code paths. Talents are learned only while standing
  in a settlement — training is one more thing the towns provide, and one more reason
  to keep them alive (guardianship); a deep raid's haul isn't power until you make it
  home (loss aversion — dying out there costs half the essence you meant to train with).

| Talent | Effect/level | Base cost | Max |
|---|---|---|---|
| Vigor | +6 max HP | 20 | 5 |
| Strike | +2 attack damage | 20 | 5 |
| Fleet | +1 MP per turn | 30 | 3 |
| Harvest | +1 essence per gather | 15 | 5 |
| Warding | −1 biome hazard damage | 25 | 3 |
| Carapace | −1 creature damage taken | 25 | 3 |
| Voice | +2 prosperity per feed | 20 | 3 |
| Strider | move costs above 1 reduced by 1 | 60 | 1 |

Zeroing a shardling's bite with Carapace 2 is intentional — earned invulnerability to
the small stuff is a windfall, and horrors still hurt.

## Turn Loop (code-checked)

```
player phase: spend MP on move / gather / attack / feed (0 MP auto-ends)
world phase:
  1. hazard      — standing hex damages hero (hazard − Warding)
  2. creatures   — hostiles chase & bite (in-biome only); friendlies wander & nuzzle
  3. hero fall?  — respawn at strongest settlement (−½ essence) or defeat if none left
  4. spawns      — per-biome 15% under cap of 6
  5. anchors     — siege drain / growth / feed effects; deaths resolve here
  6. biome tick  — pressure = same-biome neighbors (+1 each) + anchor auras;
                   deficit → vitality −(deficit×8); at 0 flip (vitality 30);
                   surplus/parity → vitality +4 (cap 100)
  7. golden age  — countdown; at 0 the eruption spawns (2 + eruptions) blights,
                   each converting a radius-2 disk, HP/prosperity scaled up
  8. decay       — creatures stranded on foreign biome perish (eruptions included)
  9. rest        — hero on a settlement heals +5
save to localStorage; next turn
```

## Names

Every world names itself from the seed, via a syllable generator with a phoneme style
per biome culture (soft, fungal, crystalline, harsh, eldritch):

- **Settlements and blights** are always named (*Solmere*, *Kyrix*, *Kragmaw*) — a town
  you can mourn and a blight you can hunt. *Driver: guardianship; revenge (enemy
  identity).*
- **Creature species** are named per world; the archetype stays visible in the hover
  (*Vhorrek — null horror*). The same beast is never called the same thing twice across
  worlds. *Driver: variable reinforcement (each world feels newly discovered).*
- **Some biomes** — each warring biome has a 50% chance of a proper name (*Ysshara
  (spore forest)*); the rest, and the neutral sea/crag, keep plain descriptors. A world
  where only some places have earned names feels older than one where everything is
  labeled. *Driver: readable consequences (archetype always shown alongside).*

Generated names live in `GameState` (serialized with the save); the generator draws
from the seeded `Rando`, so a world's names reproduce from its seed.

## Map Generation

60×40 hexes, diamond-square elevation. Bottom 18% and all edges are Sea, top 6% is
Crag. Nine anchors (2 settlements × 3 settled biomes, 2 Ash + 1 Writhe blight) placed
≥8 apart; every warring hex takes the biome of its nearest anchor (jittered Voronoi),
vitality 40–80. The result: coherent homelands with ragged, contestable borders and
neutral firebreaks.

## Strategies

**Early (turns 1–20):** hug the Meadow. Gather safe hexes, buy Harvest/Vigor first,
learn where the fronts are, let grazers top you up. Cull the odd shardling for bonus
essence.

**Mid:** raid the Crystal/Ash border — triple yield pays for talents fast, and every
harvest there weakens the enemy front. Feed the settlement nearest the worst front to
crank its aura. Hunt cinder hounds before they hunt you.

**Late:** Warding + Strider + Vigor open deep raids into the Writhe. Assassinate
blights — storm them (attack) or strangle them (flip the land under them by feeding the
nearest settlement and harvesting the blight's borders). Then survive your own success:
each golden age ends in a bigger eruption.

**Recurring tensions (the decisions that never go away):**
- Essence on *me* (talents) or the *world* (feeding)?
- Gather **here** and weaken whoever owns this hex — friend or foe?
- Hunt the friendly healer for essence, or keep it alive?
- Raid deeper for rich essence, or bank what I have before something fast finds me?

**Anti-strategies (and the mechanic that punishes each):**
- *Turtle at home forever* → blight prosperity grows without limit and its aura's reach
  with it; probes show an untended world loses its first settlement by ~turn 150 and
  collapses by ~250.
- *Farm friendly wildlife* → spawn caps + low yields make it slow, and you're killing
  your own healers.
- *Talents-only, ignore the war* → settlements fall; fewer respawn/heal points; last
  one gone is defeat.
- *Rush a blight on day 1* → 25 HP at 3 damage is 9 attacks spent standing in
  hazard-2+ land among hounds: the math kills you. Come back stronger (near-miss by
  design).

## Deferred (deliberately not in this build)

- Enemy-phase animation (hop-by-hop, combat flashes) — resolve is instant + logged for now
- Fog of war / exploration reveal
- Per-biome essence types and trading between settlement cultures
- Ruins and re-founding fallen settlements
- Reputation per settlement culture
