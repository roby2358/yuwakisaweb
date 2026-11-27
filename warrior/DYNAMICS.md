# Game Dynamics

## Theme

The desperate ascent of a lone warrior through a world tearing itself apart from within. Not power fantasy — *survival escalation*. The land itself is sick — chaos bleeds from wounds in the earth, twisting creatures and corrupting terrain. Chaos-spawned enemies literally shatter the ground they walk on, turning fertile plains into broken wastelands. You start weak and claw your way to relevance one fight at a time. The feeling: every level earned, every breach sealed, every hex restored feels like defiance against entropy.

Names in CAPS are tunable constants. Where the code has a named constant, that is its name; where the code still has an inline number, the name is the one ONTOLOGY.md §6 gives it. Values live in ONTOLOGY.md §6 and the code, not here.

## Key Drivers

### 1. Accumulation and Windfall
The core RPG loop. XP, loot, stats, skills — every encounter makes you measurably stronger. The polynomial XP curve (`xpForLevel`: 50 × level^1.8, rounded to the nearest 10, up to LEVEL_CAP) makes early levels feel fast (quick wins, dopamine) and later levels require deliberate engagement with dangerous content (breaches, ruins, the strong wildlife near the Maw). Windfalls come from: breach guardian and crawler drops (a few mundane items and a small chance of a magic one), sealing a breach (a big gold purse, mundane gear and a magic item), level-up full heals (instant relief), ruin loot (mundane items, a magic item and gold), the hidden prize on a sparkling special hex (gold, a skill gem or a magic item), the Wise Man's occasional gift of a magic item, and finding a powerful weapon when you've been swinging a Rusty Blade for 20 turns. Killing chaos-spawned enemies returns +1 Aether, creating a sustain loop that rewards aggression. With procedurally generated magical equipment, a per-run deal of skills (half the optional skills held out) and a fresh set of wildlife each run, each run produces a meaningfully different character build.

### 2. Scarcity of Agency
`PLAYER_MP` movement points per turn. `SKILL_SLOTS` hotbar slots, and a small budget of Skill Points (SP) that decides how many learned skills are trained and at what rank. Limited Aether. You can't fight everything, explore everything, or be everywhere. Every turn is a triage decision: push toward the next breach or retreat to heal? Spend Aether on Void Strike or save it for Mending Light? Spend your SP widening your kit or deepening one skill's rank? Restore shattered terrain now, or keep moving? Move deeper into fog or consolidate revealed territory? The constraint makes each action feel weighty. Most attacks and skills spend all your remaining MP, so the order of move, strike and cast within a turn matters. Engagement halves your MP, compounding the scarcity when you're in the thick of it. Skill usage restrictions add another layer: non-combat and pristine skills require safety, forcing you to choose *when* to use them.

### 3. Guardianship
One character. One life. No party, no reserves. Every HP point matters because death is game over. Equipment becomes precious — not because of stats alone, but because *you* found it, *you* chose it, *you* survived with it. The player should mourn losing a favored piece of gear to a shop upgrade. Terrain health matters too — the land you've restored is territory you've defended, and the settlements near it reward you for it.

## Secondary Drivers

### Escalating Commitment
Breaches bleed chaos into the world continuously: each open breach has a BREACH_SPAWN_CHANCE per turn to spawn a twisted creature beside it (weighted toward Void Stalkers, then Flux Archers, with Breach Crawlers and Phase Wraiths rarer; wraiths stop spawning at WRAITH_CAP). Spawning pauses while the chaos on the map adds up to CHAOS_MIGHT_CAP total attack. The longer you wait, the worse it gets. Meanwhile, chaos-spawned enemies shatter terrain as they move (SHATTER_CHANCE per enemy per turn), increasing movement costs and degrading the map, and chaos standing on corrupted ground hits harder, defends better and heals. Sealing breaches is the only way to reduce pressure, but each is guarded by a Breach Guardian, and a guardian re-forms at an unguarded, unsealed breach (GUARDIAN_RESPAWN_CHANCE per turn) if you leave it ready but unsealed. Standing still makes things worse — the game demands forward momentum.

### Readable Consequences
Yellow hexes show where you can go. Red hexes show what you can attack, marked with a sword (melee), crosshair (ranged) or starburst (area skill). Blue hexes show where a movement skill can land. Counter stats (attack-defense bottom-left, movement bottom-right) tell you exactly what you're facing. HP bars and type labels are visible, and ranged enemies carry an amber arrow badge in the token's top-right corner so ranged threats read without hovering; a stunned enemy shows a grey disc. Damage and healing float up from the hex where they happen. The player counter's label turns dark during player phase and gold-tinted during enemy phase — a glanceable indicator of whose turn it is. The ranged slot (R) on the skill bar makes ranged attacks discoverable. Skill usage categories (pristine/non-combat/anytime) are reflected in the skill bar — grayed out when conditions aren't met. Ground Weeps provides a full-map threat heatmap for strategic planning.

### Variable Reinforcement
Map generation (diamond-square heightmap), enemy placement, wildlife, loot tables, skill discovery — every game is different. Half the optional skills are held out each run (see Skill Groups) and a successful Skill Seek offers up to 3 (pick 1), so the player builds a different character each run. Wise Man huts (`HUT_COUNT` per map) add another source of skill discovery: each hut starts with its own distinct optional skill and keeps teaching (`HUT_REROLL_CHANCE`, rolled once per turn you visit, that a hut whose skill you know digs up a new one, and an independent `HUT_GIFT_CHANCE` that the sage hands over a magic item instead of a lesson). Skill gems drop most often when your SP is about half full (`GEM_DROP_PEAK_CHANCE`). The procedurally generated equipment means upgrade paths vary dramatically. Prospect's chance to strike gold and Skill Seek's rank-scaled gamble add controlled variance to non-combat play.

### Near-Miss Architecture
The polynomial XP curve and breach escalation create a natural tension point around levels 5-7. You're strong enough to challenge breaches but not strong enough to be comfortable. The Maw can't be sealed until every breach is sealed (a guardian fight for each), the Unraveler has fallen, and a Restore beside the Maw wins its MAW_SEAL_CHANCE roll — and enemies near the Maw grow stronger the closer they stand to it. If you're under-leveled when you attempt the Maw, you'll *almost* win — close enough to see how, which drives the "one more game" loop.

## Map

- Rectangular hex grid (`MAP_COLS` × `MAP_ROWS`), pointy-top hexes, axial coordinates (q, r)
- Generated via diamond-square heightmap (HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS), then terrain assigned by elevation percentile: water below WATER_PCT, plains below PLAINS_PCT, hills below HILLS_PCT, mountains above
- FOREST_SHARE of the interior is carved from plains into forest, QUARRY_SHARE from hills into quarry, and PRIZE_SHARE becomes sparkling special hexes (split across plains, forest and hills) that each hide a prize
- Edge hexes are always water
- Points of interest placed with a minimum distance constraint (POI_MIN_DIST); scrolls and garrisons come later and are exempt
- Map validated on generation (up to MAP_ATTEMPTS tries): every haven must reach the Maw on foot, and at least half the havens must lie far from it
- The player starts at the haven or village farthest from the Maw by movement cost (never one on a hills hex)

## Terrain

| Terrain  | Move Cost  | Combat Effect | Notes |
|----------|------------|---------------|-------|
| Plains   | 1          | None | Bulk of playable map |
| Forest   | 2          | +1 defense | Carved from plains. Hides you: enemies' aggro range shrinks (FOREST_STEALTH) |
| Hills    | 2          | +1 ranged range | Elevation band above plains |
| Quarry   | 2          | None | Carved from hills during generation |
| Verdant Glade / Hallowed Grove / Gilded Rise | as plains / forest / hills | as plains / forest / hills | Special (prize) hexes, marked with a sparkle until their prize is taken |
| Ruins    | 2          | +1 ranged range | Ruin POI terrain |
| Water    | Impassable | — | All edges; Water Skip crosses it |
| Mountain | Impassable | Blocks line of sight | Highest elevation band; Mountain Skip crosses it |
| Breach / Maw | Impassable | — | Chaos rifts. A sealed one becomes Hills |
| Shattered Plains | 2 | None | Created by chaos corruption |
| Shattered Forest | 3 | +1 defense | Shattered but still provides cover |
| Shattered Hills | 3 | +1 ranged range | Shattered but still elevated |
| Shattered Quarry | 3 | None | Created by chaos corruption |
| Distressed Plains | 1 | None | Near shattered terrain, same costs as normal |
| Distressed Forest | 2 | +1 defense | Near shattered terrain, same costs as normal |
| Distressed Hills | 2 | +1 ranged range | Near shattered terrain, same costs as normal |
| Distressed Quarry | 2 | None | Near shattered terrain, same costs as normal |

Havens and villages cost SETTLEMENT_MOVE_COST to enter whatever lies beneath. The `strider` passive makes every passable hex cost 1. Shattered and distressed hexes count as chaos terrain: chaos enemies standing on them gain CORRUPT_ATTACK and CORRUPT_DEFENSE and regenerate CORRUPT_REGEN HP a turn, and some of the player's passives (chaos_attune, chaos_defense, chaos_circlet) switch on there.

### Gold Deposits
Each hex has a `goldDeposit` integer (default 0). When the player steps on a hex with `goldDeposit > 0`, they collect it and it drops to 0. There is no gold terrain; deposits come from:
- **Prize hexes**: most special hexes hide a deposit (PRIZE_GOLD); the rest hide a skill gem or a magic item. All look alike until claimed.
- **Prospect**: reveals deposits nearby, with a chance to strike a new one close by.
- **Salvage**: restores adjacent shattered hexes and leaves a small deposit on each.
- **Crops**: Bountiful Harvest sprouts them on healthy hexes, and entering a village can sprout one next to it (VILLAGE_CROP_CHANCE). A crop is a small deposit that also heals a little (a tenth of max HP) when eaten.

Revealed deposits show a coin icon (crops show their crop). Other gold comes from kills, Loot, ruins, sealed breaches, Restore (a small chance per hex), and settlement rewards for restoring the land near a haven or village or killing the monsters that prowl it.

### Terrain Corruption Spread
Chaos-spawned enemies have a SHATTER_CHANCE per turn to shatter the terrain they occupy, converting it to the shattered variant (+1 movement cost). When terrain shatters, all hexes within SHATTER_RADIUS become **distressed** — visually degraded (muted greenish/brownish grays) but mechanically identical to normal terrain for movement. Each hex tracks a `shatteredCount` — how many shattered hexes are within that radius. Havens and villages never shatter or distress. Special hexes, ruins, water and mountains have no shattered form.

Shattered terrain is visually distinct (dark red tones) and distressed terrain shows the corruption's reach. Restore and Salvage reverse shattering: they restore shattered hexes, decrement nearby shatteredCounts, and any distressed hex that drops to 0 reverts to normal. Restored hexes that are still near other shattered hexes become distressed instead of fully normal.

## Player

- Starts at the settlement farthest from the Maw (see Map)
- `PLAYER_MP` Movement Points per turn (halved, minimum 1, when engaged — adjacent to an enemy at turn start), changed by mp_bonus passives and high_def_mp_penalty armor
- 4 stats: Might, Reflex, Warding, Vigor (start at `STARTING_STATS`)
- HP = `maxHP`: 50 + Vigor × 10, using Vigor with vigor_bonus (plus hp_bonus passives)
- Aether = `maxAether`: 5 + Warding × 2 (plus aether_bonus passives)
- Vision = `BASE_VISION` hexes (expandable with vision_bonus)
- `STAT_POINTS_PER_LEVEL` stat points per level-up (allocated freely, or left for later on the Character panel)
- Skill Points: start with `STARTING_SP`; +1 per level-up, +1 on the first visit to each haven and each hut, +1 from each skill gem (capped at MAX_SP; past the cap a gem gives `CONSOLATION_XP` instead). Levelling never grants a skill: skills come only from Wise Man huts, Skill Seek, scrolls and the Magicsmith, so levelling doesn't drain the run's small learnable pool
- `SKILL_SLOTS` hotbar slots, 3 equipment slots (weapon, armor, artifact)
- Starts with Rusty Blade (1 melee damage) and Worn Leather (1 defense) equipped, Stick Bow (1 ranged damage, range 2) in inventory, Restore learned
- Regenerates PLAYER_REGEN HP per turn naturally (at start of enemy phase)
- Defense = armor + Vigor (with vigor_bonus) / VIGOR_PER_DEFENSE + Might / MIGHT_PER_DEFENSE (both rounded down) + terrain + POI + situational armor and passive bonuses
- Dodge chance = 2% × Vigor (vigor_bonus gear counts) + every equipped dodge_bonus item's bonus, summed, capped at `MAX_DODGE`
- Melee damage = weapon damage + Might (+ special bonuses: chaos_bonus, charge, channel, wall_of_steel). A ranged weapon used in melee deals a quarter of its damage (rounded up) + Might; bare hands deal 1 + Might
- Ranged damage = weapon damage + Reflex (+ chaos_bonus, channel, sniper bonus at max range)
- Bell curve damage rolls: 3 rolls of 1..strength×2, averaged. Mean ≈ strength, with natural variance.

## Combat

### Melee
Move onto an enemy hex (or press A and pick a target). You step to the cheapest reachable hex beside it and strike. Damage roll vs enemy defense, minimum 1 damage. If killed and you have the MP, you step onto the hex. If not killed (and not stunned), the enemy counter-attacks (halved by riposte weapons, reduced by counter_deflect armor). A melee attack costs the weapon's MP: 1 for most, 0 for fast or free_action weapons, all remaining MP for heavy ones. Weapon specials trigger on hit: lifesteal heals, armor_pierce lowers defense for the hit, ignore_defense skips it, defense_shred reduces enemy defense permanently, aether_siphon gains AE, burn and knockback, chain/reverberate bounce to nearby enemies, sweep hits more adjacent enemies, double/triple_strike hit again, channel adds damage but costs you HP. A blink_ring artifact lets you teleport in and strike enemies a few hexes away.

### Ranged
Press R or click the ranged slot on the skill bar to enter targeting mode. Requires a ranged weapon (any weapon with range), a visible target in range, and line of sight. Magical ranged weapons cost 1 Aether per shot (2 for heavy ones; free with free_ranged or channel weapons); mundane bows are free. A shot costs the weapon's MP: 2 for mundane bows and normal magic bows, 1 for fast, all remaining MP for heavy. Hills and ruins grant +1 range, a garrison +2. Weapon specials: chain hits nearby enemies, knockback pushes target, splash damages adjacent enemies, piercing continues through to the next enemy, double_shot/triple_shot fire multiple times, burn applies damage next turn (ignores defense), sniper adds damage at max range.

### Skills
Press 1-5 to activate a hotbar skill; some skills (Restore, Recall, the utility skills) can also be cast straight from the Skills panel without a slot. Most skills cost Aether; some cost nothing, HP (Dimensional Rend, Channel Aether) or gold (Commission Garrison). Each skill also has an MP cost: most spend all remaining MP (ending your movement for the turn), a few cost 0-2 MP. A weapon-flow skill cast through a matching weapon pays the higher of its own MP and the weapon's. Some require targeting (melee, ranged, teleport targets), others execute immediately (self, AoE centered on self). Phase Step and Sprint are once per turn. Skills never provoke a counter-attack. Skills have usage categories that restrict when they can be activated.

### Damage Formula
`rollDamage(strength)` → `Rando.bellCurve(strength)`: rolls 3 times from 1..strength×2, divides by 3, rounds. Produces a bell curve centered on strength. Applied to both player and enemy damage. Defense subtracts from rolled damage (minimum 1). Enemy defense can be permanently reduced by defense_shred weapons and Shredding Blow.

### Defensive Mechanics
- **Warp Shield**: For the coming enemy turn, each hit has a chance (50% at rank 1, rising to certain at rank 5) to be blocked entirely.
- **Reflect**: For the coming enemy turn, each melee hit has a chance to be cut to 10% with 90% sent back at the attacker.
- **Dodge**: 2% × Vigor (gear included) + dodge_bonus summed across equipped items (cap `MAX_DODGE`). Checked before damage.
- **Stun**: One stun roll per enemy per player turn. Chance = rolled damage / `STUN_DIVISOR_PRIMARY` for melee attacks and Might/Vigor-based skills; / `STUN_DIVISOR_OTHER` for everything else. Melee `stun` weapon affix adds +20/30/40%, and the Stun skill adds its own bonus. Cap `MAX_STUN_CHANCE`. On success: suppresses that attack's counter, target loses next turn.
- **Ranged Immune**: ranged_immune armor negates all incoming ranged damage.
- **Thorns**: thorns armor reflects 50-100% of damage to melee attackers.
- **Counter Mastery**: a counter_mastery weapon strikes back when a chaos enemy melees you.
- **Burning Aura**: burning_aura armor burns adjacent enemies when you're hit.
- **Last Stand**: last_stand armor grants +4/+6 defense at or below half HP.
- **Momentum**: momentum armor adds defense per hex moved this turn.
- **Stat Defense**: Vigor and Might each add defense (see Player).
- **POI Defense**: +3 defense on havens and garrisons, +2 on villages.
- **Terrain Defense**: +1 defense in forest (including special, shattered and distressed variants); ranger_defense adds more on forest, hills, quarry and ruins.

## Enemies

| Type | HP | Atk | Ranged | Def | Speed | Detect | Behavior | Notes |
|------|----|-----|--------|-----|-------|--------|----------|-------|
| Void Stalker | 15 | 5 | 3 (range 2) | 1 | 2 | 5 | Chase | Fast, fragile. Fires ranged AND melees. |
| Breach Crawler | 30 | 8 | — | 4 | 1 | 3 | Chase | Tanky, melee only. Drops loot. |
| Flux Archer | 12 | 6 | 6 (range 4) | 1 | 1 | 5 | Kite | Pure ranged: maintains 2-3 hex distance. |
| Phase Wraith | 10 | 5 | — | 1 | 2 | 4 (aggro 30) | Teleport | Senses you from far away; 30% chance to teleport within 3 hexes of you. |
| Breach Guardian | 50 | 10 | 8 (range 5) | 5 | 1 | 6 | Guard | Stays within 2 hexes of home breach. Dual melee+ranged. Drops loot. Re-forms at an unguarded breach. |
| The Unraveler | 100 | 12 | 6 (range 6) | 6 | 1 | 6 | Boss | Guards the Maw. 16% chance per turn to spawn a chaos minion. Dual melee+ranged. Re-forms when slain (see Victory). |

Every enemy grows stronger near the Maw: within MAW_PROXIMITY_FRACTION of the farthest walking distance from it, attack, defense and max HP rise steadily up to MAW_PROXIMITY_ATTACK, MAW_PROXIMITY_DEFENSE and MAW_PROXIMITY_HP at the Maw itself. Chaos enemies on shattered or distressed terrain get the corrupted-terrain bonus on top (see Terrain).

### Dual Attack System
Any enemy with a `range` is ranged (`enemyIsRanged`); every ranged def carries `rangedAttack`, the strength of its shot (equal to `attack` for the Flux Archer and close to it for ranged wildlife). Ranged tokens carry an amber arrow badge in the top-right corner. Firing needs line of sight. Dual attackers (Void Stalker, Breach Guardian, Unraveler) melee when adjacent and otherwise fire when they have a shot. The kiting Flux Archer fires only when not in melee range, and only half the time (KITE_FIRE_CHANCE). Ranged-capable chasers (Void Stalker) have a CHASER_RANGED_PREFERENCE chance per turn to prefer ranged fire and skip closing in.

### Enemy Behaviors
Enemies always know where you are; aggro is a plain distance check against their aggro range (detect range unless the def sets its own). Forest hides you: enemies' aggro range drops by FOREST_STEALTH and Phase Wraiths lose you entirely, unless you've attacked or cast this turn and they're within ALERT_RADIUS. A threat_shroud passive shrinks aggro range too.
- **Alarm and hunt**: an aggroed enemy marks your hex as a target for itself and every enemy within ALARM_RADIUS; they hunt toward that spot across turns until they reach it.
- **Swarm**: a chaos enemy with SWARM_ALLIES or more chaos allies nearby picks a nearby settlement and marches on it.
- **Chase**: A* pathfinding toward the player when in aggro range, else WANDER_CHANCE to wander randomly.
- **Kite**: Maintains 2-3 hex distance. Retreats if player gets within 2, approaches if beyond 3. Ideal range for ranged fire.
- **Guard**: Stays within guardRadius (2) of home POI. Steps toward the player in aggro range but won't leave the guard zone. Guards never hunt or swarm.
- **Teleport**: 30% chance per turn (in aggro) to teleport to a free passable hex within teleportRange (3) of the player. Blocked by a wraith_immune passive.
- **Boss**: Chases when in aggro range (6). Spawns a chaos minion beside itself by chance each turn.
- **Wildlife**: Procedurally generated neutral creatures. Chase the player when within aggro range (varies per creature), otherwise hunt an alarm target or wander (WILDLIFE_WANDER_CHANCE). Never wander or chase onto shattered terrain. Ranged wildlife that is aggroed and has a clear shot from 2+ hexes holds its ground and fires instead of closing.
- **Monster** (stronger wildlife tiers): as wildlife, but lurks around the nearest haven or village and stalks toward settlements in reach.
- **Ruins-guardian** (the strongest tiers): as wildlife, but patrols around the nearest ruin.

Enemies never walk into havens, villages or garrisons (except a swarm whose goal is that settlement), so settlements stay a refuge.

### Enemy State
Enemies can accumulate state from player attacks:
- `defReduction`: permanent defense reduction from defense_shred weapon hits and Shredding Blow (min 0 effective defense)
- `burnDamage`: damage dealt at start of next enemy phase (from burn weapon effects, Immolate skill, burning_aura armor), ignores defense
- `stunnedNextTurn`: the enemy skips its next turn

### Wildlife
`NUM_CREATURE_TIERS` procedurally generated creature tiers per game, with random fantasy names (e.g., "Ashtigeron", "Velpantherine"), unique colors from a random color scheme, and attack rising smoothly from 3 to 30 across the tiers. Each tier also has a ranged counterpart (e.g. "Velith Slinger"): three-quarters of the tier's attack for both melee and shot, less HP and defense, with range by tier band (`RANGED_CREATURE_BANDS`), so the top tier's ranged creature is a ranged ruins-guardian. Ranged creatures spawn at `RANGED_CREATURE_SPAWN_WEIGHT` the weight of their melee kin (about a fifth of wildlife). When aggroed with a clear shot from 2+ hexes they hold and fire; otherwise they close and melee like other wildlife. Tiers from MONSTER_ATTACK up behave as monsters and from RUINS_GUARDIAN_ATTACK up as ruins-guardians. Wildlife is distinct from chaos-spawned enemies: they don't shatter terrain, don't grant Aether on kill, and avoid shattered hexes. Killing a monster or ruins-guardian near a settlement earns that settlement's reward.

Wildlife comes in packs. Where a pack spawns, its tier is drawn around a peak that falls from the top tier at the Maw to tier 0 at the far edge of the map (a Gaussian spread of SPAWN_TIER_SIGMA tiers), so danger rises steadily as you travel toward the Maw. Pack size scales with your melee damage, so a stronger warrior meets more of the weaker creatures rather than empty fields. At game start packs fill the map (outside your vision, off shattered terrain, beyond SPAWN_SAFE_DISTANCE) until total wildlife attack reaches WILDLIFE_MIGHT_CAP; each turn after, while below the cap, WILDLIFE_SPAWN_CHANCE adds another pack.

### Initial Spawning
- Void Stalkers: 2d4
- Flux Archers: 1d3
- Each breach gets 1 Breach Guardian + 1-2 Breach Crawlers
- The Maw gets 1 Unraveler
- Wildlife: packs up to WILDLIFE_MIGHT_CAP (outside initial vision)
- Chaos and wildlife populations are capped separately by total attack (CHAOS_MIGHT_CAP, WILDLIFE_MIGHT_CAP), not by head count

## Points of Interest

| POI | Count | Symbol | Defense | Effect |
|-----|-------|--------|---------|--------|
| Haven | 4-6 | 🏰 | +3 | Full rest (HP + Aether). Weaponsmith (mundane gear), Magicsmith (magic gear and the shop-only skills), Train. +1 SP on first visit. |
| Village | 8-12 | 🏡 | +2 | Partial rest: half HP + half Aether. Weaponsmith with a small mundane stock. Entering may sprout a crop next door. |
| Ruin | 12-20 | ⛫ | — | Never used up. Searching a fresh ruin stirs wildlife within 2 hexes (Maw-distance tier peak + `RUIN_TIER_BIAS`, total attack up to player level × RUIN_MIGHT_PER_LEVEL); once none stand within 2 hexes, re-entering yields 1-3 non-magical items + 1 magical item + gold (RUIN_LOOT_GOLD). A looted ruin re-stirs on RUIN_RESTIR_CHANCE of searches, guarding a fresh haul. A search that stirs nothing, or taking the loot, ends movement. |
| Breach | 6-8 | ֍ | — | Impassable rift. Open breaches spawn chaos. Once its guardian is slain, Restore cast within range has BREACH_SEAL_CHANCE to seal it; a sealed breach becomes Hills and pays out gold (BREACH_LOOT_GOLD), mundane gear and a magic item. |
| Maw | 1 | ✸ | — | Final objective, impassable, on the rightmost hex that fits. Sealable only after every breach is sealed and the Unraveler and the Maw's current guardian are dead; then Restore within range has MAW_SEAL_CHANCE to seal it, and it drops the RETURN scroll. |
| Hut | `HUT_COUNT` | ⌂ | — | Wise Man's Hut. Teaches its assigned learnable optional skill (no two huts share one); once that is known, `HUT_REROLL_CHANCE` it digs up a new unlearned optional one (never core or held out). No limit on how many skills a hut teaches. Separately, `HUT_GIFT_CHANCE` the sage gives a random magic item instead of that visit's lesson; the lesson waits for the next visit. Both chances are rolled once per hut per turn, so leaving and stepping back in on the same turn is not another try. +1 SP on first visit; Train is available here. Rest is always offered, lesson or not: a small heal (`HUT_REST_HP_FRACTION` of max HP, at least 1, and `HUT_REST_AE_FRACTION` of max Aether, rounded up), as often as you like, with no crop chance. Learning or resting ends your movement; leaving is free. |
| Scroll | 6 core + `STORY_SCROLL_SKILLS` | 📜 | — | Stepping on it teaches its one skill (active at once if you have a free SP) and the scroll is gone. The Maw's RETURN scroll is one more. |
| Garrison | made by you | 🚧 → ♜ | +3 | Commissioned with gold beside a visible settlement; finishes building by chance (`GARRISON_BUILD_CHANCE` per turn), then slays one chaos enemy within `GARRISON_KILL_RANGE` each turn, with the kill rewards going to you. +2 ranged range when you stand in it. |

### Haven Shop
- A haven's stock is 2-3 magical + 2-3 non-magical items; a village's is 2-3 non-magical items
- The Weaponsmith shows the mundane items and the Magicsmith the magic ones; each buys back only its own kind. The Magicsmith also sells the shop-only skills (Commune, Commission Garrison)
- Buying doesn't empty the shelf: an item you own is hidden, and comes back if you sell it
- Each time a shop opens there is a SHOP_NEW_ITEM_CHANCE that a fresh magic item joins the stock
- Sell items at `SELL_PRICE_RATIO` of buy price
- Closing a shop (or the Train dialog) ends your movement; leaving the haven or village without buying doesn't

### Sanctuary
The Sanctuary skill rests you on the spot: a fraction of max HP and Aether (a quarter at rank 1, rising to half at rank 5), the usual village crop chance, and your turn's movement ends. No POI is left behind. It can't be cast on a POI hex, nor on distressed ground (and, as a Pristine skill, not on shattered ground either).
## Equipment

Items are either **magical** (unique, procedurally generated, special properties, purple in UI) or **non-magical** (mundane, fixed stats, no special abilities). All equipment is stored in a single runtime registry (`ALL_EQUIPMENT`), which includes both static non-magical items and dynamically generated magical items. The registry is saved/loaded with the game state. A weapon is ranged when it has a range; any weapon with range fires and flows as a bow.

### Non-Magical Melee Weapons (6)
| Name | Dmg | Price | Tier |
|------|-----|-------|------|
| Iron Sword | 2 | 12 | 1 |
| Spear | 2 | 12 | 1 |
| Battle Axe | 3 | 25 | 2 |
| Warhammer | 4 | 45 | 3 |
| Blade Spear | 4 | 45 | 3 |
| Greatsword | 5 | 70 | 4 |

### Non-Magical Bows (6)
| Name | Dmg | Range | Price | Tier |
|------|-----|-------|-------|------|
| Stick Bow | 1 | 2 | Free | 0 |
| Short Bow | 1 | 2 | 5 | 1 |
| Hunting Bow | 2 | 2 | 12 | 1 |
| Crossbow | 3 | 3 | 25 | 2 |
| War Bow | 4 | 3 | 45 | 3 |
| Great Bow | 5 | 4 | 70 | 4 |

### Non-Magical Armors (4)
| Name | Def | Price | Tier |
|------|-----|-------|------|
| Leather Armor | 2 | 15 | 1 |
| Chain Mail | 3 | 30 | 2 |
| Scale Armor | 4 | 50 | 3 |
| Plate Armor | 5 | 75 | 4 |

### Starting Equipment
- Rusty Blade: melee, 1 damage (non-magical, equipped)
- Worn Leather: armor, 1 defense (non-magical, equipped)
- Stick Bow: ranged, 1 damage, range 2 (in inventory)

### Procedurally Generated Magical Items

Magical items are generated at runtime via `rollMagicItem()`. Each item gets a unique ID (`magic_<N>`), a procedurally generated name, random stats, and one special effect. Names are built from thematic word pools (modes like "Void", "Storm", "Phase" combined with item words and effect-specific verbs/archetypes), with the item word chosen by the item's damage or defense.

**Melee weapons**: damage in MAGIC_DAMAGE. A d6 picks the variant: normal (1 MP per attack), fast (0 MP) or heavy (double damage, spends all MP).
**Ranged weapons**: damage in MAGIC_DAMAGE, range in MAGIC_RANGE. A d6 picks the variant: normal (2 MP per shot), fast (1 MP) or heavy (double damage, all MP, 2 Aether per shot).
**Armor**: defense in MAGIC_DEFENSE, plus one armor or passive effect.
**Artifacts**: no base stat, one passive effect.
**Price** (MAGIC_PRICE): the item's damage, range or defense times the effect's `value` (how strong the effect is); artifacts get a random base times `value`. Magic gear is expensive next to mundane gear, so most of it is found rather than bought.

#### Melee Weapon Effects (41 variants)
armor_pierce (2/4), aether_siphon (1/2), burn (2/3/5), chain (2/3/5), chaos_bonus (2/4/6), channel (+3/+5/+8 damage, 1/3/5 self-damage), charge (+4/+6/+8 bonus, x2 multiplier), counter_mastery, defense_shred (1/2), double_strike, triple_strike, free_action, ignore_defense, knockback, lifesteal (1/2/3), reverberate, riposte (1/2/3), sweep (2/3/5 adjacent), stun (+20/30/40%)

#### Ranged Weapon Effects (32 variants)
armor_pierce (2/4), aether_siphon (1/2), burn (2/3/5), chain (2/3/5), chaos_bonus (2/4/6), channel (+5/+8/+13 damage, 1/3/5 self-damage), defense_shred (1/2), double_shot, triple_shot, free_action, free_ranged, ignore_defense, knockback, lifesteal (1/2/3), piercing, sniper (2/4/8), splash (2)

#### Armor Effects (24 variants)
burning_aura (2/5), counter_deflect (50/70/90%), dodge_bonus (10/20/30%), heal_on_kill (5/8), high_def_mp_penalty (-1 MP; its +5 defense is not applied yet), last_stand (4/6), momentum (1/2/3), ranged_defense (2/4; no effect yet), ranged_immune, thorns (50/100%), wall_of_steel (2/4/6)

#### Passive Effects (44 variants, artifacts and armor)
aether_bonus (10/20), aether_discount (1/2/3 off every skill's Aether cost), aether_regen (1/2/3), aether_signet (3/5), blink_ring (range 4, +2 bonus), breach_jewel (4/6), chaos_attune (2/4 might, 2/3 def), chaos_circlet, chaos_defense (2/4), disengage, displacement_immune (no effect yet), heal (1/2/3 per turn), hp_bonus (10/20), mp_bonus (2/4), opportunist, ranger_defense (1/2/4), reveal_maw, revive (1/2 hp+ae), soul_harvest (2/4 XP), strider, threat_shroud, vigor_bonus (3/6/12), vision_bonus (2/4), wraith_immune

Armor can also roll any passive effect (from the combined armor + passive pool), giving armors access to passive effects like aether_regen or hp_bonus in addition to defensive specials. Passives on armor and artifact stack where they add up (vision_bonus, heal, hp_bonus, and the like).

### Loot Sources
- **Ruins**: 1-3 non-magical items + 1 magical item + gold
- **Sealed breaches**: a large gold purse + 1-3 non-magical items + 1 magical item
- **Breach Crawlers / Guardians**: 0-3 non-magical items + CHAOS_DROP_MAGIC_CHANCE of 1 magical item
- **Any kill**: a little gold (more with an opportunist passive), XP, +1 Aether for chaos; a skill gem may drop nearby
- **Prize hexes**: gold, a skill gem or a magic item
- **Wise Man's gift**: an occasional magic item at a hut
- **Haven shops**: 2-3 magical + 2-3 non-magical items; village shops: 2-3 non-magical
- **Sell price**: `SELL_PRICE_RATIO` of buy price

## Skills (46)

A skill is **learned** (you know it), then **trained** (made active) in the Train dialog at a haven or hut, or anywhere with Retrain; only trained skills can be cast or put on the hotbar. Training costs Skill Points: keeping a skill trained at rank R ties up R(R+1)/2 SP, so rank 1 costs 1, rank 2 costs 3, and each step up costs the new rank. Most skills have ranks 1-`SKILL_MAX_RANK`, each raising damage, range, chance or count; untiered skills stay at rank 1. Training down refunds the SP, so the build can be reshaped at any haven or hut. Channel Aether and RETURN are free: active the moment they're learned, costing no SP. Restore is known and trained at start. A scroll's skill arrives trained when you have a free SP; skills from huts and Skill Seek arrive untrained. Levelling up grants a Skill Point, never a skill. Trained skills can be freely equipped/unequipped into `SKILL_SLOTS` hotbar slots via the Skills panel.

### Skill Groups
Each run deals the skills differently, so every game has its own flavor (SkillLibrary in `skilllibrary.js`):
- **Core** (`core: true`): Channel Aether, Spirit Walk, Mountain Skip, Water Skip (a screwy map can always be crossed) and Renew, Retrain (the meta skills). Never held out or dealt; each rides exactly one scroll near the start settlement, and that scroll is the only way to learn it, so the player walks for the core kit. Channel Aether's scroll is always the nearest (within `CHANNEL_SCROLL_RADIUS`); the other five lie past it, within `NEAR_CORE_SCROLL_RADIUS` (half the map).
- **Fixed**: RETURN comes only from the scroll the Maw leaves, Commune and Commission Garrison only from the Magicsmith, and Restore is the starting skill.
- **Optional**: every other skill (36). `SKILL_HELD_OUT_FRACTION` of them (half, rounded down) are held out and can't be obtained by any channel this run; the player is not told which. Of the half that appears (18 of 36), `STORY_SCROLL_SKILLS` are bound to story scrolls (one each, scattered anywhere on the map reachable on foot; every scroll carries a skill, none is blank) and the other 12 are learnable via Skill Seek and Wise Man huts, one per hut, so every skill in play this run sits somewhere on the map. Huts and Skill Seek only ever give optional skills. Phase Step, Mending Light and Skill Seek are optional on purpose: survival skills are earned, and a run without Skill Seek means finding skills or camping huts.

### Skill Usage Categories
Each skill has a usage restriction that determines when it can be activated:
- **Pristine**: No enemies within 2 hexes AND player not on shattered terrain. Rewards maintaining safe, clean territory. (Aether Tap, Bountiful Harvest, Prospect, Commune, Salvage, Skill Seek, Sanctuary, Renew, Retrain, Commission Garrison, RETURN)
- **Non-combat**: No enemies within 2 hexes. Distressed or shattered terrain is OK. (Restore, Farsight, Spirit Walk, Ground Weeps)
- **Anytime**: No restrictions. All combat skills plus Recall, Phase Step, Sprint, Channel Aether, the skips and Loot.

The skill bar visually grays out skills whose usage conditions aren't met, providing immediate feedback on what's available.

In the tables, **AE** is the Aether cost (aether_discount passives lower it), **MP** is the movement cost ("all" spends every remaining MP, ending your movement for the turn), **Lv** is the minimum level for Skill Seek to offer an optional skill (huts and scrolls ignore it; "—" marks core and fixed skills, which Skill Seek never offers), and effect numbers read rank 1 → rank 5. "Weapon" means the held weapon's damage when it matches the skill (melee weapon for melee skills, ranged for ranged); a mismatched or missing weapon counts as 1, and a matching weapon also brings its affixes and, for ranged skills, its range.

### Combat Skills (27)

| Skill | AE | MP | Target | Scales | Usage | Lv | Effect |
|-------|----|----|--------|--------|-------|----|--------|
| Restore | 0 | all | AoE Self (1 + level/3) | — | Non-combat | — | Restore shattered terrain: +1 AE per hex (up to max), 3 XP per hex, a small chance of 1 gold per hex. Seals a breach (or the Maw) in range whose guardian is dead, by chance. |
| Void Strike | 1 | all | Melee | Might+Warding | Anytime | 1 | (weapon + Might + Warding) × 1 → × 2. No counter. |
| Sweep | 3 | all | Melee | Might | Anytime | 2 | weapon + Might to the target, then to up to 3 → 5 more enemies adjacent to you. |
| Stun | 3 | all | Melee | Might | Anytime | 2 | weapon + Might, +50% → +100% stun chance. |
| Siphon Strike | 2 | all | Melee | Might | Anytime | 2 | (weapon + Might) × 0.5 → × 1. Heal HP equal to damage dealt. |
| Loot | 0 | all | Melee | — | Anytime | 2 | Take up to 0.8× → 3× the enemy's attack in gold instead of dealing damage; chain/sweep weapons rob nearby enemies too. |
| Cosmic Bolt | 3 | all | Ranged (4 → 6) | Warding | Anytime | 2 | 8 → 16 + Warding. |
| Penetrating Shot | 2 | all | Ranged (4) | Reflex | Anytime | 2 | 6 → 14 + Reflex. Ignores defense. |
| Shockwave | 2 | all | AoE Self (2 → 3) | Might | Anytime | 2 | 4 → 12 + Might to enemies in range. Pushes each survivor 1 hex away. |
| Warp Shield | 5 | 1 | Self | — | Anytime | 4 | For the coming enemy turn, a 50% → 100% chance to block each hit. |
| Reflect | 3 | all | Self | — | Anytime | 4 | For the coming enemy turn, a 40% → 90% chance per melee hit to take 10% and reflect 90%. |
| Breach Pulse | 3 | all | AoE Self (2 → 3) | Warding | Anytime | 4 | 5 → 13 + Warding to all enemies in range. |
| Chain Lightning | 3 | all | Ranged (3) | Warding | Anytime | 4 | 6 → 14 + Warding to target, chaining at full damage to 2 → 4 more enemies nearby. |
| Immolate | 1 | all | Melee | Might | Anytime | 4 | weapon + Might. Target burns for 6 → 14 next turn. |
| Aether Blast | 2 | all | AoE Self (2 → 3) | Warding | Anytime | 4 | 3 → 7 + half Warding to enemies in range; +3 AE per enemy hit. |
| Lifedrain Blast | 2 | 2 | AoE Self (2 → 3) | Vigor | Anytime | 4 | 3 → 7 + Vigor to enemies in range; +2 HP per enemy hit. |
| Haven's Light | 3 | all | AoE Self (3 → 4) | Warding | Anytime | 6 | 20 → 36 + Warding to all enemies in range. Only usable at a haven or village. |
| Gravity Well | 3 | 1 | AoE Self (5 → 7) | — | Anytime | 6 | Pull enemies in range one hex closer. |
| Shredding Blow | 2 | all | Melee | Might | Anytime | 6 | weapon + Might. Permanently shred 3 → 7 enemy defense. |
| Meteor | 4 | all | Ranged AoE (4 → 6) | Warding | Anytime | 6 | Target hex: 8 → 16 + Warding to all enemies within 1 → 2 of it. |
| Dimensional Rend | 0 (1 → 11 HP) | all | Melee | Vigor | Anytime | 8 | (weapon × 1 → × 3) + Vigor, paid in HP; if your HP is no higher than the cost, the HP is still paid and the strike fizzles. |
| Execute | 3 | all | Melee | Might | Anytime | 8 | (weapon + Might) × 2 → × 5. Only targets enemies below 50% HP. |
| Ricochet | 3 | all | Ranged (4) | Reflex | Anytime | 8 | 5 + Reflex, bouncing to 2 → 5 more enemies within 3 → 5 hexes. |
| Starfall | 5 | all | AoE Self (3 → 4) | Warding | Anytime | 10 | 15 → 28 + Warding × 2 to all enemies in range. |
| Void Salvo | 4 | all | Ranged (3) | Reflex | Anytime | 10 | 3 → 5 shots at one target, each 5 → 10 + Reflex. |
| Mending Light | 2 | 1 | Self | Vigor | Anytime | 2 | Heal 10 → 26 + Vigor × 3 HP. |
| Recall | 5 | all | Self | — | Anytime | 10 | Teleport to the nearest haven; from a haven, to the next haven around the map. Emergency escape. |

### Movement and Meta Skills (8)

| Skill | AE | MP | Target | Usage | Lv | Effect |
|-------|----|----|--------|-------|----|--------|
| Phase Step | 1 | 0 | Teleport (2 → 6) | Anytime | 2 | Teleport to a visible hex in range. Once per turn. |
| Sprint | 2 | 0 | Self | Anytime | 2 | +1 → +8 MP this turn. Once per turn. |
| Water Skip | 3 | 1 | Water (4 → 6) | Anytime | — | Core. Skip onto water in range; from water, onto water or land. |
| Mountain Skip | 3 | 1 | Mountain (4 → 6) | Anytime | — | Core. Skip onto a mountain in range; from a mountain, onto a mountain or land. |
| Channel Aether | 0 | 0 | Self | Anytime | — | Core, free. Burn 4 HP per AE, up to filling AE or half your current HP (at least 1 AE). |
| Renew | 3 | all | Self | Pristine | — | Core. Refund all spent stat points and reallocate them. |
| Retrain | 3 | — | Self | Pristine | — | Core. Open the Train dialog anywhere; closing it ends your movement. |
| RETURN | 4 | 0 | Self | Pristine | — | From the Maw's scroll only, free. End the journey and win. |

### Non-Combat Skills (11)

| Skill | AE | MP | Target | Usage | Lv | Effect |
|-------|----|----|--------|-------|----|--------|
| Aether Tap | 0 | all | AoE Self (1 → 5) | Pristine | 2 | Draw AE from clean land, water and mountains in range: +1 AE per 2 → 5 clean hexes, rounded up. |
| Farsight | 2 | 0 | Self (12 → 20) | Non-combat | 2 | Reveal all hexes in range. |
| Bountiful Harvest | 4 | all | Self (2 → 4) | Pristine | 4 | Sprout crops (1-3 gold each, and a little healing) on healthy hexes in range. |
| Prospect | 1 | all | Self (8 → 12) | Pristine | 4 | Reveal gold deposits in range. 20% chance to create a gold deposit on a hex within 4. |
| Commune | 2 | all | Self (38 → 150) | Pristine | — | Magicsmith only. Reveal all POI locations in range. |
| Salvage | 0 | all | AoE Self (1 → 3) | Pristine | 4 | Restore shattered hexes in range and leave 1-10 gold on each. |
| Skill Seek | 3 | all | Self | Pristine | 6 | A 5% → 20% chance to be offered up to 3 obtainable skills (pick 1). |
| Spirit Walk | 3 | all | Teleport Revealed (6 → 14) | Non-combat | — | Core. Teleport to any revealed passable hex in range. |
| Ground Weeps | 4 | 0 | Self | Non-combat | 8 | Full-map enemy threat heatmap overlay. Blue=safe, red=deadly. Dismiss with Space/click. |
| Sanctuary | 0 | all | Self | Pristine | 8 | Rest in place: heal a quarter → half of max HP and AE. Must be non-POI terrain, not distressed. |
| Commission Garrison | 0 (1000 gold) | all | Self | Pristine | — | Magicsmith only. Build a garrison on this hex; a haven or village must be in sight. |

## Turn Structure

1. **Player phase** — player clicks to select, then spends MP to move, can attack (melee by moving onto an enemy or pressing A, ranged by pressing R) and use skills (1-5 keys or the Skills panel). Turn ends automatically at 0 MP, or manually via Space/E/End Turn button (on a POI hex, End Turn reopens that POI's dialog instead). Resting, finishing in a shop or Train, and taking a lesson at a hut all spend your remaining MP. The game saves at the end of each player phase.
2. **Enemy phase** — natural HP regen (+PLAYER_REGEN HP), heal and revive passives, aether_regen and chaos_circlet Aether first, then burn damage ticks. Enemies act one by one (animated only when on screen). Each enemy: skip if stunned → heal on corrupted terrain (chaos) → teleport check (Phase Wraith) → movement by behavior, or hunt/swarm toward a target → attack (melee if adjacent, which can trigger thorns, reflect, counter_mastery and burning_aura; ranged if it has a shot, negated by ranged_immune) → minion spawn (Unraveler) → terrain shatter check (chaos). Then Warp Shield and Reflect count down.
3. **Spawn phase** — guardians may re-form at ready, unguarded breaches and the Maw; open breaches roll BREACH_SPAWN_CHANCE each for a new chaos enemy; WILDLIFE_SPAWN_CHANCE for a wildlife pack (outside player vision, non-shattered hex); garrisons build and strike. Turn counter increments. MP reset to full (or half if engaged). Per-turn flags (moved this turn, Phase Step, Sprint, stun rolls) cleared.

## Engagement Mechanic

If the player starts a turn adjacent to any enemy, their MP is halved (minimum 1), unless they wear a disengage passive. This creates a meaningful decision: do you end your turn near an enemy to get melee access, knowing you'll have reduced mobility next turn? It punishes careless positioning and rewards tactical use of ranged attacks and skills to avoid being pinned down.

## Line of Sight

LOS is checked by walking the line between two hexes and testing for mountains. Used by ranged attacks, ranged skills, the skip skills, and enemy ranged fire. Mountains block LOS; all other terrain is transparent. Enemies don't need LOS to notice you, only to shoot.

## Fog of War

- Vision radius: `BASE_VISION` hexes, expandable by equipment with vision_bonus (stackable across armor + artifact slots)
- Revealed hexes show terrain and POIs permanently (dimmed when not currently visible)
- Enemies only visible in current vision range
- reveal_maw passive reveals the Maw permanently and shows every chaos enemy (and the hexes around it) wherever it is
- Farsight skill reveals hexes within its range (free action)
- Commune skill reveals POI locations within its (large) range
- Prospect skill reveals gold deposit hexes within its range
- Casting Restore beside the Maw while breaches stay open reveals those breaches on the map

## Victory and Defeat

- **Victory**: Seal every breach (slay its Breach Guardian, then win a BREACH_SEAL_CHANCE roll with Restore in range). Slay The Unraveler: each time it falls while any other chaos enemy is on the map, it re-forms in that enemy's place (no longer calling minions), so it is truly gone only once it falls with no chaos left to take over. With every breach sealed and the Unraveler and the Maw's current guardian dead, seal the Maw with Restore in range (a MAW_SEAL_CHANCE roll). The sealed Maw drops the RETURN scroll nearby; pick it up and invoke RETURN on a peaceful, unshattered hex to end the journey.
- **Defeat**: Player HP reaches 0.
- Endgame screen shows: turns played, level reached, and a score breakdown (enemies and guardians defeated, breaches sealed, hexes and settlements restored, ruins explored, gold collected, distance, damage dealt and taken, near-death moments, garrison work).

## Strategies

### Early Game (Levels 1-3)
Explore cautiously from the starting settlement. The Rusty Blade (1 damage) and Stick Bow (1 damage, range 2) mean early fights are slow — hunt the weak wildlife far from the Maw for XP and gold while avoiding chaos-spawned enemies until you upgrade. Walk onto sparkling special hexes for their hidden gold, skill gems and the odd magic item. Buy a weapon from the Weaponsmith ASAP; even a mundane upgrade transforms your combat ability, and a magic one is a windfall worth saving toward. Avoid ruins until level 2+ since searching one stirs up tougher-than-local creatures. Walk the core scrolls near the start for the crossing and meta kit (Channel Aether is always the nearest), and visit havens and Wise Man huts whenever safe — each gives a Skill Point on the first visit, and a free optional skill is a windfall. Levelling grants a Skill Point, not a skill, so your early optional skills come from huts and scrolls, and your SP decides how many of them you can keep trained; what a hut or scroll offers shapes the build: Phase Step for mobility, Cosmic Bolt/Penetrating Shot for ranged damage, Siphon Strike for sustain, Shockwave for defensive AoE, Loot for economy, Aether Tap for resource management, or Farsight for scouting.

### Mid Game (Levels 4-6)
Assault the first breach. Use terrain tactically: forest for +1 defense and to slip past enemies' notice, hills and ruins for +1 ranged range. Clear ruins for equipment upgrades and gold. Seal the first breach to reduce spawn pressure — and don't dawdle once its guardian falls, since a new one can re-form at an unguarded breach. Restore may take a few casts to seal it. Weapon specials start mattering: armor_pierce and ignore_defense weapons cut through Guardian defense, charge weapons reward aggressive movement-into-attack, defense_shred weapons weaken enemies over sustained fights. Spend SP on ranks for the skills you lean on. Non-combat skills like Prospect, Salvage, and Bountiful Harvest fund equipment purchases, and Restore near settlements earns their gratitude in gold. If you can afford Commune from the Magicsmith, use it to reveal the POIs around you and plan your route to the next breach.

### Late Game (Levels 7-10)
Seal the rest of the breaches. Gear up for the Maw. Starfall trivializes mob fights with 15 + 2×Warding AoE, but only if a hut or scroll this run carries it — or you reach level 10 for Skill Seek to offer it. Void Salvo gives ranged builds a devastating finisher. The Unraveler fight demands both damage output and sustain — pure Might builds lack healing, pure Warding builds lack kill speed. The Unraveler's dual attack (12 melee + 6 ranged at range 6), 6 defense, the Maw-proximity buff on everything near the Maw, and its chance each turn to call a minion mean you need to close quickly or get overwhelmed. Killing it isn't the end: it re-forms in place of another chaos enemy until none are left, so thinning the chaos around the map pays off here. Recall provides an emergency escape if things go wrong. Ground Weeps helps plan your approach by revealing enemy concentration. Haven's Light can devastate enemies that follow you back to a haven or village.

### Build Archetypes
- **Sustain Melee**: lifesteal/aether_siphon weapon + heal_on_kill armor + Siphon Strike — heal through everything, never retreat
- **Skill Caster**: aether_siphon weapon + aether_regen armor + aether_discount or aether_bonus artifact — near-endless Aether, skill every turn
- **Glass Cannon**: channel weapon + dodge_bonus armor — huge burst paid for in HP, pray for dodges
- **Tank Breacher**: armor_pierce weapon + last_stand armor + Shredding Blow — grind through Guardian fights
- **Sniper**: sniper ranged weapon + vision_bonus artifact + Penetrating Shot — shoot from max range, never get touched
- **Kite Control**: knockback ranged weapon + thorns armor + Shockwave — push enemies away, punish the ones that reach you
- **Boss Killer**: defense_shred weapon + ranged_immune armor + Execute — shred the Unraveler's defense, negate its ranged, finish with Execute
- **Explorer**: Farsight + Spirit Walk + the skips + Prospect — maximum map knowledge and reach
- **Harvester**: Loot + Bountiful Harvest + Salvage + Prospect — maximize gold income for shop upgrades

### Key Decisions
- **Melee vs Ranged build**: Melee (Might + melee weapon) does more single-target damage and benefits from Void Strike/Execute/Shredding Blow. Ranged (Reflex + ranged weapon) avoids counter-attacks and kites safely but has lower burst, and magic bows tax Aether per shot. Vigor is the stat that double-scales: it raises HP, defense and dodge. Penetrating Shot, Ricochet and Void Salvo give Reflex builds skill scaling. Weapons with ignore_defense are excellent against high-defense targets (Breach Guardian at 5 def, Unraveler at 6 def, both higher near the Maw).
- **When to engage breaches**: Each sealed breach reduces spawn pressure but the guardian fight (50 HP, 10 atk, 8 ranged atk at range 5, 5 def) is dangerous. Their long ranged reach and aggro range of 6 means you can't safely plunk away from a distance. Shredding Blow makes guardians far more approachable. After the kill you still need to stand within Restore's range, out of enemies' reach, and may need several casts.
- **Skill Points and slots**: dozens of skills, `SKILL_SLOTS` slots, and only enough SP to keep a handful trained. Rank 3 in one skill costs as much as six skills at rank 1. The Skills panel lets you swap freely among trained skills, but mid-combat you're locked to what's trained and slotted. Restore, Recall and most utility skills can be cast from the Skills panel without a slot, so slots go to the fight. Pristine skills incentivize returning to safe territory between fights, and retraining needs a haven, a hut or Retrain.
- **High defense trade-off**: Armor with high_def_mp_penalty costs 1 MP per turn (its +5 defense bonus isn't applied yet), severely limiting mobility. Best paired with Phase Step or Sprint for repositioning.
- **Terrain stewardship**: Clean terrain fuels Aether Tap and enables Pristine skills, and restoring land near a settlement pays a reward. Letting corruption spread degrades your resource base and buffs the chaos standing on it. Salvage restores and pays out gold at once; Restore restores, refills Aether and grants XP.

### Anti-Strategies
- **Turtling near haven**: Breach spawns fill the map and shatter terrain, and chaos swarms march on settlements. The chaos might cap prevents infinite scaling, but the shattered wasteland left behind makes movement increasingly costly and Pristine skills unusable.
- **Ignoring breaches**: Even with the chaos might cap, the continuous spawning creates a target-rich environment that drains HP and Aether without strategic progress, and the Maw can't be sealed until every breach is. Meanwhile shattered terrain accumulates, degrading map mobility and Aether Tap yields.
- **Pure glass cannon**: High Might, no Vigor. Works until a Phase Wraith teleports adjacent and you eat hits with only 50 HP, no Vigor defense and no dodge. Near the Maw, the Unraveler's attacks carry the Maw-proximity bonus on top of 12 melee + 6 ranged and will two-shot you.
- **Grinding Void Stalkers forever**: Polynomial XP curve makes this increasingly futile past level 5. Breaches and ruins give better returns for the risk.
- **Ignoring engagement**: Ending turns adjacent to enemies halves your MP next turn. Getting pinned between two enemies can cascade into a death spiral of reduced mobility.
- **Skill Seek spam at havens**: Costs 3 AE per attempt for a low chance (5% at rank 1), with nothing on a plain failure. At a haven you'd need to rest between attempts, eating turns. The polynomial XP curve and breach escalation make this a poor use of time; huts teach for free.
