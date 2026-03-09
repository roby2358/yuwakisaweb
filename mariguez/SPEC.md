# SPEC.md — King of Mariguez

## Purpose

King of Mariguez is a single-player turn-based tactical game played on a procedurally generated hex grid. The player controls two units — Hecto (a fragile scholar) and Evascor (an indestructible stone giant) — who share a single pool of movement points. The goal is to collect 3 of 7 hidden artifacts scattered across a hostile wilderness, then escape to the map edge with both units alive.

Artifacts are discovered through two mechanisms: scrolls (which reveal exact locations but alert a rival NPC) and the Seer's visions (cryptic terrain clues that allow secret discovery). A rival NPC, Jhirle, competes for the same artifacts using information the player reveals. Monsters spawn with increasing frequency as the player claims artifacts.

The game is implemented as a browser-based canvas application using the existing hex grid engine.

---

## UI Layout

```
+---------------------------------------------------------------+
| [HUD Panel - fixed top-left]                                  |
|                                                               |
|  Turn 12          MP: 3/5                                     |
|  [H] Hecto        [E] Evascor (Routine: 3)                   |
|                    Stuns: 1/3                                  |
|                                                               |
|  Artifacts: [Wind Striders CD:2] [Ember Rod USE] [_empty_]    |
|                                                               |
|  Seer's Visions:                                              |
|    "Where cold stone meets deep shade"                        |
|    "Open ground on two sides, touched by dark water"          |
|    "Between rising ground and golden earth"                   |
|                                                               |
|  [End Turn]  [New Game]                                       |
|                                                               |
+--+------------------------------------------------------------+
|  |                                                            |
|  |                                                            |
|  |              [Hex Grid Canvas]                             |
|  |                                                            |
|  |   S         H  E           S                               |
|  |        S              M                                    |
|  |                  M         A(blue)                         |
|  |     S                           J                          |
|  |              M        S                                    |
|  |                                                            |
+--+------------------------------------------------------------+
|  [Notification Bar - bottom, overlays canvas]                 |
|  "Ancient scroll reveals: Bellowing Horn - push enemies away" |
+---------------------------------------------------------------+

Legend:
  H = Hecto (yellow counter)
  E = Evascor (gray counter)
  J = Jhirle (purple counter)
  M = Monster (red counter)
  S = Scroll (tan/parchment marker)
  A = Revealed artifact (blue marker)
```

---

## Functional Requirements

### Map Generation

- The application MUST generate a hex grid using the existing terrain generation system with terrain types: plains, forest, hills, water, mountain, quarry
- The application MUST place the player units (Hecto and Evascor) on adjacent passable hexes in the left portion of the map
- The application MUST place 7 artifact hexes on passable, non-edge hexes with a minimum distance of 8 hexes between any two artifacts
- The application MUST select the 7 artifacts randomly from a pool of 20 defined artifacts
- The application MUST place 10 scroll hexes on passable hexes with a minimum distance of 5 hexes between any two scrolls
- The application MUST generate 3 Seer's visions at game start, each describing the terrain neighborhood of a randomly chosen artifact
- Artifacts MUST be hidden (not displayed) until revealed by a scroll or discovered by Hecto stepping on the hex

### Turn Structure

- The application MUST process each turn in the following order:
  - Player movement and artifact activation phase (interactive)
  - Artifact claim check
  - Evascor combat resolution
  - Hecto death check
  - Enemy spawn and movement
  - Jhirle movement and claim
  - Cooldown decrement, turn increment, MP reset

### Player Units

- The application MUST support two player-controlled units: Hecto and Evascor
- Both units MUST draw movement from a single shared pool of 5 MP per turn
- The player MUST be able to select either unit by clicking its counter
- The application MUST display reachable hexes for the selected unit based on remaining MP and terrain costs
- The player MUST be able to move the selected unit by clicking a reachable hex
- The player MUST be able to end the turn manually via a button or by pressing Space/Enter
- The turn MUST end automatically when MP reaches 0

### Hecto

- Hecto MUST pay terrain-based movement costs: plains 1, forest 2, hills 2, quarry 2
- Hecto MUST NOT enter water or mountain hexes
- Hecto MUST automatically pick up scrolls when entering a scroll hex at no additional MP cost
- Hecto MUST be the only unit that can claim artifacts
- Hecto MUST die if at the end-of-turn death check he is adjacent to a monster AND more than 3 hexes from Evascor
  - Exception: if the hecto-invulnerable flag is active, the death check MUST be skipped

### Evascor

- Evascor MUST pay 1 MP per hex regardless of terrain type
- Evascor MUST pay 2 MP to enter mountain hexes
- Evascor MUST NOT enter water hexes
- Evascor MUST have a routine rating (base value: 3)
- At the combat step, Evascor MUST automatically kill up to [routine] adjacent enemies
- If adjacent enemies exceed the routine rating, Evascor MUST receive a stun
  - A stunned Evascor MUST skip the entire next player phase (no movement, no MP contribution)
  - The application MUST track total stun count; 3 total stuns MUST trigger game over
  - If the negate-next-stun flag is active, the stun MUST be cancelled and the flag cleared
- When Evascor ends a turn on a quarry hex, the application MUST clear any active stun and reset routine to base value

### Scrolls

- Scroll markers MUST be visible on the map from game start
- When Hecto enters a scroll hex, the application MUST remove the scroll from the map
- The application MUST then find the nearest artifact (by hex distance) that has not been revealed
- If an unrevealed artifact exists, the application MUST set it to revealed, display it on the map, and show a notification with the artifact name and a one-line power description
- If all artifacts are already revealed, the application MUST show a notification indicating the scroll is unreadable
- The application MUST add newly revealed artifact IDs to a pending list for Jhirle (she learns them next turn)

### Seer's Visions

- The application MUST generate 3 visions at game start
- Each vision MUST describe 2-3 terrain types present in the 6 neighboring hexes of a randomly chosen artifact
- The vision text MUST be generated from a template system using evocative terrain synonyms
- Visions MUST be displayed in the HUD for the entire game
- Hecto MUST be able to claim hidden (unrevealed) artifacts by stepping on their hex, provided claiming conditions are met
- Artifacts claimed while hidden MUST NOT be added to Jhirle's knowledge

### Artifact Claiming

- Claiming MUST require: Hecto on the artifact hex, Evascor within 3 hexes of Hecto, and 2 MP available
- The application MUST show a confirmation prompt when claim conditions are met
- Claiming MUST deduct 2 MP
- The application MUST support a maximum inventory of 5 artifacts
- If claiming a 6th artifact, the application MUST prompt the player to choose one artifact to drop
- Dropped artifacts MUST be permanently removed from the game

### Artifact Effects

- The application MUST support 4 artifact effect templates:
  - **Passive:** Always active while carried; modifies a game value
  - **Activated (self/global):** Triggered by clicking the artifact button; applies an immediate effect; goes on cooldown
  - **Activated (targeted):** Triggered by clicking the artifact button, then clicking a valid target hex; goes on cooldown
  - **One-use:** Same as activated, but the artifact is removed from inventory after use
- Each artifact MUST be defined as a data object specifying its template type and parameters
- The application MUST support 20 artifacts organized into 6 roles: mobility (4), combat (4), scouting (3), survival (4), terrain control (3), wildcards (2)
- Cooldowns MUST decrement by 1 at the end of each turn
- Artifacts on cooldown MUST be displayed as unavailable in the HUD
- When a targeted artifact is activated, the application MUST enter a targeting mode where the next hex click applies the effect instead of moving a unit

### Monsters

- The application MUST spawn monsters at random passable edge hexes during the enemy phase
- Spawn count per turn MUST equal the number of artifacts the player has claimed plus 1
- Each monster MUST move 1 hex per turn toward the nearest player unit using BFS pathfinding
- If Hecto is on a forest hex, monsters MUST path toward Evascor instead of Hecto
- If a decoy is active, monsters MUST path toward the decoy instead of player units
- Monsters MUST be removed from the map when killed by Evascor's routine or artifact effects
- Monsters MUST be displayed as red counters

### Jhirle

- Jhirle MUST NOT appear until the turn after the player claims their first artifact
- Jhirle MUST spawn on a random passable edge hex
- Jhirle MUST only know about artifacts that the player has revealed via scrolls
- When Jhirle spawns, she MUST inherit all currently revealed artifact locations
- After spawning, Jhirle MUST learn about newly revealed artifacts with a 1-turn delay
- Jhirle MUST move toward the nearest known, unclaimed artifact using BFS pathfinding through terrain
- Jhirle's base speed MUST be 2 hexes per turn, increasing to 3 after the player claims a second artifact
- Jhirle MUST commit to one target at a time
- Jhirle MUST switch targets when: (a) her current target is claimed, (b) a closer known artifact appears, or (c) she has made no progress for 3 consecutive turns
- Jhirle MUST NOT enter a hex occupied by Evascor
- Jhirle MUST NOT be attackable or killable
- When Jhirle reaches an artifact hex, that artifact MUST be removed from the game and the Jhirle claim count incremented
- Jhirle MUST be displayed as a purple counter

### Win/Lose Conditions

- The player MUST win when they have claimed 3 artifacts AND both Hecto and Evascor are on edge hexes
- The application MUST check for a win after the player ends their turn
- The game MUST end in a loss if Hecto is killed (death check fails)
- The game MUST end in a loss if Evascor accumulates 3 stuns
- The game MUST end in a loss if Jhirle claims 4 artifacts
- The application MUST display a game-over overlay indicating the outcome and turn count

### Input

- The player MUST be able to select units by clicking their counter
- The player MUST be able to move the selected unit by clicking a highlighted reachable hex
- The player MUST be able to end the turn via a button or Space/Enter key
- The player MUST be able to activate artifacts by clicking their button in the HUD
- The player MUST be able to start a new game via a button
- The application MUST support right-click drag to pan the map

---

## Non-Functional Requirements

### Styling

- The application MUST use a dark background for the canvas
- Unit counters MUST be displayed as colored rounded rectangles with single-letter labels
- Counter colors: Hecto = red, Evascor = gray, Jhirle = purple, Monsters = dark red/maroon
- Scroll markers MUST be displayed in tan/parchment color with an "S" label
- Revealed artifacts MUST be displayed in blue with a distinctive marker
- Reachable hexes MUST be highlighted in semi-transparent yellow
- The HUD panel MUST use a monospace font
- Artifact cooldowns MUST be visually distinguishable from ready artifacts (grayed out vs active)
- One-use artifacts MUST be visually marked differently from rechargeable artifacts

### Performance

- The application MUST render smoothly on the existing 60x40 hex grid
- BFS pathfinding for monsters and Jhirle MUST complete within a single frame
- The application SHOULD target 60fps rendering

### Code Quality

- Artifacts MUST be defined as data objects, not as individual code paths
- Artifact effect functions MUST be implemented as a lookup table mapping effect names to functions
- The game state MUST be stored in a single state object

---

## Dependencies

- No external libraries. The application uses vanilla JavaScript with HTML5 Canvas.
- Existing modules: hex.js (grid utilities, BFS pathfinding), rando.js (random number utilities), colortheory.js (color generation), config.js (constants)

---

## Implementation Notes

- The existing terrain generation uses a diamond-square algorithm producing a 129x129 heightmap with elevation-based terrain assignment. This system is retained as-is.
- Hex coordinates use an axial system (q, r) with pointy-top hexes. Pixel conversion, neighbor calculation, and BFS pathfinding are already implemented in hex.js.
- The existing BFS implementation (bfsHexes) uses Dijkstra cost calculation, suitable for computing reachable hexes with terrain costs and for Jhirle/monster pathfinding.
- Counter rendering uses rounded rectangles with a depth shadow effect (2 gray L-shaped lines). This style is retained for all unit types.
- The Seer's vision text generation requires a template system with terrain synonym lookup tables. Vision uniqueness is not guaranteed — multiple map locations may match a clue. This ambiguity is intentional.
- Jhirle's "no progress" detection tracks her position each turn. If her hex distance to target does not decrease for 3 consecutive turns, she retargets.
- The forest hiding rule is implemented as a conditional in monster pathfinding target selection: if Hecto is on a forest hex, monsters use Evascor's position as their pathfinding target instead of Hecto's.
- Artifact placement uses a rejection sampling approach: place artifacts one at a time, rejecting any placement within 8 hexes of an already-placed artifact. Scroll placement uses the same approach with a 5-hex minimum distance.

---

## Error Handling

- If artifact placement cannot satisfy the minimum distance constraint after a reasonable number of attempts, the application MUST regenerate the map
- If no valid path exists between the player start position and any artifact, the application MUST regenerate the map
- If a targeted artifact effect is activated but the player clicks an invalid hex (out of range, wrong terrain, no valid target), the application MUST cancel the targeting mode and refund any MP cost
- If Jhirle has no known unclaimed artifacts to target, she MUST remain stationary until new information becomes available
