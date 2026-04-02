# Magical Effects

All magical effects found on equipment, classified by type.

## Name Patterns

| Pattern | Template | Examples |
|---------|----------|----------|
| Modifier Item | `<mode> <item>` | Flux Bow, Chaos Ward, Ember Blade |
| Verbing Item | `<verbing> <item>` | Burning Mail, Piercing Bolt, Rending Pick |
| Archetype's Item | `<archetype>'s <item>` | Warden's Blade, Seer's Lens, Scout's Cloak |
| Compound | `<mode><verber>` | Emberstrike, Soulreaver, Duskfang, Worldsplitter |
| Compound Item | `<mode><verb> <item>` | Starforged Sword, Bloodward Cuirass, Windrunner Boots |
| Item of the X | `<item> of the <mode/archetype>` | Aegis of the Breach, Shield of the Warden |

## Word Banks

### Modes

| Mode |
|------|
| Aether |
| Arc |
| Astral |
| Blast |
| Blink |
| Blood |
| Chaos |
| Dusk |
| Ember |
| Flux |
| Gale |
| Hawk |
| Ley |
| Nova |
| Null |
| Phase |
| Pulse |
| Rift |
| Rune |
| Smoke |
| Soul |
| Star |
| Stasis |
| Storm |
| Thorn |
| Umbra |
| Void |
| Wrath |
| Wyrm |

### Verbing (general — cross-applicable, 50/50 with effect-specific)

| Verbing |
|---------|
| Blazing |
| Burning |
| Flickering |
| Searing |
| Shrieking |
| Withering |

### Verber

| Verber |
|--------|
| -breaker |
| -caster |
| -fang |
| -piercer |
| -reaver |
| -runner |
| -seeker |
| -splitter |
| -strike |
| -render |
| -singer |
| -ward |
| -weave |
| -wrath |
| -bane |

### Verb (for compounds)

| Verb |
|------|
| -blessed |
| -bound |
| -forged |
| -kissed |
| -sworn |
| -tempered |
| -touched |
| -ward |
| -wrought |
| -woven |
| -scarred |
| -claimed |

### Archetypes (general — cross-applicable, 50/50 with effect-specific)

| Archetype |
|-----------|
| Navigator |
| Operator |
| Pilot |
| Replicant |
| Starpilot |
| Technomancer |
| Wanderer |
| Witch |
| Wraith |
| Xenarch |

### Items — Melee Weapons

| Item |
|------|
| Axe |
| Blade |
| Cleaver |
| Edge |
| Mace |
| Pick |
| Spear |
| Spike |
| Sword |
| Thorn |
| Glaive |
| Hatchet |
| Flail |
| Scythe |
| Fist |
| Ripper |
| Shard |
| Vane |

### Items — Ranged Weapons

| Item |
|------|
| Bolt |
| Bow |
| Cannon |
| Caster |
| Lance |
| Launcher |
| Longbow |
| Repeater |
| Rifle |
| Rod |
| Sling |
| Arbalest |
| Javelin |
| Handcannon |
| Wand |
| Accelerator |
| Emitter |
| Coilgun |

### Items — Armor

| Item |
|------|
| Aegis |
| Cloak |
| Cuirass |
| Hide |
| Mail |
| Plate |
| Robe |
| Shield |
| Tunic |
| Vest |
| Weave |
| Mantle |
| Carapace |
| Hauberk |
| Wrap |
| Cowl |

### Items — Artifacts

| Item |
|------|
| Amulet |
| Anchor |
| Boots |
| Bracers |
| Circlet |
| Compass |
| Crown |
| Crystal |
| Gloves |
| Hood |
| Jewel |
| Lens |
| Ring |
| Shroud |
| Sigil |
| Signet |
| Stone |
| Talisman |
| Torc |
| Veil |
| Ward |
| Wraps |
| Lantern |
| Transponder |
| Injector |
| Capacitor |

## Weapon Effects

Offensive effects that trigger when attacking.

| Effect            | Description                                            | Verbings                           | Archetypes                        |
|-------------------|--------------------------------------------------------|------------------------------------|------------------------------------|
| `armor_pierce`    | Ignore 2 enemy defense                                 | Rending, Sundering, Piercing       | Slayer, Warden, Operator           |
| `armor_pierce`    | Ignore 4 enemy defense                                 | Rending, Sundering, Piercing       | Slayer, Warden, Operator           |
| `aether_siphon`   | Gain 1 Aether on hit                                   | Thirsting, Weeping, Withering      | Witch, Technomancer, Seer          |
| `aether_siphon`   | Gain 2 Aether on hit                                   | Thirsting, Weeping, Withering      | Witch, Technomancer, Seer          |
| `burn`            | Target takes 2 fire damage next turn                   | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `burn`            | Target takes 3 fire damage next turn                   | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `burn`            | Target takes 5 fire damage next turn                   | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `chain`           | Damage chains to 2 nearby enemies                      | Shrieking, Flickering, Blazing     | Technomancer, Operator, Starpilot  |
| `chain`           | Damage chains to 3 nearby enemies                      | Shrieking, Flickering, Blazing     | Technomancer, Operator, Starpilot  |
| `chain`           | Damage chains to 5 nearby enemies                      | Shrieking, Flickering, Blazing     | Technomancer, Operator, Starpilot  |
| `chaos_bonus`     | +2 damage vs chaos enemies                             | Warding, Sundering, Searing        | Sentinel, Warden, Zealot           |
| `chaos_bonus`     | +4 damage vs chaos enemies                             | Warding, Sundering, Searing        | Sentinel, Warden, Zealot           |
| `chaos_bonus`     | +6 damage vs chaos enemies                             | Warding, Sundering, Searing        | Sentinel, Warden, Zealot           |
| `counter_mastery` | Counter-attack after being hit in melee                | Warding, Piercing, Rending         | Warden, Sentinel, Slayer           |
| `defense_shred`   | Permanently reduce target's defense by 1               | Sundering, Rending, Withering      | Surgeon, Operator, Slayer          |
| `defense_shred`   | Permanently reduce target's defense by 2               | Sundering, Rending, Withering      | Surgeon, Operator, Slayer          |
| `double_strike`   | Strike twice in melee                                  | Flickering, Blazing, Rending       | Replicant, Slayer, Pilot           |
| `triple_strike`   | Strike three times in melee                            | Flickering, Shrieking, Blazing     | Replicant, Slayer, Zealot          |
| `ignore_defense`  | Bypass defense entirely                                | Piercing, Sundering, Rending       | Xenarch, Surgeon, Technomancer     |
| `knockback`       | Push enemy 1 hex away                                  | Sundering, Shrieking, Blazing      | Warden, Sentinel, Slayer           |
| `lifesteal`       | Heal 1 HP on hit                                       | Thirsting, Weeping, Withering      | Wraith, Witch, Surgeon             |
| `lifesteal`       | Heal 2 HP on hit                                       | Thirsting, Weeping, Withering      | Wraith, Witch, Surgeon             |
| `lifesteal`       | Heal 3 HP on hit                                       | Thirsting, Weeping, Withering      | Wraith, Witch, Surgeon             |
| `momentum`        | 2 Bonus damage after moving                            | Blazing, Searing, Rending          | Wanderer, Wayfarer, Pilot          |
| `momentum`        | 3 Bonus damage after moving                            | Blazing, Searing, Rending          | Wanderer, Wayfarer, Pilot          |
| `momentum`        | 4 Bonus damage after moving                            | Blazing, Searing, Rending          | Wanderer, Wayfarer, Pilot          |
| `recoil`          | 3 High damage but hurts self 1                         | Shrieking, Blazing, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`          | 5 High damage but hurts self 3                         | Shrieking, Blazing, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`          | 8 High damage but hurts self 5                         | Shrieking, Blazing, Searing        | Zealot, Slayer, Xenarch            |
| `reverberate`     | Damage chains to 3 nearby enemies, +2 damage each jump | Shrieking, Sundering, Blazing      | Technomancer, Xenarch, Operator    |
| `riposte`         | Enhanced counter-attack 1 damage                       | Warding, Piercing, Flickering      | Warden, Sentinel, Slayer           |
| `riposte`         | Enhanced counter-attack 2 damage                       | Warding, Piercing, Flickering      | Warden, Sentinel, Slayer           |
| `riposte`         | Enhanced counter-attack 3 damage                       | Warding, Piercing, Flickering      | Warden, Sentinel, Slayer           |

## Ranged Weapon Effects

| Effect           | Description                              | Verbings                           | Archetypes                        |
|------------------|------------------------------------------|------------------------------------|------------------------------------|
| `armor_pierce`   | Ignore 2 enemy defense                   | Piercing, Rending, Sundering       | Slayer, Ranger, Operator           |
| `armor_pierce`   | Ignore 4 enemy defense                   | Piercing, Rending, Sundering       | Slayer, Ranger, Operator           |
| `aether_siphon`  | Gain 1 Aether on hit                     | Thirsting, Weeping, Withering      | Witch, Seer, Technomancer         |
| `aether_siphon`  | Gain 2 Aether on hit                     | Thirsting, Weeping, Withering      | Witch, Seer, Technomancer         |
| `burn`           | Target takes 2 fire damage next turn     | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `burn`           | Target takes 3 fire damage next turn     | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `burn`           | Target takes 5 fire damage next turn     | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `chain`          | Damage chains to 2 nearby enemies        | Shrieking, Flickering, Blazing     | Technomancer, Operator, Starpilot  |
| `chain`          | Damage chains to 3 nearby enemies        | Shrieking, Flickering, Blazing     | Technomancer, Operator, Starpilot  |
| `chain`          | Damage chains to 5 nearby enemies        | Shrieking, Flickering, Blazing     | Technomancer, Operator, Starpilot  |
| `chaos_bonus`    | +2 damage vs chaos enemies               | Warding, Sundering, Searing        | Sentinel, Warden, Zealot           |
| `chaos_bonus`    | +4 damage vs chaos enemies               | Warding, Sundering, Searing        | Sentinel, Warden, Zealot           |
| `chaos_bonus`    | +6 damage vs chaos enemies               | Warding, Sundering, Searing        | Sentinel, Warden, Zealot           |
| `defense_shred`  | Permanently reduce target's defense by 1 | Sundering, Rending, Withering      | Surgeon, Operator, Slayer          |
| `defense_shred`  | Permanently reduce target's defense by 2 | Sundering, Rending, Withering      | Surgeon, Operator, Slayer          |
| `double_shot`    | Fire two shots                           | Flickering, Blazing, Shrieking     | Replicant, Ranger, Starpilot      |
| `triple_shot`    | Fire three shots                         | Flickering, Shrieking, Blazing     | Replicant, Starpilot, Zealot      |
| `free_ranged`    | Ranged attack costs no Aether            | Flickering, Warding, Weeping       | Navigator, Seer, Wanderer          |
| `ignore_defense` | Bypass defense entirely                  | Piercing, Sundering, Rending       | Xenarch, Surgeon, Technomancer     |
| `knockback`      | Push enemy 1 hex away                    | Sundering, Shrieking, Blazing      | Warden, Sentinel, Slayer           |
| `lifesteal`      | Heal 1 HP on hit                         | Thirsting, Weeping, Withering      | Wraith, Witch, Surgeon             |
| `lifesteal`      | Heal 2 HP on hit                         | Thirsting, Weeping, Withering      | Wraith, Witch, Surgeon             |
| `lifesteal`      | Heal 3 HP on hit                         | Thirsting, Weeping, Withering      | Wraith, Witch, Surgeon             |
| `piercing`       | Shot passes through enemies              | Piercing, Rending, Sundering       | Ranger, Scout, Slayer              |
| `recoil`         | 5 High damage but hurts self 1           | Shrieking, Blazing, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`         | 8 High damage but hurts self 3           | Shrieking, Blazing, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`         | 13 High damage but hurts self 5          | Shrieking, Blazing, Searing        | Zealot, Slayer, Xenarch            |
| `sniper`         | 2 Bonus damage at max range              | Piercing, Warding, Searing         | Ranger, Scout, Starpilot           |
| `sniper`         | 4 Bonus damage at max range              | Piercing, Warding, Searing         | Ranger, Scout, Starpilot           |
| `sniper`         | 8 Bonus damage at max range              | Piercing, Warding, Searing         | Ranger, Scout, Starpilot           |
| `splash`         | AoE damage around target                 | Blazing, Shrieking, Searing        | Operator, Technomancer, Xenarch    |

## Armor Effects

Defensive effects with a combat component -- reactive damage, evasion, or combat-conditional bonuses.

| Effect                | Description                                      | Verbings                           | Archetypes                        |
|-----------------------|--------------------------------------------------|------------------------------------|------------------------------------|
| `burning_aura`        | Deal 2 fire damage to adjacent enemies each turn | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `burning_aura`        | Deal 5 fire damage to adjacent enemies each turn | Blazing, Searing, Burning          | Zealot, Witch, Xenarch             |
| `dodge_bonus`         | 10% Chance to completely avoid attacks           | Flickering, Weeping, Warding       | Scout, Wanderer, Wraith            |
| `dodge_bonus`         | 20% Chance to completely avoid attacks           | Flickering, Weeping, Warding       | Scout, Wanderer, Wraith            |
| `dodge_bonus`         | 30% Chance to completely avoid attacks           | Flickering, Weeping, Warding       | Scout, Wanderer, Wraith            |
| `heal_on_kill`        | 5 Restore HP when you kill an enemy              | Thirsting, Rending, Withering      | Slayer, Wraith, Surgeon            |
| `heal_on_kill`        | 8 Restore HP when you kill an enemy              | Thirsting, Rending, Withering      | Slayer, Wraith, Surgeon            |
| `high_def_mp_penalty` | +5 def -1 movement points                        | Warding, Sundering, Blazing        | Sentinel, Warden, Xenarch          |
| `last_stand`          | 4 Bonus defense when below 50% HP                | Warding, Blazing, Shrieking        | Sentinel, Zealot, Warden           |
| `last_stand`          | 6 Bonus defense when below 50% HP                | Warding, Blazing, Shrieking        | Sentinel, Zealot, Warden           |
| `momentum_defense`    | +1 defense per hex moved this turn               | Flickering, Blazing, Warding       | Wanderer, Wayfarer, Pilot          |
| `momentum_defense`    | +2 defense per hex moved this turn               | Flickering, Blazing, Warding       | Wanderer, Wayfarer, Pilot          |
| `momentum_defense`    | +3 defense per hex moved this turn               | Flickering, Blazing, Warding       | Wanderer, Wayfarer, Pilot          |
| `ranged_immune`       | +2 defense to ranged attacks                     | Warding, Flickering, Blazing       | Sentinel, Warden, Technomancer     |
| `ranged_immune`       | +4 defense to ranged attacks                     | Warding, Flickering, Blazing       | Sentinel, Warden, Technomancer     |
| `ranged_immune`       | Immune to ranged attacks                         | Warding, Flickering, Blazing       | Sentinel, Warden, Technomancer     |
| `thorns`              | Reflect 50% damage back to melee attackers       | Piercing, Rending, Shrieking       | Sentinel, Warden, Xenarch          |
| `thorns`              | Reflect 100% damage back to melee attackers      | Piercing, Rending, Shrieking       | Sentinel, Warden, Xenarch          |
| `wall_of_steel`       | +2 Bonus melee damage if stationary              | Warding, Sundering, Blazing        | Sentinel, Warden, Slayer           |
| `wall_of_steel`       | +4 Bonus melee damage if stationary              | Warding, Sundering, Blazing        | Sentinel, Warden, Slayer           |
| `wall_of_steel`       | +6 Bonus melee damage if stationary              | Warding, Sundering, Blazing        | Sentinel, Warden, Slayer           |

## Passive Effects

Utility and stat effects that are always active or non-combat.

| Effect                | Description                                             | Verbings                           | Archetypes                        |
|-----------------------|---------------------------------------------------------|------------------------------------|------------------------------------|
| `aether_bonus`        | Increase max Aether 10                                  | Warding, Flickering, Weeping       | Seer, Technomancer, Witch          |
| `aether_bonus`        | Increase max Aether 20                                  | Warding, Flickering, Weeping       | Seer, Technomancer, Witch          |
| `aether_regen`        | Regenerate +1 Aether each turn                          | Weeping, Flickering, Warding       | Seer, Witch, Navigator             |
| `aether_regen`        | Regenerate +2 Aether each turn                          | Weeping, Flickering, Warding       | Seer, Witch, Navigator             |
| `aether_regen`        | Regenerate +3 Aether each turn                          | Weeping, Flickering, Warding       | Seer, Witch, Navigator             |
| `aether_signet`       | Bonus +3 damage when Aether is full (spends 3 Aether)   | Blazing, Searing, Thirsting        | Technomancer, Xenarch, Zealot      |
| `aether_signet`       | Bonus +5 damage when Aether is full (spends 5 Aether)   | Blazing, Searing, Thirsting        | Technomancer, Xenarch, Zealot      |
| `blink_ring`          | Melee attack enemies within 4 hexes by teleporting      | Flickering, Blazing, Weeping       | Navigator, Pilot, Wraith           |
| `breach_jewel`        | +4 might near a breach or Maw                           | Blazing, Warding, Searing          | Sentinel, Warden, Zealot           |
| `breach_jewel`        | +6 might when near a breach or Maw                      | Blazing, Warding, Searing          | Sentinel, Warden, Zealot           |
| `chaos_attune`        | +2 might and +2 defense on shattered/distressed terrain | Withering, Weeping, Warding        | Witch, Xenarch, Wanderer           |
| `chaos_attune`        | +4 might and +3 defense on shattered/distressed terrain | Withering, Weeping, Warding        | Witch, Xenarch, Wanderer           |
| `chaos_circlet`       | +1 Aether per turn on corrupted terrain                 | Withering, Weeping, Flickering     | Witch, Xenarch, Wanderer           |
| `chaos_defense`       | +2 defense on shattered/distressed terrain              | Warding, Withering, Blazing        | Sentinel, Warden, Zealot           |
| `chaos_defense`       | +4 defense on shattered/distressed terrain              | Warding, Withering, Blazing        | Sentinel, Warden, Zealot           |
| `disengage`           | No MP penalty for enemy engagement                      | Flickering, Weeping, Warding       | Scout, Wanderer, Ranger            |
| `displacement_immune` | Immune to forced movement                               | Warding, Sundering, Blazing        | Sentinel, Warden, Navigator        |
| `heal`                | +1 HP per turn                                          | Weeping, Warding, Flickering       | Surgeon, Seer, Wanderer            |
| `heal`                | +2 HP per turn                                          | Weeping, Warding, Flickering       | Surgeon, Seer, Wanderer            |
| `heal`                | +3 HP per turn                                          | Weeping, Warding, Flickering       | Surgeon, Seer, Wanderer            |
| `hp_bonus`            | +10 max HP                                              | Warding, Blazing, Sundering        | Warden, Sentinel, Zealot           |
| `hp_bonus`            | +20 max HP                                              | Warding, Blazing, Sundering        | Warden, Sentinel, Zealot           |
| `mp_bonus`            | +2 movement points                                      | Flickering, Blazing, Warding       | Wanderer, Wayfarer, Scout          |
| `mp_bonus`            | +4 movement points                                      | Flickering, Blazing, Warding       | Wanderer, Wayfarer, Scout          |
| `opportunist`         | 25% chance for 1-5 bonus gold on kill                   | Flickering, Thirsting, Rending     | Scout, Ranger, Operator            |
| `ranger_defense`      | +1 defense on forest/hills terrain                      | Warding, Flickering, Weeping       | Ranger, Scout, Wanderer            |
| `ranger_defense`      | +2 defense on forest/hills terrain                      | Warding, Flickering, Weeping       | Ranger, Scout, Wanderer            |
| `ranger_defense`      | +4 defense on forest/hills terrain                      | Warding, Flickering, Weeping       | Ranger, Scout, Wanderer            |
| `reveal_maw`          | Show direction to the Maw                               | Piercing, Flickering, Warding      | Seer, Navigator, Scout             |
| `revive`              | +1 HP +1 Aether per turn                                | Weeping, Warding, Flickering       | Surgeon, Seer, Wanderer            |
| `revive`              | +2 HP +2 Aether per turn                                | Weeping, Warding, Flickering       | Surgeon, Seer, Wanderer            |
| `soul_harvest`        | +2 XP on kill                                           | Thirsting, Withering, Weeping      | Wraith, Witch, Slayer              |
| `soul_harvest`        | +4 XP on kill                                           | Thirsting, Withering, Weeping      | Wraith, Witch, Slayer              |
| `strider`             | Rough terrain costs only 1 MP                           | Flickering, Blazing, Warding       | Wanderer, Wayfarer, Ranger         |
| `threat_shroud`       | Reduce enemy detection range by 2                       | Weeping, Flickering, Withering     | Scout, Wraith, Wanderer            |
| `vision_bonus`        | +2 sight range                                          | Piercing, Flickering, Warding      | Seer, Scout, Navigator             |
| `vision_bonus`        | +4 sight range                                          | Piercing, Flickering, Warding      | Seer, Scout, Navigator             |
| `wraith_immune`       | Immune to Phase Wraith teleport ambush                  | Warding, Blazing, Searing          | Sentinel, Warden, Technomancer     |
