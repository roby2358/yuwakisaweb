# DYNAMICS.md — King of Mariguez

## Theme

**Two unlikely companions pushing deeper into hostile wilderness, where every treasure claimed reshapes the journey but draws deadlier attention.**

---

## Core Loop (one turn)

```
1. Player spends MP moving Hecto and/or Evascor (shared pool of 5)
   - When Hecto enters a scroll hex, auto-pickup: reveal one hidden artifact location
2. Player activates artifact abilities (costs MP or free)
3. Player clicks End Turn (or runs out of MP)
4. Claim check: if Hecto is on an artifact hex (revealed OR hidden) and conditions met, claim it. Hidden claims don't alert Jhirle.
5. Combat: Evascor auto-kills up to [routine] adjacent enemies. Overflow stuns him.
6. Death check: if monster adjacent to Hecto and Hecto > 3 hexes from Evascor, Hecto dies → game over
7. Enemy phase: spawn new monsters, move existing monsters 1 hex toward nearest player unit
8. Jhirle phase: move Jhirle toward nearest *revealed* unclaimed artifact (she only knows what Hecto has revealed, with 1-turn delay). She won't enter Evascor's hex.
9. Jhirle claim: if Jhirle is on an artifact hex, she takes it (removed from map)
10. Decrement cooldowns. Increment turn counter. Reset MP to 5.
```

Everything below must fit inside this loop.

---

## Units

**Hecto** (yellow counter, "H")
- Movement cost = terrain cost (plains 1, forest 2, hills 2, quarry 2)
- Cannot enter water or mountain
- Dies if adjacent to a monster and more than 3 hexes from Evascor at step 6
- Only unit that can **read scrolls** (auto-pickup on entering a scroll hex, no MP cost)
- Only unit that can claim artifacts (must be on a *revealed* artifact hex)

**Evascor** (gray counter, "E")
- Movement cost = 1 per hex regardless of terrain
- Cannot enter water
- CAN enter mountain at cost 2
- Has a **routine** rating (starts at 3). At step 5, kills up to [routine] adjacent enemies automatically
- If adjacent enemies > routine, Evascor takes a **stun** (skip next turn). 3 stuns total = game over
- Heals at quarry hexes (clears stun, resets routine to base)

**Jhirle** (purple counter, "J")
- Appears on a random map edge the turn after the player claims artifact #1
- **She can't read scrolls** — just like the story, she needs Hecto. She only learns about artifact locations that Hecto has revealed via scrolls. Every scroll Hecto reads is information she gains too (she's watching). She learns the location **1 turn after** Hecto reveals it (the delay represents her spying and catching up to the information). When she first spawns, she immediately inherits ALL currently revealed artifact locations (she's been watching since before she appeared).
- Has **4 movement points** per turn. Uses BFS pathfinding through terrain — water and mountains block her, forests cost her extra.
- **Cannot move within 2 hexes of any monster.** She fears the Wilds. This means the player's monster cloud acts as a natural barrier — if monsters sit between Jhirle and an artifact, she has to detour. Players can use Evascor to herd monsters into blocking positions, or simply let the natural spawn pattern slow her down.
- She commits to one target at a time. She switches targets when: (a) her current one is claimed by player or by her, (b) a closer revealed artifact appears, or (c) she's made no progress toward her target for 3 consecutive turns (blocked by Evascor or terrain). On retarget from blocking, she picks the next nearest revealed unclaimed artifact.
- Cannot be attacked or killed. But she CAN be blocked — she won't enter a hex occupied by Evascor. (Hecto can't stop her, but Evascor's massive frame in a doorway is another matter.) This gives the player one piece of counterplay: park Evascor on a chokepoint to slow her down, at the cost of splitting the pair.
- If she reaches an artifact hex, that artifact is removed from the game.
- **After claiming 4 artifacts, she must return to a city** on the eastern border to win. If she reaches a city with 4 artifacts → game over.

**Why this is fair:** Jhirle only competes for artifacts you've already found. Revealing an artifact starts a race. This means scroll order matters — reveal artifacts near you first, and you'll claim them before she arrives. Reveal a distant artifact and she might beat you there. The 1-turn delay gives Hecto a head start. Her terrain pathing means map layout creates natural chokepoints and detours. Evascor-blocking gives active counterplay at a real cost. The monster avoidance rule means the player's own monster problem becomes Jhirle's obstacle too — a rare case where the enemy of your enemy is also the enemy of your enemy's enemy. And the return-to-city requirement means she can't just grab and vanish; the player can try to intercept her on the way back.

**Monsters** (red counters)
- Spawn 3-12 hexes from Hecto. Count per turn = (artifacts claimed + 1), 20% chance each
- Move 1 hex per turn toward nearest target: Hecto, Evascor, or Jhirle (whichever is closest). If Hecto is on forest, monsters ignore him and path toward Evascor or Jhirle instead.
- Decay: 20% chance to vanish each turn if >5 hexes from all player units
- Hesitate: 50% chance to skip movement when within 3 hexes of Evascor (they fear him)
- Killed by Evascor's routine (adjacent, automatic) or by artifact effects
- No HP — they either die or they don't

---

## Scrolls

Hecto is a scholar of ancient Mariguez texts. Scrolls are the information layer of the game — they bridge exploration and artifact claiming.

**Placement:** 10 scrolls scattered on passable hexes across the map (visible from the start, shown as a scroll icon or "S" marker). Minimum 5 hexes apart from each other.

**Pickup:** When Hecto enters a scroll hex, it's automatically consumed (no MP cost beyond the movement). The scroll reveals the location of one hidden artifact — the nearest unrevealed artifact to the scroll's position is marked on the map. A brief text flash names the artifact and its power so the player can prioritize.

**Why 10 scrolls for 7 artifacts?** Redundancy. Some scrolls will reveal artifacts that are already revealed (if the player found a closer scroll first). This means not every scroll is useful — some detours are wasted. The player has to judge: is that scroll worth the MP to reach, or should I push toward an artifact I already know about? Also, some scrolls will point to artifacts Jhirle has already taken. The scroll itself is never wasted information — even confirming "that artifact is gone" has value.

**Implementation:**
```
on Hecto enters scroll hex:
  remove scroll from map
  find nearest artifact where revealed == false
  if found:
    set artifact.revealed = true
    show artifact on map with its name and icon
    flash notification: "Scroll reveals: [Artifact Name] — [one-line power description]"
  else:
    flash notification: "The scroll's text is faded beyond reading" (all artifacts already revealed)
```

**Jhirle and scrolls:** Jhirle can't read ancient Mariguez script — in the story, she specifically needs Hecto to decipher them. Every scroll Hecto reads reveals an artifact to *both* of them (she's watching). She learns the location 1 turn after Hecto does. This makes scroll pickup a double-edged decision: you need the information, but so does your rival. The strategic question becomes *which* scrolls to read and *when* — reveal an artifact near you for an easy grab, or hold off on a distant scroll so Jhirle can't race you to it.

---

## The Seer's Visions

In the stories, the Seer gives Hecto cryptic clues like "pool, waterfall, beam of light" or "white dress, brown cloth, cold stone." They sound like nonsense, but Hecto puzzles them out and they lead to treasure. Visions are the **stealth path** to artifacts — they don't alert Jhirle.

**At game start**, the Seer provides 3 visions. Each vision is a terrain-based clue describing the neighborhood around a hidden artifact. The visions are displayed in the HUD as cryptic text for the entire game.

**Clue generation** (at map setup):
```
for 3 random hidden artifacts:
  get the 6 neighbor hexes of the artifact
  pick 2-3 terrain types present in the neighbors
  generate a short phrase from a template

templates:
  "Where [terrain] meets [terrain]"
  "Between [terrain] and [terrain], beside [terrain]"
  "[terrain] on two sides, [terrain] nearby"
  "Surrounded by [terrain], touched by [terrain]"

terrain words:
  water  → "dark water", "deep water", "rushing water"
  plains → "open ground", "green fields", "flat earth"
  forest → "tall trees", "deep shade", "green canopy"
  hills  → "rising ground", "stony slopes", "high earth"
  mountain → "cold stone", "gray peaks", "impassable rock"
  quarry → "broken stone", "golden earth", "carved rock"
```

**Example visions:**
- "Where cold stone meets deep shade" → artifact hex neighbors include mountain and forest
- "Open ground on two sides, touched by dark water" → artifact flanked by plains with water nearby
- "Between rising ground and golden earth" → artifact between hills and quarry

**How the player uses them:** The visions sit in the HUD. The player scans the visible map, looking for terrain patterns that match a clue. When they think they've found the right spot, they walk Hecto there. If they're right, they find the artifact.

**Hidden artifact discovery:** Hecto can claim a hidden (unrevealed) artifact if he steps on its hex — he doesn't strictly need a scroll. The difference:
- **Scroll reveal:** Exact location marked on map. Jhirle learns it 1 turn later. Safe but shared.
- **Vision find:** No map marker. Player interprets the clue and walks there blind. If correct, Hecto discovers and can claim the artifact. **Jhirle never learns about it** (no scroll was read). Risky but secret.

This creates two discovery strategies:
1. **Scrolls** — reliable, exact, but alerts Jhirle. Good for nearby artifacts you can grab first.
2. **Visions** — cryptic, requires map reading, but Jhirle stays in the dark. Good for distant or contested artifacts.

**Implementation:**
```
// At game start, generate 3 visions
visions = []
for artifact in random_sample(artifacts, 3):
  neighbors = hexNeighbors(artifact.q, artifact.r)
  terrains = unique terrain types in neighbors
  phrase = pick_template(terrains)
  visions.push({ text: phrase, artifactId: artifact.id })

// When Hecto enters any artifact hex (revealed or not):
if hex has unclaimed artifact AND hecto + evascor within 3:
  show claim prompt (costs 2 MP)
  // if artifact was hidden (not scroll-revealed), Jhirle does NOT learn about it
```

**Fairness:** Visions might match multiple spots on the map (two places where forest meets water). The player might waste MP walking to the wrong one. That's the cost of secrecy — scrolls are exact but shared, visions are vague but private. The 3-vision limit means only some artifacts have this stealth path. The rest must be found by scrolls, which means Jhirle will eventually learn about them.

**Not every vision needs to be used.** Some players will ignore them and rely on scrolls. Others will study the map and try to crack them early for a Jhirle-free claim. Both strategies are viable.

---

## Terrain

Uses the existing terrain generation. Costs are for Hecto only (Evascor always pays 1, except mountain = 2).

| Terrain | Hecto Cost | Evascor Cost | Special |
|---|---|---|---|
| Plains | 1 | 1 | None |
| Forest | 2 | 1 | Monsters don't path toward Hecto here (they path toward Evascor instead) |
| Hills | 2 | 1 | None |
| Water | impassable | impassable | Barrier |
| Mountain | impassable | 2 | Only Evascor can cross |
| Quarry | 2 | 1 | Evascor heals (clear stun, reset routine) when ending turn here |

Forest hiding rule implementation: when computing monster pathfinding target, if Hecto is on forest, monsters use Evascor's position as target instead. Simple conditional in the pathfinding target selection.

---

## Artifacts

### Placement
Each game places 7 artifacts on passable, non-edge hexes spread across the map (minimum 8 hexes apart). Drawn randomly from the pool of 20. **Artifacts are hidden until revealed by scrolls** — they exist on the map but aren't shown to the player. Jhirle knows where they all are from the start.

### Claiming
Artifact must be **revealed** (by scroll). Hecto must be on the artifact hex. Both Hecto and Evascor must be within 3 hexes of each other. Costs 2 MP. That's it — one claiming rule for all artifacts.

### Carrying
Max 3 artifacts. If claiming a 4th, player picks one to drop (it's gone).

### Artifact Effect Templates

Every artifact fits one of these 4 code templates. The templates define the UI interaction and the effect application. Individual artifacts are just parameter sets.

**Template A — Passive.**
Always active while carried. No button, no activation. Just a modifier to an existing game value.
```
{ type: "passive", stat: "routine", modifier: +1 }
{ type: "passive", stat: "hecto_vision", modifier: +3 }
```

**Template B — Activated (self/global).**
Player clicks the artifact button in the HUD. Effect applies immediately. Goes on cooldown.
```
{ type: "activated", cooldown: 4, effect: "routine_boost", value: 2, duration: 1 }
{ type: "activated", cooldown: 3, effect: "hecto_terrain_ignore", duration: 1 }
```

**Template C — Activated (targeted hex).**
Player clicks artifact button, then clicks a hex on the map. Effect applies to that hex or units near it. Goes on cooldown.
```
{ type: "targeted", cooldown: 4, range: 3, effect: "kill_enemy_at_hex" }
{ type: "targeted", cooldown: 5, range: 4, effect: "grow_forest" }
```

**Template D — One use.**
Same as B or C, but artifact is removed from inventory after use.
```
{ type: "one_use", effect: "teleport_hecto_to_hex", range: 6 }
{ type: "one_use", effect: "gain_mp", value: 5 }
```

### The 20 Artifacts

**Mobility**

| # | Name | Template | Effect | Params | Driver |
|---|---|---|---|---|---|
| 1 | Wind Striders | B | All Hecto movement costs 1 this turn | cooldown 3, duration 1 | Scarcity |
| 2 | Blink Shard | C | Teleport Hecto to target hex (must be within 4 of Evascor, revealed, passable) | cooldown 4, range 4 | Guardianship |
| 3 | Tide Charm | C | Convert target water hex to plains permanently | cooldown 0 (unlimited), range 3 | Accumulation |
| 4 | Tremor Stone | C | Move Evascor to target hex ignoring terrain (must be within 3) | cooldown 4, range 3 | Scarcity |

**Combat**

| # | Name | Template | Effect | Params | Driver |
|---|---|---|---|---|---|
| 5 | Gauntlet of Ruin | C | Kill one enemy on target hex (within range of Evascor) | cooldown 4, range 2 | Scarcity |
| 6 | Bellowing Horn | B | Push all enemies adjacent to Evascor 2 hexes away | cooldown 3 | Guardianship |
| 7 | Ember Rod | D (one use) | Kill all enemies within 2 hexes of Evascor | — | Windfall |
| 8 | Puppeteer's Thread | C | Target enemy attacks its own adjacent allies this turn | cooldown 5, range 3 | Comedy |

**Scouting**

| # | Name | Template | Effect | Params | Driver |
|---|---|---|---|---|---|
| 9 | Prism of Far Light | B | Reveal all hexes within 8 of Hecto until next turn | cooldown 3 | Accumulation |
| 10 | Danger Sense Amulet | A (passive) | Spawn hexes for next turn are highlighted on the map | — | Readable Consequences |
| 11 | Whispering Veil | B | Reveal Jhirle's target artifact (highlight path) until she claims or retargets | cooldown 5 | Scarcity |

**Survival**

| # | Name | Template | Effect | Params | Driver |
|---|---|---|---|---|---|
| 12 | Cloak of Fading | B | Monsters ignore Hecto for 2 turns (he's invisible) | cooldown 6, duration 2 | Guardianship |
| 13 | Stoneblood Elixir | B | Hecto can't die this turn but can't move | cooldown 4, duration 1 | Loss Aversion |
| 14 | Iron Skull Helm | A (passive) | First stun each game is negated (one-time shield) | — | Guardianship |
| 15 | Blazing Mantle | B | Evascor routine +2 this turn | cooldown 4, duration 1 | Guardianship |

**Terrain Control**

| # | Name | Template | Effect | Params | Driver |
|---|---|---|---|---|---|
| 16 | Thornbark Seed | C | Target hex and its 2 nearest passable neighbors become forest | cooldown 5, range 4 | Guardianship |
| 17 | Lodestone | B | All enemies within 3 of Evascor move 1 hex toward Evascor | cooldown 3 | Scarcity |
| 18 | Dusk Lantern | B | All monsters skip movement next turn | cooldown 5 | Scarcity |

**Wildcards**

| # | Name | Template | Effect | Params | Driver |
|---|---|---|---|---|---|
| 19 | Mirror of Echoes | D (one use) | Place a decoy counter on target hex. Monsters path to it for 3 turns. | range: any revealed hex | Comedy |
| 20 | Quicksilver Flask | D (one use) | Gain 5 bonus MP this turn | — | Windfall |

### Implementation: Effect Functions

Each unique effect string maps to one function. Total unique effect functions needed: **16**.

```
hecto_move_cost_1        — override Hecto terrain cost to 1 for N turns
teleport_hecto           — move Hecto to target hex (validate: passable, within range of Evascor)
convert_water_to_plains  — change hex terrain type
move_evascor_to_hex      — move Evascor to target hex (validate: within range, passable for Evascor)
kill_enemy_at_hex        — remove enemy at target hex
push_adjacent_enemies    — move all enemies adjacent to Evascor 2 hexes away (away = opposite direction from Evascor)
kill_enemies_in_radius   — remove all enemies within N hexes of Evascor
enemy_attacks_allies     — target enemy damages adjacent enemies (kill them)
reveal_hexes_radius      — mark hexes as revealed in radius around Hecto
show_spawn_hexes         — highlight next turn's spawn locations (computed at turn end, displayed)
show_jhirle_target       — highlight Jhirle's pathfind target and path
hecto_invisible          — set flag; monster pathfind skips Hecto for N turns
hecto_invulnerable       — set flag; death check skips Hecto for N turns (but freeze movement)
routine_boost            — temporarily increase routine by N
grow_forest              — change target hex + neighbors to forest terrain
enemies_skip_movement    — set flag; enemy movement phase skipped next turn
pull_enemies_toward      — move enemies within radius 1 hex toward Evascor
place_decoy              — add a decoy counter; monsters pathfind to it for N turns
gain_bonus_mp            — add N to current MP
negate_stun              — one-time: when stun would apply, cancel it and remove this passive
```

That's 20 functions, some trivially similar (kill_enemy_at_hex and kill_enemies_in_radius differ only in targeting). Several share the pattern "set a flag, check it during the relevant phase, decrement duration."

---

## Win / Lose Conditions

**Win:** Claim 3 artifacts AND move Hecto to any city hex on the eastern border with Evascor within 3 hexes.

**Lose:**
- Hecto killed (monster adjacent + tether broken)
- Evascor destroyed (3 total stuns)
- Jhirle returns to a city with 4 claimed artifacts

**Cities:** 3 cities on the eastern border. No mountains or water within 3 columns of the eastern edge (hills/plains instead). Hecto and Evascor start adjacent to a random city.

Implementation: check at step 6 (Hecto death), step 5 (Evascor stun count), step 9 (Jhirle claim + city arrival). Win check after step 3: if player has 3 artifacts, Hecto is on a city hex, and Evascor is within 3 of Hecto.

---

## Escalation

| Artifacts Claimed | Spawns/Turn | Jhirle | Feel |
|---|---|---|---|
| 0 | 1 | not present | Scroll hunting. Reveal artifacts safely — Jhirle isn't here yet. |
| 1 | 2 | 4 MP/turn | Every new scroll is now a shared secret. Choose carefully. |
| 2 | 3 | 4 MP/turn | Swarming. Jhirle closing in. Must commit to final target. |
| 3 | 4 | 4 MP/turn | Sprint back to city. Everything is closing in. |

Target game length: 25-35 turns.

---

## State Model

```javascript
gameState = {
  turn: Number,
  mp: Number,                          // current MP (resets to 5)
  bonusMp: Number,                     // from Quicksilver Flask etc, added to mp

  hecto: { q, r },
  evascor: { q, r, stunned: Boolean, stunCount: Number, routineBase: Number },

  scrolls: [                             // on map, visible from start
    { q, r }
  ],
  artifacts: [                          // on map, unclaimed. hidden until revealed by scroll or walked on
    { q, r, id: Number, revealed: Boolean }
  ],
  visions: [                            // generated at start, displayed in HUD
    { text: String, artifactId: Number }
  ],
  inventory: [                          // carried, max 3
    { id: Number, cooldownRemaining: Number, spent: Boolean }
  ],

  jhirle: { q, r, speed: Number, target: hexKey | null, stalledTurns: Number } | null,
  jhirleKnown: Set<artifactId>,         // artifacts Jhirle knows about (added 1 turn after reveal)
  jhirlePending: [artifactId],           // revealed this turn, Jhirle learns next turn
  jhirleClaimCount: Number,

  enemies: [ { q, r, id: Number } ],
  decoy: { q, r, turnsLeft: Number } | null,

  // temporary flags (decremented each turn)
  flags: {
    hectoInvisible: Number,            // turns remaining
    hectoInvulnerable: Number,
    hectoTerrainCostOne: Number,
    routineBoost: Number,
    enemiesSkipMovement: Boolean,
    negateNextStun: Boolean,           // from Iron Skull Helm
    showSpawnHexes: Boolean,           // from Danger Sense Amulet
  },

  hexes: Map<hexKey, hex>,             // existing hex map
  gameOver: false | "win" | "hecto_died" | "evascor_destroyed" | "jhirle_won"
}
```

---

## UI Requirements

The existing HUD (top-left panel) expands to show:

```
Turn 12          MP: 3/5
[H] Hecto        [E] Evascor (Routine: 3)
                  Stuns: 1/3

Artifacts: [Wind Striders ⏳2] [Ember Rod 🔥] [_empty_]

Seer's Visions:
  "Where cold stone meets deep shade"
  "Open ground on two sides, touched by dark water"
  "Between rising ground and golden earth"

[End Turn]  [New Game]
```

- Clicking an artifact button activates it (if off cooldown and MP available)
- If artifact is targeted (template C), next hex click applies the effect instead of moving
- Cooldown shown as number. "🔥" or similar marker for one-use. Grayed out when on cooldown.
- Artifact pickup: when Hecto steps on an artifact hex and both are within 3, show a modal: "Claim [Artifact Name]? (2 MP)" with yes/no. If inventory full, show "Drop which?" picker.

Hex highlights:
- Yellow: reachable hexes for selected unit (existing)
- Red: enemies
- Tan/parchment: scroll locations (visible from start, "S" marker or scroll icon)
- Blue: revealed artifact locations (hidden until scroll pickup)
- Purple: Jhirle
- Orange: artifact target hex (when using a targeted ability)

Scroll notification: when Hecto picks up a scroll, a brief text overlay appears (e.g., "Ancient scroll reveals: **Bellowing Horn** — push all adjacent enemies away") and the newly revealed artifact hex pulses blue for a moment. If the scroll reveals nothing (all artifacts already revealed), show: "The scroll's text is faded beyond reading."

---

## What's NOT In Scope

These were in earlier drafts but are cut for implementability:

- ~~Fog of war~~ — Full map and terrain visibility. Scrolls replace fog: artifacts are hidden until a scroll reveals them. This gives the exploration feel of fog without the rendering cost.
- ~~Guardian types~~ — All artifacts use the same claim rule (Hecto on hex, Evascor within 3, 2 MP). One code path, not five.
- ~~Artifact interactions / combos~~ — Artifacts work independently. If two happen to combine well, great, but no special combo code.
- ~~Grawf as a unit~~ — Two player units is enough. The Seer is present as the vision mechanic, not a map unit.
- ~~Per-artifact carry decisions mid-combat~~ — Drop choice only happens at claim time, not in combat.

---

## Implementation Order

1. **Two-unit movement.** Shared MP pool. Click to select Hecto or Evascor, click hex to move. Both draw from same MP.
2. **Scrolls + hidden artifacts.** Place 10 scrolls (visible) and 7 artifacts (hidden). Hecto auto-picks up scrolls, revealing nearest artifact.
3. **Seer's visions.** Generate 3 terrain clues at start. Display in HUD. Allow claiming hidden artifacts when Hecto walks onto them.
4. **Monsters.** Spawn at edges, pathfind toward nearest unit, killed by Evascor adjacency (routine check).
5. **Tether + death.** Distance check at end of turn. Stun mechanic on Evascor.
6. **Artifact claiming.** Claim when Hecto on artifact hex (revealed or hidden) + Evascor within 3 + 2 MP. Inventory display in HUD.
7. **Artifact effects.** Implement the 4 templates. Wire up 20 artifacts as data.
8. **Jhirle.** Spawn after first claim. Pathfind to nearest *revealed* unclaimed artifact. Blocked by Evascor. Claim on arrival.
9. **Win/lose conditions.**
10. **Polish.** Escalation tuning, quarry healing, forest hiding, artifact cooldown display.

Each step is playable and testable before moving to the next.

---

# Strategies

These are the play patterns the design should support. If playtesting shows any of these are non-viable or dominant, the mechanics need tuning.

## Early Game: The Scroll Rush vs. Vision Gamble

**Scroll Rush.** Grab as many scrolls as possible before claiming artifact #1 (which spawns Jhirle). Every scroll read before Jhirle appears is free — she can't act on information revealed before she exists. But she DOES inherit all revealed locations when she spawns (she's been watching from afar). So pre-Jhirle scrolls aren't truly free — they build her target list the moment she appears. The real advantage is positional: you've had time to move toward a revealed artifact and can claim it the turn she spawns, before she can react. The risk: spending too many turns on scrolls means monsters accumulate and you're still carrying zero artifacts.

**Vision Gamble.** Study the 3 visions, scan the map for matching terrain, and walk Hecto toward a likely spot. If you guess right, you claim a hidden artifact and Jhirle never knows. If you guess wrong, you've burned MP walking to the wrong place. High reward, high risk. Best used when a vision clearly matches one spot on the map.

**Hybrid.** Read 2-3 nearby scrolls to reveal nearby artifacts, attempt one vision on the side. This is probably the default pattern, but the game should reward players who lean harder into one or the other depending on the map.

## Mid Game: The Jhirle Race

Once Jhirle appears, every revealed artifact is contested. Three approaches:

**Outrun her.** Reveal an artifact near you, immediately push Hecto there. You have a 1-turn information lead. If the artifact is close and the path is clear, you beat her. Works best with mobility artifacts (Wind Striders, Blink Shard).

**Block her.** Park Evascor on a chokepoint between Jhirle and her target. She can't enter his hex, so she detours. This buys turns but splits the pair — Hecto is vulnerable without Evascor nearby. Best used when a narrow passage (between water/mountains) exists on her path.

**Ignore her.** Let Jhirle take a distant artifact while you claim a closer one. She can take up to 3 before you lose (you lose if she takes 4 before you have 3). Giving her one freebie to secure your own claim is sometimes correct. Dangerous if she accelerates.

**Stealth claim.** Skip the scroll entirely. Use a vision to find and claim a hidden artifact. Jhirle can't race what she doesn't know about. The ultimate counter — but only works if you can read the vision correctly.

## Late Game: The Return

After claiming 3 artifacts, Hecto must reach a city on the eastern border with Evascor within 3 hexes. The monster spawn rate is now 4/turn. The board is swarming. The cities are home — but they're far from where the artifacts were.

**Stick together.** Keep Hecto within tether range of Evascor and grind east toward a city. Evascor's routine handles adjacent monsters. Slow but safe if Evascor hasn't taken too many stuns.

**Sprint Hecto.** Use mobility artifacts (Wind Striders, Quicksilver Flask) to rocket Hecto toward a city. Evascor just needs to be within 3 when Hecto arrives — he doesn't need to be ON the city. Risky: if Hecto gets too far ahead, one monster spawn can end the game.

**Artifact blitz.** Blow your remaining one-use artifacts. Ember Rod clears a corridor. Quicksilver Flask gives 10 MP in a turn. Mirror of Echoes sends monsters chasing a ghost. This is the windfall moment the accumulation driver promises — everything you've saved pays off at once.

## Recurring Tensions

These trade-offs should come up every game, not just in specific strategies:

**Reveal vs. conceal.** Every scroll reveals an artifact but also tells Jhirle (1 turn later). The player constantly weighs: do I need the information, or is secrecy more valuable?

**Together vs. apart.** Evascor protects Hecto, but they cover ground faster when split. Mountains force splits. Blocking Jhirle forces splits. Every split is a bet that no monster reaches Hecto before they reunite.

**Claim vs. move.** Claiming costs 2 MP from a pool of 5. On the turn you claim, you barely move. Monsters close in. The turn after a claim, spawn rate increases. Claiming is a commitment — you're saying "this artifact is worth being stuck here for a turn."

**Fight vs. avoid.** Evascor's routine handles small groups, but overflow stuns him (3 stuns = death). Every unnecessary fight chips away at his stun budget. Forest hides Hecto from monsters, routing through forest costs more MP but avoids combat. The question: is the shorter path through open ground worth the risk of a swarm?

**Hoard vs. spend.** One-use artifacts (Ember Rod, Quicksilver Flask, Mirror of Echoes) are strongest when saved for the escape. But using one mid-game to grab a contested artifact might be the right call. There's no "right" time — only the least wrong time.

## Anti-Strategies (things the design should prevent)

**Turtling.** Staying in one area and farming scrolls forever without claiming. Prevented by: monsters spawn at 1/turn even at 0 artifacts. By turn 15-20, that's 15-20 monsters on the board with only Evascor's routine-3 to handle them. The player MUST start claiming to gain artifact abilities that help manage the swarm. Delaying the first claim delays Jhirle, but the monster pressure alone forces action. The game is unwinnable if you wait too long — you need artifacts to survive the escape.

**Scroll hoarding.** Reading all 10 scrolls before claiming anything, to have perfect information before Jhirle appears. Partially valid — this IS a strategy (the Scroll Rush above). But it's bounded by: MP cost of reaching all scrolls, escalating monster pressure, and the fact that some scrolls are redundant (reveal already-revealed artifacts). The player can't spend 20 turns collecting scrolls without monsters becoming a serious problem.

**Evascor solo.** Sending Evascor alone to fight everything while Hecto hides. Prevented by: Evascor can't claim artifacts. Evascor can't read scrolls. The game requires Hecto to move and take risks. Evascor-as-bodyguard is correct, Evascor-as-entire-army is not viable.

**Vision cheese.** Walking Hecto to every plausible vision location until he stumbles onto all 3. Possible but expensive — each wrong guess costs MP, and the map is big. With 7 artifacts and 3 visions, the player would need to check many spots. The opportunity cost of wrong guesses (turns not spent claiming or dodging) keeps this honest.

**Jhirle kiting.** Using Evascor to permanently block Jhirle so she never claims anything. Prevented by: Jhirle switches targets when blocked too long (she commits to one target but retargets if she can't make progress for 3 turns). Also, permanently parking Evascor on a chokepoint means Hecto is unprotected. The tether threat keeps this as a temporary tactic, not a permanent solution.
