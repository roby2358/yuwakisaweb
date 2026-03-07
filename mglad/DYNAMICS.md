# Monster Gladiators — Game Dynamics

Reference for the gameplay systems, mechanics, and flow of MGLAD. Originally based on the Turbo C++ source code (September 1992), now updated for the hex-based sprite version.

## Game Loop

The top-level loop repeats until the player promotes, demotes, or quits:

```
setup_guys -> gen_list -> loop { do_buy -> do_combat -> restore_guys -> show_standings -> promote_guys }
```

Each iteration of the loop is one **arena round**: a buy phase, a combat, stat adjustments, and a promotion check.

## Arena Structure

An arena holds a ranked roster of 8 gladiators, sorted by popularity (highest first). One is the human player (starts at the bottom). The rest are AI-generated.

### Arena Parameters

| Parameter     | Default | Description                                    |
|---------------|---------|------------------------------------------------|
| `min_pop`     | -5      | Popularity floor — below this, demoted/removed |
| `max_pop`     | 50      | Popularity ceiling — above this, promoted       |
| `mult_pop`    | 2       | Popularity multiplier for placement rewards     |
| `base_points` | 30      | Base stat points for generating AI gladiators   |
| `base_var`    | 6       | Variance when randomizing AI stats              |
| `pt_cost`     | 100     | Credits per stat point (upgrade currency rate)  |
| `pop_reward`  | 120     | Multiplier for converting popularity to gold    |

### Promotion and Demotion

After each combat:
- The **#1 ranked** gladiator is checked: if `pop >= max_pop`, they advance to the next tier. If it's the player, the game ends with `AR_PROMOTE`. If AI, they're removed and a replacement is generated at the bottom.
- **All gladiators** are checked: if `pop <= min_pop`, they're sent back. If it's the player, the game ends with `AR_DEMOTE`. If AI, they're replaced.

The player can also buy a **passage** (1000 credits) to skip to the next tier.

## Character Stats

### Base Attributes (stat_t)

| Stat    | Cost | Description                              |
|---------|------|------------------------------------------|
| Skill   | 1    | Attack accuracy, speed calculation        |
| Str     | 2    | Damage bonus, fatigue recovery            |
| Health  | 1    | Hit points, determines survivability      |
| Weapon  | 3    | Flat bonus to attack rolls                |
| Armor   | 3    | Flat bonus to defense rolls, damage soak  |

### Derived Attributes

| Attribute | Formula                            | Description                          |
|-----------|------------------------------------|--------------------------------------|
| `att`     | `skill + str`                      | Base attack value (current stamina)  |
| `att0`    | `skill + str`                      | Max attack (full stamina)            |
| `speed`   | `60 * points / (skill * str)`, clamped 10-30 | Ticks per action (lower = faster) |
| `att_str` | `(att0 + 7 + weapon + armor) / 2`  | Display-only combat power rating     |

**Speed** is inversely related to stat efficiency: a gladiator with high skill and strength relative to total points is faster. The `calc_speed()` formula rewards specialists over generalists.

### Point Value

A gladiator's total point cost: `skill*1 + str*2 + health*1 + weapon*3 + armor*3`

## Character Archetypes

10 base templates that AI gladiators are randomly assigned from:

| Name       | Skill | Str | Health | Weapon | Armor | Points | Style              |
|------------|-------|-----|--------|--------|-------|--------|--------------------|
| Standard   | 20    | 10  | 12     | 9      | 6     | 97     | Balanced           |
| Rock       | 14    | 14  | 15     | 14     | 3     | 108    | Durable attacker   |
| Brick      | 15    | 14  | 15     | 4      | 9     | 97     | Defensive tank     |
| Speedster  | 31    | 6   | 8      | 7      | 0     | 72     | Fast glass cannon  |
| Master     | 33    | 6   | 20     | 18     | 0     | 119    | Skilled elite      |
| Wall       | 12    | 12  | 18     | 4      | 12    | 102    | Heavy defense      |
| Slasher    | 10    | 8   | 10     | 24     | 0     | 108    | Pure weapon damage |
| Specialist | 64    | 4   | 10     | 4      | 0     | 94     | Extreme skill      |
| Monster    | 15    | 15  | 17     | 14     | 3     | 113    | Tough brawler      |
| Strongman  | 25    | 24  | 15     | 6      | 0     | 106    | Raw power          |

Player starts as: Skill 6, Str 4, Health 5, Weapon 0, Armor 0 (19 points).

## AI Generation

When creating an AI gladiator (`randGuy`):

1. Pick a random archetype from the base list
2. Scale stats proportionally to `base_points` (default 30) minus a variance buffer
3. Add random bonus to each stat (0 to `base_var / cost`)
4. Set initial popularity: average of two rolls in `[min_pop, max_pop]`, divided by 3
5. Set initial gold: random `[0, pt_cost]`

Each gladiator gets a sprite from their archetype's row in `monsters.png` (random pose column) and a random bright color from the EGA palette (indices 8-15) for their hex tint.

## Time System

Combat uses a **tick-based initiative** system, not strict turns.

Each gladiator has a `time` counter. Each tick cycle:
1. Find the minimum `time` across all living gladiators
2. Subtract that minimum from everyone's `time`
3. Any gladiator whose `time` reaches 0 gets to act
4. After acting, their `time` is advanced based on action and speed

### Time Costs

```
advance_time(ticks) = time += ticks * (speed + ATT_SLOW - ATT_SLOW * att / att0)
```

Where `ATT_SLOW = 10`. A fatigued gladiator (low `att` relative to `att0`) takes longer between actions. At full stamina the penalty is 0; at near-zero stamina, each tick costs an extra 10.

| Action  | Base Ticks | Notes                                    |
|---------|------------|------------------------------------------|
| Move    | 1          | Plus fatigue penalty; may recover stamina |
| Attack  | 2          | Stamina decreases by 1                   |
| Defend  | 0          | Only stamina loss, no time advance        |
| Rest    | 2          | Recovers `(att0 - att + 1) / 2` stamina  |

## Combat System

### Map

The arena is a 19x19 **hexagonal** grid (pointy-top, odd-r offset). One of four map types is randomly chosen:

| Map     | Character                                  |
|---------|--------------------------------------------|
| Forest  | Trees, bushes, rocks, pools — dense cover  |
| Arena   | Sand floor, dark/light wall border          |
| Ruins   | Walls, columns, rocks on sand              |
| Rocky   | Rocks, bushes, sand patches                |

Terrain types and their properties:

| Terrain  | Blocks Movement | Notes                  |
|----------|-----------------|------------------------|
| Clear    | No              | Can have blood         |
| Sand     | No              | Decorative             |
| Bush     | No              | Passable terrain       |
| Blood    | No              | Left when gladiator dies |
| Tree     | Yes             | Obstacle               |
| Rock     | Yes             | Obstacle               |
| Pool     | Yes             | Obstacle               |
| Column   | Yes             | Obstacle               |
| Lt Wall  | Yes             | Obstacle               |
| Dk Wall  | Yes             | Obstacle               |

Gladiators are placed at random non-blocked positions, biased toward the edges (`rndRevcent`).

### Movement

Movement uses 6 hex directions:

| Key | Direction |
|-----|-----------|
| Q   | NW        |
| E   | NE        |
| A   | W         |
| D   | E         |
| Z   | SW        |
| C   | SE        |
| S   | Rest      |

W/X (or arrow keys) are used for menu navigation.

### Kill Timer

A global `rounds` counter increments each tick cycle. It resets to 0 whenever any gladiator kills another. If `rounds` reaches 1200 without a kill, **all remaining gladiators are killed** — a forced draw that ends combat. This prevents stalemates.

### Attack Resolution

When gladiator A attacks defender D:

```
roll_attack  = d6 + random(0, A.att) + A.weapon
roll_defense = d6 + random(0, D.att) / 2 + D.armor
```

**If attack >= defense (hit):**
- Damage = `(roll_attack - roll_defense) / 2 + A.str + A.weapon - D.armor`
- Defender loses that much `att` (stamina)
- If `att` drops below 1: lose 1 health, restore `att` by `random(1, health0 + health)`
- This can cascade — multiple health lost in one hit if damage is extreme
- At 0 health: death

**If attack < defense (miss):**
- Attacker loses stamina: `att += roll_attack - roll_defense + str - 1`
- Clamped to `[1, att0]`
- High strength reduces the miss penalty

**After resolution:**
- Defender loses 1 `att` (defend fatigue), no time advance
- If the kill lands, attacker gains +1 popularity and is promoted in the ranked list ahead of the victim

### Stamina Recovery (rest)

Recovery depends on the action state:

| State   | Recovery                                         |
|---------|--------------------------------------------------|
| Rest    | `att += (att0 - att + 1) / 2` — fast recovery   |
| Move    | If `random(0, skill) < str`: `att += (att0 - att + 1) / 3` |
| Attack  | `att -= 1` — net loss                            |
| Defend  | `att -= 1` — net loss                            |
| Hit     | `att += random(1, health0)` — bounce-back        |

Stamina is always clamped to `[1, att0]`.

## AI Behavior

The AI (`moveComputer`) follows a simple priority system:

1. **Adjacent enemy exists?**
   - Calculate `ra = att + weapon` vs `rd = target.att + target.armor`
   - If fatigued (`att < att0`) AND outmatched (`ra < rd - 1`): **rest/guard**
   - Otherwise, roll `random(0, ra)` vs `random(0, rd)`:
     - If attacker's roll is lower: **shift position** — move to an adjacent hex, preferring directions aligned with the target (sorted by cube-coordinate dot product)
     - Otherwise: **attack**

2. **No adjacent enemy:**
   - Find the **closest** living gladiator (hex distance)
   - Use **BFS pathfinding** to find the shortest walkable path, avoiding blocked terrain and occupied hexes (the goal hex is treated as passable so paths can reach adjacent-to-target positions)
   - **Move** one step along the BFS path

### Targeting Bias

When multiple enemies are equally valid (adjacent or equidistant), the AI targets the one with the **lowest array index** — which corresponds to the **highest-ranked** gladiator, since the roster is sorted by popularity. This creates natural pressure on top-ranked gladiators: the more popular you are, the more you get targeted.

The AI has no long-term planning and no coordination. It uses BFS to navigate around terrain obstacles, moves toward the nearest enemy, and attacks when adjacent, with a self-preservation instinct to rest when outmatched.

## Economy

### Earning Credits

After combat, gladiators are ranked by survival order (last alive = 1st place). Rewards:

```
pop += place_value * mult_pop    (place_value: 4 for 1st, 3 for 2nd, etc.)
gold += sqrt(pop) * POP_REWARD   (only if pop > 0)
```

AI gladiators with less than `PT_COST` (100) gold get a free top-up to 100.

### Spending Credits (Human Player)

Before each combat, the player chooses a training option. Points are added to a persistent pool (`guy.pts`) — unspent points carry over across rounds. After purchasing, the player is taken to the stat allocation screen, then proceeds to the fight.

| Option                    | Cost   | Points | Allowed Stats                    |
|---------------------------|--------|--------|----------------------------------|
| Train in Gym              | Free   | 1      | Skill, Str, Health               |
| Extensive Training        | 200    | 3      | Skill, Str, Health               |
| Outpatient Bioengineering | 300    | 4      | Skill, Str, Health, Weapon, Armor|
| Bioweapon Specialist      | 200    | 3      | Weapon only                      |
| Armor Engineering         | 200    | 3      | Armor only                       |
| Minor Bioengineering      | 500    | 7      | Skill, Str, Health, Weapon, Armor|
| Major Bioengineering      | 800    | 11     | Skill, Str, Health, Weapon, Armor|
| Buy Passage               | 1000   | —      | (skip to next tier)              |
| Quit                      | Free   | —      | (end game)                       |

In the stat allocation screen, points are spent per-stat at their cost (Skill 1, Str 2, Health 1, Weapon 3, Armor 3). The screen auto-exits when remaining points are insufficient for any available stat. The player can also exit early via the "Done" option.

### Between-Fight Stat Adjustment (AI)

After each combat, all AI gladiators are adjusted:

1. Calculate current point value
2. Lose 5% of points to "wear and tear" (scale to 90% of current)
3. Gain points from gold: `gold / pt_cost` additional stat points
4. Points are randomly distributed across all 5 stats using `modify()`
5. Remaining gold (modulo `pt_cost`) is kept

This creates a progression treadmill — gladiators slowly grow stronger as they accumulate gold from popularity, but lose ground from combat attrition.

## Ranking

The roster is sorted by **popularity** (highest first). This determines display order, placement rewards, and AI targeting priority. Rankings change by:

- **Killing** another gladiator moves the killer ahead of the victim in the list
- **Promotion** (exceeding `max_pop`) removes the #1 gladiator and shifts everyone up
- **Demotion** (below `min_pop`) removes the gladiator and shifts everyone up
- **Between rounds**, the roster is re-sorted by popularity

The standings are displayed as a pyramid: #1 at the top, then #2-3, then #4-8 at the bottom.

## Display

The game renders with **32x32 sprites on a hexagonal grid** using HTML5 canvas, with HTML/CSS panels for UI.

Each gladiator is shown as a black silhouette (from their archetype's sprite row) with a colored hex tint from the EGA palette.

### Sprite Sheets

- **`monsters.png`** (320x320): 10x10 grid. One row per archetype, 10 pose variations. Black silhouettes on silver background (silver removed at load time).
- **`terrain.png`** (320x320): 10x10 grid. One row per terrain type, 10 variations.
- **`effects.png`** (192x192): 6x6 grid. Two rows per effect type: miss (rows 0-1, shown on target), hit (rows 2-3, shown on target), rest/shield (rows 4-5, shown on self).

### UI Regions

- **Hex map** (left): 19x19 hex combat grid on canvas
- **Stat panels** (right sidebar): Two stat panels showing attacker and defender during combat
- **Attack info** (right sidebar): Hit/miss detail with comparative bars
- **Combat roster** (right sidebar): List of all gladiators with health/attack bars
- **Kill timer** (right sidebar): Countdown during combat
- **Overlay panels**: Full-screen overlays for title, buy phase, stat upgrades, standings pyramid, rewards, and promotion/demotion messages

## Unfinished Systems

Several systems from the original C++ source are stubbed but not implemented:

- **`world_t`** class — would have defined multiple arenas as tiers within a world, with different events
- **`passage()`** and **`demote()`** — empty function bodies in the original
- **`awakening()`** — empty; appears to be a game intro
- **Name generation** — chart-based name builder was commented out in the original; gladiators use archetype names instead
