# Monster Gladiators — Game Dynamics

Reference for the gameplay systems, mechanics, and flow of MGLAD. Based on the original Turbo C++ source code (September 1992).

## Game Loop

The top-level loop repeats until the player promotes, demotes, or quits:

```
setup_guys -> gen_list -> loop { do_buy -> do_combat -> restore_guys -> show_standings -> promote_guys }
```

Each iteration of the loop is one **arena round**: a buy phase, a combat, stat adjustments, and a promotion check.

## Arena Structure

An arena holds a ranked roster of 8 gladiators. One is the human player (always starts in position 8, last place). The rest are AI-generated.

### Arena Parameters

| Parameter     | Default | Description                                    |
|---------------|---------|------------------------------------------------|
| `min_pop`     | -5      | Popularity floor — below this, demoted/removed |
| `max_pop`     | 25      | Popularity ceiling — above this, promoted       |
| `mult_pop`    | 2       | Popularity multiplier for placement rewards     |
| `base_points` | 30      | Base stat points for generating AI gladiators   |
| `base_var`    | 6       | Variance when randomizing AI stats              |
| `pt_cost`     | 100     | Credits per stat point (upgrade currency rate)  |
| `pop_reward`  | 40      | Multiplier for converting popularity to gold    |

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
| Weapon  | 2    | Flat bonus to attack rolls                |
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

A gladiator's total point cost: `skill*1 + str*2 + health*1 + weapon*2 + armor*3`

## Character Archetypes

10 base templates that AI gladiators are randomly assigned from:

| Name       | Skill | Str | Health | Weapon | Armor | Points | Style              |
|------------|-------|-----|--------|--------|-------|--------|--------------------|
| Standard   | 20    | 10  | 12     | 9      | 6     | 78     | Balanced           |
| Rock       | 14    | 14  | 15     | 14     | 3     | 80     | Durable attacker   |
| Brick      | 15    | 14  | 15     | 4      | 9     | 78     | Defensive tank     |
| Speedster  | 31    | 6   | 8      | 7      | 0     | 57     | Fast glass cannon  |
| Master     | 33    | 6   | 20     | 18     | 0     | 101    | Skilled elite      |
| Wall       | 12    | 12  | 18     | 4      | 12    | 86     | Heavy defense      |
| Slasher    | 10    | 8   | 10     | 24     | 0     | 74     | Pure weapon damage |
| Specialist | 64    | 4   | 10     | 4      | 0     | 90     | Extreme skill      |
| Monster    | 15    | 15  | 17     | 14     | 3     | 83     | Tough brawler      |
| Strongman  | 25    | 24  | 15     | 6      | 0     | 100    | Raw power          |

Player starts as: Skill 6, Str 4, Health 5, Weapon 0, Armor 0 (21 points).

## AI Generation

When creating an AI gladiator (`rand_guy`):

1. Pick a random archetype from the base list
2. Scale stats proportionally to `base_points` (default 30) minus a variance buffer
3. Add random bonus to each stat (0 to `base_var / cost`)
4. Set initial popularity: average of two rolls in `[min_pop, max_pop]`, divided by 3
5. Set initial gold: random `[0, pt_cost]`

The character display uses the first letter of their archetype name and a random foreground+background color.

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

The arena is a 19x19 grid. One of four map types is randomly chosen:

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

Gladiators are placed at random non-blocked positions, biased toward the edges (`rnd_revcent`).

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

The AI (`move_computer`) follows a simple priority system:

1. **Adjacent enemy exists?**
   - Calculate `ra = att + weapon` vs `rd = target.att + target.armor`
   - If fatigued (`att < att0`) AND outmatched (`ra < rd - 1`): **rest/guard**
   - Otherwise, roll `random(0, ra)` vs `random(0, rd)`:
     - If attacker's roll is lower: **shift position** (move to a different adjacent square)
     - Otherwise: **attack**

2. **No adjacent enemy:**
   - Find the **closest** living gladiator (Manhattan distance)
   - **Move** one step toward them

The AI has no long-term planning, no terrain awareness, and no coordination. It simply moves toward the nearest enemy and attacks when adjacent, with a self-preservation instinct to rest when outmatched.

## Economy

### Earning Credits

After combat, gladiators are ranked by survival order (last alive = 1st place). Rewards:

```
pop += place_value * mult_pop    (place_value: 4 for 1st, 3 for 2nd, etc.)
gold += sqrt(pop) * POP_REWARD   (only if pop > 0)
```

AI gladiators with less than `PT_COST` (100) gold get a free top-up to 100.

### Spending Credits (Human Player)

Before each combat, the player chooses from:

| Option                    | Cost   | Stat Points |
|---------------------------|--------|-------------|
| Train in Gym              | Free   | 1           |
| Extensive Training        | 200    | 2           |
| Hire a Trainer            | 300    | 3           |
| Outpatient Bioengineering | 500    | 5           |
| Minor Bioengineering      | 800    | 9           |
| Major Bioengineering      | 1200   | 14          |
| Buy Passage               | 1000   | (skip tier) |

Stat points are spent on Skill (cost 1), Strength (cost 2), or Health (cost 1). Weapon and Armor are not directly purchasable — they only come from the base archetype scaling.

### Between-Fight Stat Adjustment (AI)

After each combat, all AI gladiators are adjusted:

1. Calculate current point value
2. Lose 5% of points to "wear and tear" (scale to 90% of current)
3. Gain points from gold: `gold / pt_cost` additional stat points
4. Points are randomly distributed across all 5 stats using `modify()`
5. Remaining gold (modulo `pt_cost`) is kept

This creates a progression treadmill — gladiators slowly grow stronger as they accumulate gold from popularity, but lose ground from combat attrition.

## Ranking

The roster is an ordered array. Position determines display order (pyramid standings) and placement rewards. Rankings change by:

- **Killing** another gladiator moves the killer ahead of the victim in the list
- **Promotion** (exceeding `max_pop`) removes the #1 gladiator and shifts everyone up
- **Demotion** (below `min_pop`) removes the gladiator and shifts everyone up

The standings are displayed as a pyramid: #1 at the top, then #2-3, then #4-8 at the bottom.

## Display

The game renders in **text mode** (80x25, 16-color ANSI). Each gladiator is shown as a single character (first letter of their archetype name) with a random foreground/background color combination.

Key UI regions:
- **Map area** (left): 19x19 combat grid
- **Stat panels** (right): Two stat windows showing attacker and defender during combat
- **Combat roster** (right): List of all gladiators with health/attack bars
- **Pyramid** (between fights): Visual ranking display
- **Kill timer**: Countdown displayed at bottom during combat

## Unfinished Systems

Several systems are stubbed but not implemented:

- **`world_t`** class (commented out in M_ARENA.H) — would have defined multiple arenas as tiers within a world, with different events
- **`passage()`** and **`demote()`** — empty function bodies
- **`awakening()`** — empty; appears to be a game intro
- **`global_t`** — empty struct placeholder
- **EGA graphical mode** — sprite assets (GUYS.EGA, TERRAIN.EGA) exist but the game runs in text mode only
- **Name generation** — chart-based name builder is commented out in `rand_guy()`; gladiators use archetype names instead
