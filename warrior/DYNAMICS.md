# Game Dynamics

## Theme

The desperate ascent of a lone warrior through a world tearing itself apart from within. Not power fantasy — *survival escalation*. The land itself is sick — chaos bleeds from wounds in the earth, twisting creatures and corrupting terrain. You start weak and claw your way to relevance one fight at a time. The feeling: every level earned, every breach sealed, every piece of gear found feels like defiance against entropy.

## Key Drivers

### 1. Accumulation and Windfall
The core RPG loop. XP, loot, stats, skills — every encounter makes you measurably stronger. The polynomial XP curve makes early levels feel fast (quick wins, dopamine) and later levels require deliberate engagement with dangerous content (breaches, ruins). Windfalls come from: breach guardian drops (powerful gear), level-up full heals (instant relief), and finding a Dimensional Edge when you've been swinging a Rusty Blade for 20 turns.

### 2. Scarcity of Agency
5 MP per turn. 4 skill slots. Limited Aether. You can't fight everything, explore everything, or be everywhere. Every turn is a triage decision: push toward the next breach or retreat to heal? Spend Aether on Void Strike for guaranteed damage or save it for Mending Light? Move deeper into fog or consolidate revealed territory? The constraint makes each action feel weighty.

### 3. Guardianship
One character. One life. No party, no reserves. Every HP point matters because death is game over. Equipment becomes precious — not because of stats alone, but because *you* found it, *you* chose it, *you* survived with it. The player should mourn losing their Chaosweave Cloak to a shop upgrade.

## Secondary Drivers

### Escalating Commitment
Breaches bleed chaos into the world continuously, spawning twisted creatures. The longer you wait, the worse it gets. Sealing breaches is the only way to reduce pressure, but each is guarded by a powerful chaos-born entity. Standing still makes things worse — the game demands forward momentum.

### Readable Consequences
Yellow hexes show where you can go. Red hexes show what you can attack. Damage numbers are transparent (weapon + stat - defense). Enemy detection ranges, HP bars, and type letters tell you exactly what you're facing. No hidden information in combat — the fun comes from deciding what to do with full knowledge, not from surprises.

### Variable Reinforcement
Map generation, enemy placement, loot tables, skill unlock choices — every game is different. The two-skill choice at level-up means you're building a different character each run. Phase Step + Breach Pulse plays completely differently from Cosmic Bolt + Warp Shield.

### Near-Miss Architecture
The polynomial XP curve and breach escalation create a natural tension point around levels 5-7. You're strong enough to challenge breaches but not strong enough to be comfortable. The Maw requires 2 closed breaches, which means at least 2 guardian fights. If you're under-leveled when you attempt the Breach, you'll *almost* win — close enough to see how, which drives the "one more game" loop.

## Map

- Rectangular hex grid (60 columns x 40 rows), pointy-top hexes
- Generated via diamond-square heightmap, then terrain assigned by elevation percentile
- Terrain distribution: 25% water, 50% plains, 10% forest, 10% hills, 1% gold, 2% quarry, 5% mountains
- Edge hexes are always water
- Points of interest placed with minimum distance constraints

## Terrain Movement Costs

| Terrain  | Cost       | Combat Effect |
|----------|------------|---------------|
| Plains   | 1          | None |
| Forest   | 2          | +1 defense |
| Hills    | 2          | +1 ranged range |
| Gold     | 1          | Lootable (10 gold, one-time) |
| Quarry   | 2          | None |
| Water    | Impassable | — |
| Mountain | Impassable | Blocks line of sight |

## Player

- Starts at a randomly chosen haven on the left side of the map
- 5 Movement Points (MP) per turn
- Can spend MP across multiple moves within a single turn
- 4 stats: Might, Reflex, Warding, Vigor (starting 3/3/2/3)
- Resources: HP, Aether, MP
- 4 active skill slots, 3 equipment slots

## Enemies

- 5 chaos-twisted enemy types with distinct behaviors (Void Stalker, Breach Crawler, Flux Archer, Phase Wraith, Breach Guardian)
- 1 final boss (The Unraveler) — chaos incarnate at the Maw
- Enemies detect the player within type-specific ranges and pursue using A*
- Outside detection range, enemies wander randomly (50% chance to skip)
- Open breaches bleed new enemies into the world (15% per turn per breach, cap 20 total)

## Turn Structure

1. **Player phase** — player spends MP to move, can attack (melee by moving onto enemy, ranged by targeting) and use skills
2. **Enemy phase** — all enemies move then attack, animated sequentially
3. **Spawn phase** — breach spawning rolls, turn counter increments

## Victory

- Close at least 2 breaches, then defeat The Unraveler at the Maw

## Defeat

- Player HP reaches 0

## Strategies

### Early Game (Levels 1-3)
Explore cautiously from starting haven. Loot gold hexes for currency. Fight Void Stalkers for XP — they're fast but fragile. Avoid ruins until level 2+. Buy a Flux Bow at the haven if possible to gain ranged capability early.

### Mid Game (Levels 4-6)
Assault the first breach. Use terrain (forest for defense, hills for range) tactically. Clear ruins for equipment upgrades. Close the first breach to reduce spawn pressure. The skill choice at level 4 is critical — Warp Shield for defensive play, Breach Pulse for aggressive.

### Late Game (Levels 7-10)
Close the second breach. Gear up for the Breach. Starfall (level 10) trivializes mob fights but you may not have the XP patience to reach it. The Unraveler fight demands both damage output and sustain — pure Might builds lack healing, pure Warding builds lack kill speed.

### Anti-Strategies
- **Turtling near haven**: Breach spawns escalate, filling the map with enemies. Standing still gets worse, not better.
- **Ignoring breaches**: The 20-enemy cap prevents infinite scaling, but 20 enemies with no breaches closed means a miserable slog to the Breach.
- **Pure glass cannon**: High Might, no Vigor. Works until a Phase Wraith teleports adjacent and you die in one exchange.
- **Grinding Void Stalkers forever**: Polynomial XP curve makes this increasingly futile past level 5. Breachs and ruins give better returns.
