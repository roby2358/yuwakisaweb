# Game Dynamics

## Theme

The desperate ascent of a lone warrior through a world tearing itself apart from within. Not power fantasy — *survival escalation*. The land itself is sick — chaos bleeds from wounds in the earth, twisting creatures and corrupting terrain. Chaos-spawned enemies literally shatter the ground they walk on, turning fertile plains into broken wastelands. You start weak and claw your way to relevance one fight at a time. The feeling: every level earned, every breach sealed, every hex restored feels like defiance against entropy.

## Key Drivers

### 1. Accumulation and Windfall
The core RPG loop. XP, loot, stats, skills — every encounter makes you measurably stronger. The polynomial XP curve (`50 * level^1.8`, rounded to nearest 10) makes early levels feel fast (quick wins, dopamine) and later levels require deliberate engagement with dangerous content (breaches, ruins). Windfalls come from: breach guardian drops (tier 3 gear), level-up full heals (instant relief), ruin loot (random tier 1-3 gear + 5-20 gold), and finding a Dimensional Edge when you've been swinging a Rusty Blade for 20 turns. Killing chaos-spawned enemies returns +1 Aether, creating a sustain loop that rewards aggression.

### 2. Scarcity of Agency
4 MP per turn. 4 skill slots. Limited Aether. You can't fight everything, explore everything, or be everywhere. Every turn is a triage decision: push toward the next breach or retreat to heal? Spend Aether on Void Strike for guaranteed damage or save it for Mending Light? Restore shattered terrain or conserve Aether for combat? Move deeper into fog or consolidate revealed territory? The constraint makes each action feel weighty. Engagement halves your MP, compounding the scarcity when you're in the thick of it.

### 3. Guardianship
One character. One life. No party, no reserves. Every HP point matters because death is game over. Equipment becomes precious — not because of stats alone, but because *you* found it, *you* chose it, *you* survived with it. The player should mourn losing their Chaosweave Cloak to a shop upgrade.

## Secondary Drivers

### Escalating Commitment
Breaches bleed chaos into the world continuously, spawning twisted creatures (15% per turn per open breach — 60% Void Stalkers, 40% Phase Wraiths). The longer you wait, the worse it gets. Meanwhile, chaos-spawned enemies shatter terrain as they move (2% per turn), increasing movement costs and degrading the map. Sealing breaches is the only way to reduce pressure, but each is guarded by a Breach Guardian. Standing still makes things worse — the game demands forward momentum.

### Readable Consequences
Yellow hexes show where you can go. Red hexes show what you can attack. Blue hexes show targeting range. Counter stats (attack bottom-left, defense bottom-right) tell you exactly what you're facing. Enemy detection ranges, HP bars, and type labels are all visible. The counter label turns dark during player phase and gold-tinted during enemy phase — a glanceable indicator of whose turn it is.

### Variable Reinforcement
Map generation (diamond-square heightmap), enemy placement, loot tables, skill unlock choices — every game is different. The two-skill choice at level-up means you're building a different character each run. Phase Step + Breach Pulse plays completely differently from Cosmic Bolt + Warp Shield.

### Near-Miss Architecture
The polynomial XP curve and breach escalation create a natural tension point around levels 5-7. You're strong enough to challenge breaches but not strong enough to be comfortable. The Maw requires 2 closed breaches, which means at least 2 guardian fights. If you're under-leveled when you attempt the Maw, you'll *almost* win — close enough to see how, which drives the "one more game" loop.

## Map

- Rectangular hex grid (60 columns x 40 rows), pointy-top hexes, axial coordinates (q, r)
- Generated via diamond-square heightmap (129x129, roughness 0.55), then terrain assigned by elevation percentile
- Terrain distribution: ~25% water, ~50% plains, ~10% forest, ~10% hills, ~1% gold, ~2% quarry, ~5% mountains
- Edge hexes are always water
- Points of interest placed with minimum distance constraint (6 hexes apart)
- Map validated on generation: path must exist from a haven to the Maw

## Terrain

| Terrain  | Move Cost  | Combat Effect | Notes |
|----------|------------|---------------|-------|
| Plains   | 1          | None | Bulk of playable map |
| Forest   | 2          | +1 defense | ~10% of interior hexes |
| Hills    | 2          | +1 ranged range | Elevation band above plains |
| Gold     | 1          | None | Lootable: 10 gold, one-time |
| Quarry   | 2          | None | Carved from hills during generation |
| Water    | Impassable | — | 25% of map, all edges |
| Mountain | Impassable | Blocks line of sight | Highest elevation band |
| Shattered Plains | 2 | None | Created by chaos corruption |
| Shattered Forest | 3 | +1 defense | Shattered but still provides cover |
| Shattered Hills | 3 | +1 ranged range | Shattered but still elevated |
| Shattered Gold | 2 | None | Lootable: 20 gold (double normal) |
| Shattered Quarry | 3 | None | Created by chaos corruption |

Chaos-spawned enemies have a 2% chance per turn to shatter the terrain they occupy, converting normal terrain to its shattered variant (+1 movement cost). The Restore skill reverses this. Shattered terrain is visually distinct (dark red tones) and serves as a visible footprint of chaos spreading across the map.

## Player

- Starts at the leftmost haven
- 4 Movement Points (MP) per turn (reduced to half, minimum 1, when engaged — adjacent to an enemy at turn start)
- 4 stats: Might, Reflex, Warding, Vigor (starting 3/3/2/3)
- HP = 50 + Vigor * 10 (starting 80)
- Aether = 5 + Warding * 2 (starting 9)
- Vision = 6 hexes (expandable with equipment)
- 3 stat points per level-up (allocated freely)
- 4 active skill slots, 3 equipment slots (weapon, armor, artifact)
- Starts with Rusty Blade (1 melee damage), Worn Leather (1 defense), Restore skill
- Regenerates 1 HP per turn naturally (at start of enemy phase)
- Dodge chance = Reflex% (capped at 30%)
- Melee damage = weapon damage + Might (+ 2 vs chaos-spawned with Void Cleaver)
- Ranged damage = weapon damage + Reflex
- Bell curve damage rolls: 3 rolls of 1..strength*2, averaged. Mean ≈ strength, with natural variance.

## Combat

### Melee
Move onto an enemy hex. Damage roll vs enemy defense, minimum 1 damage. If killed, player occupies the hex (costs terrain movement). If not killed, enemy counter-attacks.

### Ranged
Press R to enter targeting mode. Requires a ranged weapon. Costs 1 Aether (free with Aether Lance). Weapon ranges: Flux Bow 2, Aether Lance 3, Phase Rifle 5. Hills grant +1 range. Ends turn on use.

### Skills
Press 1-4 to activate. Each skill usable once per turn. Costs Aether. Some require targeting (melee, ranged, teleport targets), others execute immediately (self, AoE centered on self). Non-free skills end turn on use.

### Damage Formula
`rollDamage(strength)` → `Rando.bellCurve(strength)`: rolls 3 times from 1..strength*2, divides by 3, rounds. Produces a bell curve centered on strength. Applied to both player and enemy damage.

### Warp Shield
Absorbs the next hit entirely. Duration 3 turns. Consumed on first hit absorbed.

## Enemies

| Type | HP | Atk | Ranged | Def | Speed | Detect | Behavior | Notes |
|------|----|-----|--------|-----|-------|--------|----------|-------|
| Void Stalker | 15 | 5 | 3 (range 2) | 1 | 2 | 5 | Chase | Fast, fragile. Fires ranged AND melees. |
| Breach Crawler | 30 | 8 | — | 4 | 1 | 3 | Chase | Tanky, melee only. |
| Flux Archer | 12 | 6 | — (range 4) | 1 | 1 | 5 | Kite | Pure ranged: uses attack stat at range, maintains 2-3 hex distance. |
| Phase Wraith | 20 | 7 | — | 2 | 1 | 4 | Teleport | 30% chance to teleport within 3 hexes of player. |
| Breach Guardian | 50 | 10 | 8 (range 3) | 5 | 1 | 3 | Guard | Stays within 2 hexes of home breach. Dual melee+ranged. Drops tier 3 loot on death. |
| The Unraveler | 100 | 12 | 6 (range 4) | 6 | 1 | 6 | Boss | Spawns a Void Stalker every 3 turns. Dual melee+ranged. |

### Dual Attack System
Enemies with a `rangedAttack` field (Void Stalker, Breach Guardian, Unraveler) fire ranged *in addition to* melee when in melee range. Enemies without `rangedAttack` (Flux Archer) fire their `attack` stat at range but only when not in melee range. Ranged-capable chasers (Void Stalker) have a 50% chance per turn to prefer ranged fire and skip closing in. Flux Archers only fire 50% of the time when in range.

### Enemy Behaviors
- **Chase**: A* pathfinding toward player when within detection range, else 50% chance to wander randomly.
- **Kite**: Maintains 2-3 hex distance. Retreats if player gets within 2, approaches if beyond 3. Ideal range for ranged fire.
- **Guard**: Stays within guardRadius (2) of home POI. Chases if player enters detection range but won't leave the guard zone.
- **Teleport**: 30% chance per turn to teleport to a random passable hex within teleportRange (3) of the player.
- **Boss**: Chases when in detection range (6). Spawns Void Stalker adjacent every 3 turns.
- **Wildlife**: Procedurally generated neutral creatures. Chase player when within aggro range (varies per creature), otherwise 30% chance to wander. Avoid shattered terrain when wandering.

### Wildlife
12 procedurally generated creature types per game, with random fantasy names (e.g., "Ashtigeron", "Velpantherine"), unique colors from a random color scheme, and stats scaling from 3-12 attack. Wildlife is distinct from chaos-spawned enemies: they don't shatter terrain, don't grant Aether on kill, and avoid shattered hexes. 20 wildlife spawn at game start (outside player vision, on non-shattered terrain), with a 2% per turn chance to spawn more.

### Initial Spawning
- Void Stalkers: 2d4
- Flux Archers: 1d3
- Each breach gets 1 Breach Guardian + 1-2 Breach Crawlers
- The Maw gets 1 Unraveler
- Wildlife: 20 random creatures (outside initial vision)
- Total enemy cap: 60

## Points of Interest

| POI | Count | Symbol | Effect |
|-----|-------|--------|--------|
| Haven | 2-3 | 🏰 | Full rest (HP + Aether). Shop with 3-5 random tier 1+ items. |
| Camp | 4-6 | ⛺ | Partial rest: 50% HP + 50% Aether recovery. |
| Ruin | 3-5 | ⛫ | Lootable once: random tier 1-3 item + 5-20 gold. Spawns 1-3 enemies (50/50 Void Stalker or Flux Archer). |
| Breach | 3-4 | ֍ | Open breaches spawn enemies (15%/turn). Sealable after guardian defeated. |
| Maw | 1 | ✸ | Final objective. Placed preferentially rightward. Requires 2 sealed breaches + Unraveler defeated. |

### Haven Shop
- Stocks 3-5 random items from tier 1+ weapons, armors, and artifacts (excludes Maw Compass from shop pool)
- Sell items at 40% of buy price

## Equipment

### Weapons (7)
| Name | Type | Dmg | Range | Special | Price | Tier |
|------|------|-----|-------|---------|-------|------|
| Rusty Blade | Melee | 1 | — | — | Free | 0 |
| Void Cleaver | Melee | 7 | — | +2 vs chaos-spawned | 40 | 1 |
| Starforged Sword | Melee | 10 | — | — | 100 | 2 |
| Dimensional Edge | Melee | 12 | — | Cleave (hits adjacent enemies too) | 150 | 3 |
| Flux Bow | Ranged | 5 | 2 | — | 35 | 1 |
| Aether Lance | Ranged | 6 | 3 | Free ranged (no Aether cost) | 60 | 2 |
| Phase Rifle | Ranged | 8 | 5 | Ignores defense | 120 | 3 |

### Armors (5)
| Name | Def | Special | Price | Tier |
|------|-----|---------|-------|------|
| Worn Leather | 1 | — | Free | 0 |
| Warded Mail | 4 | +10 HP | 50 | 1 |
| Chaosweave Cloak | 3 | +2 vision | 45 | 1 |
| Starplate | 6 | -1 MP | 120 | 2 |
| Voidhide | 5 | Wraith immune | 100 | 3 |

### Artifacts (5)
| Name | Special | Price | Tier |
|------|---------|-------|------|
| Seer's Lens | +2 vision | 40 | 1 |
| Aether Crystal | +4 Aether | 50 | 1 |
| Vitality Stone | +3 HP/turn regen | 80 | 3 |
| Phase Anchor | Displacement immune | 35 | 1 |
| Maw Compass | Reveals Maw on map | 30 | 1 |

## Skills (10)

Restore is always equipped in slot 1. Other skills unlocked at levels 2, 4, 6, 8, 10. At each unlock, player picks 1 of 2 randomly offered skills they don't already have. 4 skill slots total.

| Skill | Cost | Target | Level | Effect |
|-------|------|--------|-------|--------|
| Restore | 0 + 2/hex | AoE Self (1+Lv/3) | 0 | Restore shattered terrain. 2 AE per hex. Grants 3 XP per hex. |
| Void Strike | 1 AE | Melee | 1 | weapon + Might + Warding damage. No counter-attack. |
| Phase Step | 2 AE | Teleport (3) | 2 | Teleport to visible hex within 3. Free action. |
| Cosmic Bolt | 2 AE | Ranged (4) | 2 | 8 + Warding ranged damage. |
| Warp Shield | 2 AE | Self | 4 | Absorb next hit. Lasts 3 turns. |
| Breach Pulse | 3 AE | AoE Self (2) | 4 | 5 + Warding damage to all enemies within 2. |
| Mending Light | 2 AE | Self | 6 | Heal 10 + Vigor*3 HP. |
| Gravity Well | 3 AE | AoE Self (3) | 6 | Pull enemies within 3 one hex closer. |
| Dimensional Rend | 4 AE | Melee | 8 | weapon damage * 3. Must be adjacent. |
| Starfall | 5 AE | AoE Self (3) | 10 | 15 + Warding*2 damage to all enemies within 3. |

## Turn Structure

1. **Player phase** — player clicks to select, then spends MP to move, can attack (melee by moving onto enemy, ranged by pressing R) and use skills (1-4 keys). Turn ends automatically at 0 MP, or manually via Space/E/End Turn button.
2. **Enemy phase** — natural HP regen (+1 HP) and Vitality Stone regen happen first, then Warp Shield countdown. Enemies animated sequentially (80ms per move, 150ms per attack). Each enemy: teleport check (Phase Wraith) → movement steps (per speed) → melee attack if adjacent → ranged attack if in range with LOS → boss spawning (Unraveler) → terrain shatter check (2% for chaos-spawned).
3. **Spawn phase** — open breaches roll 15% each for new enemy spawn. 2% chance for wildlife spawn (outside player vision, non-shattered hex). Turn counter increments. MP reset to full (or half if engaged).

## Engagement Mechanic

If the player starts a turn adjacent to any enemy, their MP is halved (minimum 1). This creates a meaningful decision: do you end your turn near an enemy to get melee access, knowing you'll have reduced mobility next turn? It punishes careless positioning and rewards tactical use of ranged attacks and skills to avoid being pinned down.

## Line of Sight

LOS is checked by walking the line between two hexes and testing for mountains. Used by ranged attacks, ranged skills, and enemy ranged fire. Mountains block LOS; all other terrain is transparent.

## Fog of War

- Vision radius: base 6 hexes, expandable by equipment (Chaosweave Cloak +2, Seer's Lens +2, stackable)
- Revealed hexes show terrain and POIs permanently (dimmed when not currently visible)
- Enemies only visible in current vision range
- Maw Compass artifact reveals the Maw POI on the map permanently

## Victory and Defeat

- **Victory**: Close at least 2 breaches, then defeat The Unraveler at the Maw and step on the Maw hex.
- **Defeat**: Player HP reaches 0.
- Endgame screen shows: turns played, level reached, enemies defeated, breaches sealed.

## Strategies

### Early Game (Levels 1-3)
Explore cautiously from starting haven. The Rusty Blade (1 damage) means early fights are slow — hunt wildlife for XP and gold while avoiding chaos-spawned enemies until you upgrade. Loot gold hexes for currency. Buy a weapon at the haven ASAP; even a Flux Bow (5 damage) transforms your combat ability. Avoid ruins until level 2+ since they spawn enemies on entry. Use Restore sparingly — it costs Aether you may need for combat skills later.

### Mid Game (Levels 4-6)
Assault the first breach. Use terrain tactically: forest for +1 defense when you expect to be attacked, hills for +1 ranged range. Clear ruins for equipment upgrades and gold. Close the first breach to reduce spawn pressure. The skill choice at level 4 is critical — Warp Shield for defensive play (absorbs one hit entirely), Breach Pulse for aggressive AoE clear.

### Late Game (Levels 7-10)
Close the second breach. Gear up for the Maw. Starfall (level 10) trivializes mob fights with 15 + 2*Warding AoE, but you may not have the XP patience to reach it. The Unraveler fight demands both damage output and sustain — pure Might builds lack healing, pure Warding builds lack kill speed. The Unraveler's dual attack (12 melee + 6 ranged at range 4), 6 defense, and Void Stalker spawning every 3 turns means you need to close quickly or get overwhelmed.

### Key Decisions
- **Melee vs Ranged build**: Melee (Might + melee weapon) does more single-target damage and benefits from Void Strike/Dimensional Rend. Ranged (Reflex + ranged weapon) avoids counter-attacks and kites safely but has lower burst. Phase Rifle ignoring defense makes it excellent against high-defense targets (Breach Guardian at 5 def, Unraveler at 6 def).
- **When to engage breaches**: Each sealed breach reduces spawn pressure but the guardian fight (50 HP, 10 atk, 8 ranged atk, 5 def) is dangerous. Under-geared attempts often end in death from the combination of melee and ranged attacks.
- **Starplate trade-off**: 6 defense is excellent but -1 MP (3 instead of 4) severely limits mobility. Best paired with Phase Step for repositioning.

### Anti-Strategies
- **Turtling near haven**: Breach spawns fill the map and shatter terrain. 60-enemy cap prevents infinite scaling, but the shattered wasteland left behind makes movement increasingly costly.
- **Ignoring breaches**: Even with the 60-enemy cap, the continuous spawning creates a target-rich environment that drains HP and Aether without strategic progress. Meanwhile shattered terrain accumulates, degrading map mobility.
- **Pure glass cannon**: High Might, no Vigor. Works until a Phase Wraith teleports adjacent and you eat a 7-damage attack with only 50 HP. The Unraveler's 12+6 dual attack will two-shot you.
- **Grinding Void Stalkers forever**: Polynomial XP curve makes this increasingly futile past level 5. Breaches and ruins give better returns for the risk.
- **Ignoring engagement**: Ending turns adjacent to enemies halves your MP next turn. Getting pinned between two enemies can cascade into a death spiral of reduced mobility.
