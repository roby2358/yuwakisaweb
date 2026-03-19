# SPEC.md — Warrior

## Purpose

Warrior is a single-player tactical hex RPG set on a world where swords and sorcery collide with alien technology and creeping chaos. The player controls a cosmically powered warrior exploring a large procedurally generated world map, fighting enemies in tactical hex combat, gaining experience and loot, and ultimately sealing the Maw — a wound in the world itself where reality is dissolving into chaos.

The game runs entirely client-side in the browser using canvas rendering and ES6 modules with no build step or external dependencies.

## UI Layout

```
+----------------------------------------------------------+
| [HUD Bar]                                                |
| Turn 12  HP ████████░░ 74/100  Aether ██████░░░░ 6/10   |
| MP: 3/5  Level 4  XP: 230/400   [Char] [Skills] [Inv]  |
+----------------------------------------------------------+
|                                                          |
|                                                          |
|              [World Map — Full Canvas]                   |
|              Hex grid with terrain, tokens,              |
|              fog of war, points of interest              |
|                                                          |
|                                                          |
+----------------------------------------------------------+
| [Context Bar]                                            |
| Plains | Void Stalker (HP 12/15, Lvl 2)                  |
+----------------------------------------------------------+
```

Overlay panels slide in from the right when toggled:

```
+---------------------------+--------------------+
|                           | [Panel]            |
|                           |                    |
|     [World Map]           | Character Sheet    |
|     (dimmed behind)       |   OR Skills        |
|                           |   OR Inventory     |
|                           |                    |
+---------------------------+--------------------+
```

## Functional Requirements

### World Map

- The world MUST be a rectangular hex grid (60 columns x 40 rows), pointy-top hexes, using axial coordinates
- Terrain MUST be generated via diamond-square heightmap with the following distribution: 25% water, 50% plains, 10% forest, 10% hills, 1% gold deposits, 2% quarry, 5% mountains
- Edge hexes MUST be water
- The map MUST support panning via right-click drag
- The map MUST render terrain with distinct colors per terrain type

### Fog of War

- All hexes MUST start hidden (black) except those within the player's vision radius
- The player MUST reveal hexes within a radius of 4 hexes from their current position
- Previously revealed hexes MUST remain visible but SHOULD appear slightly dimmed compared to currently visible hexes
- Enemy tokens MUST only be visible when within the player's current vision radius
- Points of interest (settlements, ruins, breaches) MUST remain visible once revealed

### Points of Interest

The map MUST generate the following points of interest on passable, non-edge terrain:

- **Havens** (2-3): Major settlements. Fully heal and restore Aether. Offer equipment for sale. Marked with a shield icon
- **Camps** (4-6): Minor rest stops. Heal 50% of max HP and restore 50% Aether. Marked with a campfire icon
- **Ruins** (3-5): Contain loot (equipment or consumables) guarded by 1-3 enemies. Marked with a broken column icon. Each ruin MUST be lootable only once
- **Breaches** (3-4): Wounds in the world where chaos seeps through, spawning twisted creatures. Each breach MUST have a guardian (mini-boss). Closing a breach (defeating its guardian while adjacent) stops its spawning. Marked with a swirl icon
- **The Maw** (1): The final objective — the deepest wound, where reality itself is dissolving. Placed on the right side of the map. Marked with a pulsing star icon. The player MUST have closed at least 2 breaches before the Maw can be challenged

Points of interest MUST be placed with minimum distance constraints so they don't cluster.

### Player Character

- The player MUST have 4 base stats:
  - **Might**: Melee attack damage bonus
  - **Reflex**: Ranged attack damage, dodge chance (Reflex% capped at 30%), and turn order priority
  - **Warding**: Skill damage bonus and resistance to special attacks (reduces incoming skill damage by Warding%)
  - **Vigor**: Maximum HP (base 50 + Vigor * 10) and HP restored when resting at camps/havens
- Starting stats MUST be Might 3, Reflex 3, Warding 2, Vigor 3
- The player MUST have the following resources:
  - **HP**: Health points. Reaching 0 MUST trigger defeat
  - **Aether**: Cosmic energy for skills. Maximum is 5 + (Warding * 2). Restored at havens/camps
  - **MP**: Movement points per turn. Base 5
- The player MUST start at a randomly chosen haven

### Combat

Combat takes place directly on the world map in the same turn structure as exploration.

#### Melee Attacks

- The player MUST be able to melee attack by moving onto a hex occupied by an enemy
- Melee damage MUST be: weapon damage + Might
- The target MUST take damage reduced by its defense value
- If the attack kills the target, the player MUST occupy the target's hex (spending movement cost as normal)
- If the attack does not kill the target, the player MUST remain on the hex they moved from, and the target MUST counter-attack for its base damage minus the player's defense

#### Ranged Attacks

- The player MUST be able to use ranged attacks when a ranged weapon or ranged skill is equipped/available
- Ranged weapon attacks MUST cost 1 Aether
- Ranged attack range MUST be: weapon range (typically 2-3 hexes)
- Ranged damage MUST be: weapon damage + Reflex
- Ranged attacks MUST require line-of-sight (no mountains or unrevaled hexes blocking)
- Using a ranged attack MUST end the player's movement for that turn

#### Damage Formula

- Outgoing damage = base damage + stat bonus (Might for melee, Reflex for ranged, Warding for skills)
- Incoming damage = attacker base damage - player defense
- Minimum damage MUST be 1 (attacks always deal at least 1 damage)
- Dodge: each incoming attack has a Reflex% chance to be completely avoided (cap 30%)

#### Enemy Types

All enemies MUST have: name, HP, attack damage, defense, movement speed (hexes per turn), XP reward, and a behavior pattern.

- **Void Stalker**: Fast melee attacker (speed 2). Low HP, low defense. Moves toward the player when within 5 hexes, otherwise wanders. Common enemy
- **Breach Crawler**: Slow tank (speed 1). High HP, high defense, high damage. Moves toward the player when within 3 hexes. Found near breaches
- **Flux Archer**: Ranged attacker (speed 1, range 3). Low HP, low defense. Tries to maintain 2-3 hex distance from the player. Found in ruins and open terrain
- **Phase Wraith**: Teleporter (speed 1, but can teleport up to 3 hexes). Medium HP. Appears and disappears unpredictably. Found near breaches. 30% chance each turn to teleport to a random hex within 3 of the player
- **Breach Guardian**: Mini-boss (speed 1). High HP, high damage, medium defense. Guards a breach. Does not wander — stays within 2 hexes of its breach. Defeating it while adjacent to the breach closes the breach
- **The Unraveler**: Final boss at the Maw — a manifestation of the world's chaos given form. Very high HP, alternates between melee and ranged attacks. Spawns 1 Void Stalker every 3 turns during the fight

#### Enemy Spawning

- Each open (unclosed) breach MUST have a 15% chance per turn to spawn one enemy (Void Stalker or Phase Wraith) on a passable hex adjacent to the breach
- Maximum enemies on the map MUST be capped at 20
- At game start, 2d4 Void Stalkers and 1d3 Flux Archers MUST be placed randomly on passable terrain
- Each breach MUST start with its Breach Guardian and 1-2 Breach Crawlers placed adjacent

#### Enemy AI

- Enemies with detection range MUST move toward the player using A* pathfinding when the player is within detection range
- Enemies outside detection range MUST wander randomly (move 1 hex to a random valid neighbor, 50% chance to skip movement)
- Enemies MUST NOT move onto water, mountains, or hexes occupied by other enemies
- Enemies MUST attack the player if they move adjacent (melee) or within range (ranged)
- Enemy attacks MUST happen during the enemy phase, after all enemy movement

### Turn Structure

1. **Player Phase**: The player spends MP to move and/or uses skills/attacks. The player MAY end their turn early
2. **Enemy Phase**: All enemies act in order. Each enemy moves (toward player if detected, otherwise wander), then attacks if able. Enemy movement SHOULD be animated sequentially (brief delay per enemy) so the player can follow the action
3. **Spawn Phase**: Breach spawning rolls occur. New enemies appear. Turn counter increments

### Skills

- The player MUST have 4 active skill slots
- Skills MUST cost Aether to use
- The player MUST start with 1 skill (Void Strike) and gain access to new skills at levels 2, 4, 6, 8, and 10
- At each skill-unlock level, the player MUST choose one skill from two randomly offered options

#### Skill List

| Skill | Aether Cost | Effect | Unlock |
|---|---|---|---|
| Void Strike | 1 | Melee attack dealing weapon damage + Might + Warding to target. No counter-attack | Start |
| Phase Step | 2 | Teleport to any visible hex within 3. Does not cost MP | Level 2+ |
| Cosmic Bolt | 2 | Ranged attack (range 4) dealing 8 + Warding damage | Level 2+ |
| Warp Shield | 2 | Absorb the next source of damage completely. Lasts until triggered or 3 turns | Level 4+ |
| Breach Pulse | 3 | Deal 5 + Warding damage to all enemies within 2 hexes | Level 4+ |
| Mending Light | 2 | Restore 10 + Vigor * 3 HP | Level 6+ |
| Gravity Well | 3 | Pull all enemies within 3 hexes 1 hex closer to the player | Level 6+ |
| Dimensional Rend | 4 | Melee attack dealing weapon damage * 3. Must be adjacent | Level 8+ |
| Starfall | 5 | Deal 15 + Warding * 2 damage to all enemies within 3 hexes | Level 10 |

- Using a skill (except Phase Step) MUST end the player's movement for that turn
- Skills MUST be usable once per turn each (no repeating the same skill in one turn)

### Progression

- The player MUST gain XP from defeating enemies
- Level-up XP thresholds MUST follow a polynomial curve: XP needed = 50 * level^1.8 (rounded to nearest 10)
  - Level 2: 50 XP
  - Level 3: 150 XP
  - Level 4: 310 XP
  - Level 5: 520 XP
  - Level 6: 780 XP
  - Level 7: 1100 XP
  - Level 8: 1470 XP
  - Level 9: 1900 XP
  - Level 10: 2390 XP
- Each level-up MUST grant 3 stat points to distribute freely
- Each level-up MUST fully restore HP and Aether
- A level-up notification MUST appear prominently, and stat allocation MUST happen before the player can continue

### Equipment

- The player MUST have 3 equipment slots: **Weapon**, **Armor**, **Artifact**
- Equipment MUST be found in ruins, dropped by mini-bosses, or purchased at havens

#### Weapons

Each weapon MUST have: name, type (melee or ranged), damage, range (for ranged), and optionally a special property.

| Weapon | Type | Damage | Range | Special | Source |
|---|---|---|---|---|---|
| Rusty Blade | Melee | 4 | - | - | Starting |
| Void Cleaver | Melee | 7 | - | +2 damage vs chaos-spawned enemies | Ruin/Drop |
| Starforged Sword | Melee | 10 | - | - | Haven (expensive) |
| Dimensional Edge | Melee | 12 | - | Attacks hit 2 adjacent targets | Breach Guardian drop |
| Flux Bow | Ranged | 5 | 3 | - | Ruin/Haven |
| Phase Rifle | Ranged | 8 | 4 | Ignores defense | Breach Guardian drop |
| Aether Lance | Ranged | 6 | 3 | Costs 0 Aether | Ruin |

#### Armor

Each armor MUST have: name, defense value, and optionally a special property.

| Armor | Defense | Special | Source |
|---|---|---|---|
| Worn Leather | 2 | - | Starting |
| Warded Mail | 4 | +10 max HP | Ruin/Haven |
| Chaosweave Cloak | 3 | +2 vision radius | Ruin |
| Starplate | 6 | -1 MP | Haven (expensive) |
| Voidhide | 5 | Immune to Phase Wraith teleport damage | Breach Guardian drop |

#### Artifacts

Each artifact MUST have: name, and a passive effect.

| Artifact | Effect | Source |
|---|---|---|
| Seer's Lens | +2 vision radius | Ruin |
| Aether Crystal | +4 max Aether | Ruin/Haven |
| Vitality Stone | Regenerate 3 HP per turn | Breach Guardian drop |
| Phase Anchor | Cannot be displaced by enemy abilities | Ruin |
| Maw Compass | Reveals the Maw's location on the map | Haven (after closing 1 breach) |

### Economy

- Gold MUST be the currency, found from: defeating enemies (1-5 gold), looting gold terrain hexes (10 gold per hex, one-time), and looting ruins (5-20 gold)
- The player MUST be able to buy and sell equipment at havens
- Selling price MUST be 40% of buy price (rounded down)
- Haven shops MUST offer 3-5 randomly selected items from the equipment tables, with prices scaling by item power

### Terrain Effects

| Terrain | Movement Cost | Combat Effect |
|---|---|---|
| Plains | 1 | None |
| Forest | 2 | +1 defense for occupant |
| Hills | 2 | +1 ranged attack range for occupant |
| Gold | 1 | Lootable for 10 gold (one-time) |
| Quarry | 2 | None |
| Water | Impassable | - |
| Mountain | Impassable | Blocks line of sight |

### HUD

- The top HUD bar MUST display: turn number, HP bar with numeric value, Aether bar with numeric value, current MP, level, XP progress, and buttons to toggle Character/Skills/Inventory panels
- The bottom context bar MUST display: terrain name of hovered hex, and if an enemy is on that hex, the enemy's name, HP, and level
- The HUD MUST update in real-time as values change

### Character Panel

- MUST display all 4 stats with current values
- MUST display current equipment in all 3 slots
- MUST display current level, XP, and XP to next level
- MUST display derived values: total attack, defense, dodge chance, vision radius
- When stat points are available, MUST show + buttons next to each stat

### Skills Panel

- MUST display all 4 skill slots with equipped skills
- Each skill MUST show: name, Aether cost, effect description, and cooldown state
- Unoccupied slots MUST be clearly indicated
- When a skill unlock is available, MUST present the two skill options for selection

### Inventory Panel

- MUST display all carried items in a scrollable list
- Each item MUST show: name, type, key stats, and an equip/unequip button
- Currently equipped items MUST be visually distinguished
- Gold total MUST be displayed at the top

### Victory and Defeat

- The player MUST win by defeating The Unraveler at the Maw (requires 2+ breaches closed first)
- Upon victory, the game MUST display: total turns taken, enemies defeated, breaches closed, and final level
- The player MUST lose when HP reaches 0
- Upon defeat, the game MUST display the same statistics and offer a "New Game" button
- There MUST be a "New Game" button accessible at all times from the HUD

### Input

- Left-click on the player token MUST select the player and show reachable hexes (yellow highlight)
- Left-click on a highlighted hex MUST move the player there
- Left-click on a highlighted hex containing an enemy MUST initiate a melee attack
- Right-click drag MUST pan the map
- Keyboard shortcut "E" or Space MUST end the current turn
- Keyboard shortcut "1-4" MUST activate the corresponding equipped skill
- Keyboard shortcut "C" MUST toggle the Character panel
- Keyboard shortcut "S" MUST toggle the Skills panel
- Keyboard shortcut "I" MUST toggle the Inventory panel
- Keyboard shortcut "N" MUST start a new game (with confirmation)
- When a ranged attack or targeted skill is active, left-click on a valid target hex MUST execute the attack/skill
- When a ranged attack or targeted skill is active, right-click or Escape MUST cancel the targeting

### Interaction with Points of Interest

- Moving onto a haven hex MUST open a dialog offering: Rest (full heal + Aether restore), Shop (buy/sell equipment), or Leave
- Moving onto a camp hex MUST open a dialog offering: Rest (50% heal + 50% Aether restore) or Leave
- Moving onto a ruin hex (unlooted) MUST trigger the ruin's encounter (enemies if any, then loot)
- Moving onto a breach hex while its guardian is defeated MUST close the breach with a visual effect
- Moving onto the Maw hex (with 2+ breaches closed) MUST begin the final encounter

## Non-Functional Requirements

### Styling

- The game MUST use a dark theme with monospace fonts
- Terrain colors MUST be distinct and readable at the default hex size
- The player token MUST be visually distinct from all enemy tokens (gold color, "P" label)
- Enemy tokens MUST use the existing ColorTheory-generated palette with letter labels matching their type (V for Void Stalker, C for Crawler, A for Archer, W for Wraith, G for Guardian, U for Unraveler)
- HP bars MUST use green-to-red gradient based on percentage
- Skill and panel UI MUST use semi-transparent dark backgrounds consistent with the existing HUD style
- Points of interest MUST be rendered with distinct icons/symbols on their hexes
- Reachable hexes MUST highlight in yellow; attack targets MUST highlight in red; skill targets MUST highlight in blue

### Performance

- The render loop MUST skip hexes outside the visible viewport
- Fog of war MUST be computed only when the player moves, not every frame
- Enemy pathfinding MUST use the existing A* implementation from hex.js
- The game MUST run at 60fps on a modern browser during normal gameplay

### Code Quality

- All game code MUST use ES6 modules with no external dependencies
- No build step, bundler, or package manager MUST be required
- The game MUST function when served via any static HTTP server
- Game state MUST be stored in module-level variables (no global window pollution)
- Color values MUST use 0-1 floats internally, converting to hex strings only for rendering

## Dependencies

- No external dependencies
- Built on existing utility modules: `hex.js`, `colortheory.js`, `rando.js`, `config.js`

## Implementation Notes

- Combat resolution happens immediately on player action (move-onto for melee, click-target for ranged), not as a separate phase. The counter-attack on failed kill is instant feedback
- Enemy phase movement should use `setTimeout` or `requestAnimationFrame` with ~150ms delays between each enemy's movement to create readable sequential animation
- The four overlay panels (Character, Skills, Inventory, Haven/Shop dialog) are HTML elements positioned over the canvas, styled consistently with the existing HUD. They are not rendered on the canvas
- Skill targeting mode is a distinct interaction state: after pressing a skill key, the cursor changes and valid target hexes highlight. Left-click fires, right-click/Escape cancels
- Fog of war is rendered as a dark semi-transparent overlay on unrevealed hexes, and a lighter overlay on revealed-but-not-currently-visible hexes
- Save/load is not in scope for the initial version
- The polynomial XP curve (50 * level^1.8) creates early levels that feel fast and later levels that require deliberate hunting, pushing the player to engage with breaches and ruins rather than grinding basic enemies
- Equipment drops use a weighted random selection from the appropriate tier. Breach Guardians always drop a breach-tier item the player doesn't already have
- The Maw Compass artifact is a deliberate design choice: the Maw is not visible until either a Seer's Lens reveals enough of the map or the player buys/finds the compass, creating an exploration incentive

## Error Handling

- If map generation fails to produce a connected path between the starting haven and the Maw within 20 attempts, the game MUST regenerate the map
- If no valid hex exists for placing a point of interest, the game MUST skip that point of interest rather than crash
- If the equipment pool is exhausted (all items found), haven shops MUST offer consumable healing items instead
- If all breaches are already closed when the player reaches the Breach, the encounter MUST proceed normally
