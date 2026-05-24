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

The first verb in each effect's pool is a unique signature word for that effect — if you see a "Slashing Sword," it's a charge weapon. The other two verbs in each pool are drawn from the shared cross-applicable pool.

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
| `armor_pierce`    | Ignore 2 enemy defense                                 | Cleaving, Rending, Piercing        | Slayer, Warden, Operator           |
| `armor_pierce`    | Ignore 4 enemy defense                                 | Cleaving, Rending, Piercing        | Slayer, Warden, Operator           |
| `aether_siphon`   | Gain 1 Aether on hit                                   | Draining, Weeping, Withering       | Witch, Technomancer, Seer          |
| `aether_siphon`   | Gain 2 Aether on hit                                   | Draining, Weeping, Withering       | Witch, Technomancer, Seer          |
| `burn`            | Target takes 2 fire damage next turn                   | Igniting, Searing, Burning         | Zealot, Witch, Xenarch             |
| `burn`            | Target takes 3 fire damage next turn                   | Igniting, Searing, Burning         | Zealot, Witch, Xenarch             |
| `burn`            | Target takes 5 fire damage next turn                   | Igniting, Searing, Burning         | Zealot, Witch, Xenarch             |
| `chain`           | Damage chains to 2 nearby enemies                      | Arcing, Shrieking, Flickering      | Technomancer, Operator, Starpilot  |
| `chain`           | Damage chains to 3 nearby enemies                      | Arcing, Shrieking, Flickering      | Technomancer, Operator, Starpilot  |
| `chain`           | Damage chains to 5 nearby enemies                      | Arcing, Shrieking, Flickering      | Technomancer, Operator, Starpilot  |
| `chaos_bonus`     | +2 damage vs chaos enemies                             | Maddening, Warding, Sundering      | Sentinel, Warden, Zealot           |
| `chaos_bonus`     | +4 damage vs chaos enemies                             | Maddening, Warding, Sundering      | Sentinel, Warden, Zealot           |
| `chaos_bonus`     | +6 damage vs chaos enemies                             | Maddening, Warding, Sundering      | Sentinel, Warden, Zealot           |
| `counter_mastery` | Counter-attack after being hit in melee                | Vigilant, Warding, Piercing        | Warden, Sentinel, Slayer           |
| `defense_shred`   | Permanently reduce target's defense by 1               | Shredding, Sundering, Rending      | Surgeon, Operator, Slayer          |
| `defense_shred`   | Permanently reduce target's defense by 2               | Shredding, Sundering, Rending      | Surgeon, Operator, Slayer          |
| `double_strike`   | Strike twice in melee                                  | Twinning, Flickering, Blazing      | Replicant, Slayer, Pilot           |
| `triple_strike`   | Strike three times in melee                            | Trebling, Flickering, Shrieking    | Replicant, Slayer, Zealot          |
| `ignore_defense`  | Bypass defense entirely                                | Phasing, Piercing, Sundering       | Xenarch, Surgeon, Technomancer     |
| `knockback`       | Push enemy 1 hex away                                  | Hurling, Sundering, Shrieking      | Warden, Sentinel, Slayer           |
| `lifesteal`       | Heal 1 HP on hit                                       | Transfusioning, Thirsting, Weeping       | Wraith, Witch, Surgeon             |
| `lifesteal`       | Heal 2 HP on hit                                       | Transfusioning, Thirsting, Weeping       | Wraith, Witch, Surgeon             |
| `lifesteal`       | Heal 3 HP on hit                                       | Transfusioning, Thirsting, Weeping       | Wraith, Witch, Surgeon             |
| `charge`          | 4 Bonus damage after moving                            | Slashing, Sundering, Shrieking     | Slayer, Pilot, Wayfarer            |
| `charge`          | 6 Bonus damage after moving                            | Slashing, Sundering, Shrieking     | Slayer, Pilot, Wayfarer            |
| `charge`          | 8 Bonus damage after moving                            | Slashing, Sundering, Shrieking     | Slayer, Pilot, Wayfarer            |
| `charge`          | Double damage after moving                             | Slashing, Sundering, Shrieking     | Slayer, Pilot, Wayfarer            |
| `recoil`          | 3 High damage but hurts self 1                         | Kicking, Shrieking, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`          | 5 High damage but hurts self 3                         | Kicking, Shrieking, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`          | 8 High damage but hurts self 5                         | Kicking, Shrieking, Searing        | Zealot, Slayer, Xenarch            |
| `reverberate`     | Damage chains to 3 nearby enemies, +2 damage each jump | Echoing, Shrieking, Sundering      | Technomancer, Xenarch, Operator    |
| `riposte`         | Enhanced counter-attack 1 damage                       | Riposting, Warding, Piercing       | Warden, Sentinel, Slayer           |
| `riposte`         | Enhanced counter-attack 2 damage                       | Riposting, Warding, Piercing       | Warden, Sentinel, Slayer           |
| `riposte`         | Enhanced counter-attack 3 damage                       | Riposting, Warding, Piercing       | Warden, Sentinel, Slayer           |

## Ranged Weapon Effects

| Effect           | Description                              | Verbings                           | Archetypes                        |
|------------------|------------------------------------------|------------------------------------|------------------------------------|
| `armor_pierce`   | Ignore 2 enemy defense                   | Cleaving, Rending, Piercing        | Slayer, Ranger, Operator           |
| `armor_pierce`   | Ignore 4 enemy defense                   | Cleaving, Rending, Piercing        | Slayer, Ranger, Operator           |
| `aether_siphon`  | Gain 1 Aether on hit                     | Draining, Weeping, Withering       | Witch, Seer, Technomancer         |
| `aether_siphon`  | Gain 2 Aether on hit                     | Draining, Weeping, Withering       | Witch, Seer, Technomancer         |
| `burn`           | Target takes 2 fire damage next turn     | Igniting, Searing, Burning         | Zealot, Witch, Xenarch             |
| `burn`           | Target takes 3 fire damage next turn     | Igniting, Searing, Burning         | Zealot, Witch, Xenarch             |
| `burn`           | Target takes 5 fire damage next turn     | Igniting, Searing, Burning         | Zealot, Witch, Xenarch             |
| `chain`          | Damage chains to 2 nearby enemies        | Arcing, Shrieking, Flickering      | Technomancer, Operator, Starpilot  |
| `chain`          | Damage chains to 3 nearby enemies        | Arcing, Shrieking, Flickering      | Technomancer, Operator, Starpilot  |
| `chain`          | Damage chains to 5 nearby enemies        | Arcing, Shrieking, Flickering      | Technomancer, Operator, Starpilot  |
| `chaos_bonus`    | +2 damage vs chaos enemies               | Maddening, Warding, Sundering      | Sentinel, Warden, Zealot           |
| `chaos_bonus`    | +4 damage vs chaos enemies               | Maddening, Warding, Sundering      | Sentinel, Warden, Zealot           |
| `chaos_bonus`    | +6 damage vs chaos enemies               | Maddening, Warding, Sundering      | Sentinel, Warden, Zealot           |
| `defense_shred`  | Permanently reduce target's defense by 1 | Shredding, Sundering, Rending      | Surgeon, Operator, Slayer          |
| `defense_shred`  | Permanently reduce target's defense by 2 | Shredding, Sundering, Rending      | Surgeon, Operator, Slayer          |
| `double_shot`    | Fire two shots                           | Volleying, Flickering, Blazing     | Replicant, Ranger, Starpilot      |
| `triple_shot`    | Fire three shots                         | Storming, Shrieking, Blazing       | Replicant, Starpilot, Zealot      |
| `free_ranged`    | Ranged attack costs no Aether            | Loosing, Flickering, Warding       | Navigator, Seer, Wanderer          |
| `ignore_defense` | Bypass defense entirely                  | Phasing, Piercing, Sundering       | Xenarch, Surgeon, Technomancer     |
| `knockback`      | Push enemy 1 hex away                    | Hurling, Sundering, Shrieking      | Warden, Sentinel, Slayer           |
| `lifesteal`      | Heal 1 HP on hit                         | Transfusioning, Thirsting, Weeping       | Wraith, Witch, Surgeon             |
| `lifesteal`      | Heal 2 HP on hit                         | Transfusioning, Thirsting, Weeping       | Wraith, Witch, Surgeon             |
| `lifesteal`      | Heal 3 HP on hit                         | Transfusioning, Thirsting, Weeping       | Wraith, Witch, Surgeon             |
| `piercing`       | Shot passes through enemies              | Piercing, Rending, Sundering       | Ranger, Scout, Slayer              |
| `recoil`         | 5 High damage but hurts self 1           | Kicking, Shrieking, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`         | 8 High damage but hurts self 3           | Kicking, Shrieking, Searing        | Zealot, Slayer, Xenarch            |
| `recoil`         | 13 High damage but hurts self 5          | Kicking, Shrieking, Searing        | Zealot, Slayer, Xenarch            |
| `sniper`         | 2 Bonus damage at max range              | Sniping, Warding, Searing          | Ranger, Scout, Starpilot           |
| `sniper`         | 4 Bonus damage at max range              | Sniping, Warding, Searing          | Ranger, Scout, Starpilot           |
| `sniper`         | 8 Bonus damage at max range              | Sniping, Warding, Searing          | Ranger, Scout, Starpilot           |
| `splash`         | AoE damage around target                 | Bursting, Blazing, Shrieking       | Operator, Technomancer, Xenarch    |
| `sweep` (melee)  | Full damage to 2 adjacent enemies of target | Sweeping, Crashing, Reaping     | Slayer, Warden, Sentinel           |
| `sweep` (melee)  | Full damage to 3 adjacent enemies of target | Sweeping, Crashing, Reaping     | Slayer, Warden, Sentinel           |
| `sweep` (melee)  | Full damage to 5 adjacent enemies of target | Sweeping, Crashing, Reaping     | Slayer, Warden, Sentinel           |
| `stun` (melee)   | +20% stun chance on hit                  | Concussing, Stunning, Crushing     | Sentinel, Slayer, Warden           |
| `stun` (melee)   | +30% stun chance on hit                  | Concussing, Stunning, Crushing     | Sentinel, Slayer, Warden           |
| `stun` (melee)   | +40% stun chance on hit                  | Concussing, Stunning, Crushing     | Sentinel, Slayer, Warden           |

## Armor Effects

Defensive effects with a combat component -- reactive damage, evasion, or combat-conditional bonuses.

| Effect                | Description                                      | Verbings                           | Archetypes                        |
|-----------------------|--------------------------------------------------|------------------------------------|------------------------------------|
| `burning_aura`        | Deal 2 fire damage to adjacent enemies each turn | Smouldering, Blazing, Burning      | Zealot, Witch, Xenarch             |
| `burning_aura`        | Deal 5 fire damage to adjacent enemies each turn | Smouldering, Blazing, Burning      | Zealot, Witch, Xenarch             |
| `counter_deflect`     | Reduce enemy counter-attack damage by 50%        | Parrying, Deflecting, Warding      | Sentinel, Warden, Slayer           |
| `counter_deflect`     | Reduce enemy counter-attack damage by 70%        | Parrying, Deflecting, Warding      | Sentinel, Warden, Slayer           |
| `counter_deflect`     | Reduce enemy counter-attack damage by 90%        | Parrying, Deflecting, Warding      | Sentinel, Warden, Slayer           |
| `dodge_bonus`         | 10% Chance to completely avoid attacks           | Slipping, Flickering, Vanishing      | Scout, Wanderer, Wraith            |
| `dodge_bonus`         | 20% Chance to completely avoid attacks           | Slipping, Flickering, Vanishing      | Scout, Wanderer, Wraith            |
| `dodge_bonus`         | 30% Chance to completely avoid attacks           | Slipping, Flickering, Vanishing      | Scout, Wanderer, Wraith            |
| `heal_on_kill`        | 5 Restore HP when you kill an enemy              | Devouring, Thirsting, Rending      | Slayer, Wraith, Surgeon            |
| `heal_on_kill`        | 8 Restore HP when you kill an enemy              | Devouring, Thirsting, Rending      | Slayer, Wraith, Surgeon            |
| `high_def_mp_penalty` | +5 def -1 movement points                        | Lumbering, Warding, Sundering      | Sentinel, Warden, Xenarch          |
| `last_stand`          | 4 Bonus defense when below 50% HP                | Defiant, Warding, Shrieking        | Sentinel, Zealot, Warden           |
| `last_stand`          | 6 Bonus defense when below 50% HP                | Defiant, Warding, Shrieking        | Sentinel, Zealot, Warden           |
| `momentum`            | +1 defense per hex moved this turn               | Crushing, Streaming, Overbearing   | Wraith, Navigator, Wayfarer        |
| `momentum`            | +2 defense per hex moved this turn               | Crushing, Streaming, Overbearing   | Wraith, Navigator, Wayfarer        |
| `momentum`            | +3 defense per hex moved this turn               | Crushing, Streaming, Overbearing   | Wraith, Navigator, Wayfarer        |
| `ranged_immune`       | +2 defense to ranged attacks                     | Mirrored, Warding, Flickering      | Sentinel, Warden, Technomancer     |
| `ranged_immune`       | +4 defense to ranged attacks                     | Mirrored, Warding, Flickering      | Sentinel, Warden, Technomancer     |
| `ranged_immune`       | Immune to ranged attacks                         | Mirrored, Warding, Flickering      | Sentinel, Warden, Technomancer     |
| `thorns`              | Reflect 50% damage back to melee attackers       | Bristling, Piercing, Rending       | Sentinel, Warden, Xenarch          |
| `thorns`              | Reflect 100% damage back to melee attackers      | Bristling, Piercing, Rending       | Sentinel, Warden, Xenarch          |
| `wall_of_steel`       | +2 Bonus melee damage if stationary              | Stalwart, Warding, Sundering       | Sentinel, Warden, Slayer           |
| `wall_of_steel`       | +4 Bonus melee damage if stationary              | Stalwart, Warding, Sundering       | Sentinel, Warden, Slayer           |
| `wall_of_steel`       | +6 Bonus melee damage if stationary              | Stalwart, Warding, Sundering       | Sentinel, Warden, Slayer           |

## Passive Effects

Utility and stat effects that are always active or non-combat.

| Effect                | Description                                             | Verbings                           | Archetypes                        |
|-----------------------|---------------------------------------------------------|------------------------------------|------------------------------------|
| `aether_bonus`        | Increase max Aether 10                                  | Brimming, Flickering, Glowing      | Seer, Technomancer, Witch          |
| `aether_bonus`        | Increase max Aether 20                                  | Brimming, Flickering, Glowing      | Seer, Technomancer, Witch          |
| `aether_regen`        | Regenerate +1 Aether each turn                          | Welling, Whispering, Flickering       | Seer, Witch, Navigator             |
| `aether_regen`        | Regenerate +2 Aether each turn                          | Welling, Whispering, Flickering       | Seer, Witch, Navigator             |
| `aether_regen`        | Regenerate +3 Aether each turn                          | Welling, Whispering, Flickering       | Seer, Witch, Navigator             |
| `aether_signet`       | Bonus +3 damage when Aether is full (spends 3 Aether)   | Anointing, Blazing, Searing        | Technomancer, Xenarch, Zealot      |
| `aether_signet`       | Bonus +5 damage when Aether is full (spends 5 Aether)   | Anointing, Blazing, Searing        | Technomancer, Xenarch, Zealot      |
| `blink_ring`          | Melee attack enemies within 4 hexes by teleporting      | Blinking, Flickering, Shifting      | Navigator, Pilot, Wraith           |
| `breach_jewel`        | +4 might near a breach or Maw                           | Sealing, Blazing, Warding          | Sentinel, Warden, Zealot           |
| `breach_jewel`        | +6 might when near a breach or Maw                      | Sealing, Blazing, Warding          | Sentinel, Warden, Zealot           |
| `chaos_attune`        | +2 might and +2 defense on shattered/distressed terrain | Resonant, Withering, Warping       | Witch, Xenarch, Wanderer           |
| `chaos_attune`        | +4 might and +3 defense on shattered/distressed terrain | Resonant, Withering, Warping       | Witch, Xenarch, Wanderer           |
| `chaos_circlet`       | +1 Aether per turn on corrupted terrain                 | Twisting, Withering, Flickering    | Witch, Xenarch, Wanderer           |
| `chaos_defense`       | +2 defense on shattered/distressed terrain              | Sheltering, Warding, Withering     | Sentinel, Warden, Zealot           |
| `chaos_defense`       | +4 defense on shattered/distressed terrain              | Sheltering, Warding, Withering     | Sentinel, Warden, Zealot           |
| `disengage`           | No MP penalty for enemy engagement                      | Stepping, Flickering, Drifting      | Scout, Wanderer, Ranger            |
| `displacement_immune` | Immune to forced movement                               | Anchored, Warding, Sundering       | Sentinel, Warden, Navigator        |
| `heal`                | +1 HP per turn                                          | Mending, Soothing, Warding          | Surgeon, Seer, Wanderer            |
| `heal`                | +2 HP per turn                                          | Mending, Soothing, Warding          | Surgeon, Seer, Wanderer            |
| `heal`                | +3 HP per turn                                          | Mending, Soothing, Warding          | Surgeon, Seer, Wanderer            |
| `hp_bonus`            | +10 max HP                                              | Hardy, Warding, Blazing            | Warden, Sentinel, Zealot           |
| `hp_bonus`            | +20 max HP                                              | Hardy, Warding, Blazing            | Warden, Sentinel, Zealot           |
| `mp_bonus`            | +2 movement points                                      | Striding, Flickering, Blazing      | Wanderer, Wayfarer, Scout          |
| `mp_bonus`            | +4 movement points                                      | Striding, Flickering, Blazing      | Wanderer, Wayfarer, Scout          |
| `opportunist`         | 25% chance for 1-5 bonus gold on kill                   | Stalking, Flickering, Thirsting    | Scout, Ranger, Operator            |
| `ranger_defense`      | +1 defense on forest/hills terrain                      | Camouflaged, Warding, Flickering   | Ranger, Scout, Wanderer            |
| `ranger_defense`      | +2 defense on forest/hills terrain                      | Camouflaged, Warding, Flickering   | Ranger, Scout, Wanderer            |
| `ranger_defense`      | +4 defense on forest/hills terrain                      | Camouflaged, Warding, Flickering   | Ranger, Scout, Wanderer            |
| `reveal_maw`          | Show direction to the Maw                               | Scrying, Piercing, Flickering      | Seer, Navigator, Scout             |
| `revive`              | +1 HP +1 Aether per turn                                | Resurrecting, Renewing, Warding     | Surgeon, Seer, Wanderer            |
| `revive`              | +2 HP +2 Aether per turn                                | Resurrecting, Renewing, Warding     | Surgeon, Seer, Wanderer            |
| `soul_harvest`        | +2 XP on kill                                           | Reaping, Thirsting, Withering      | Wraith, Witch, Slayer              |
| `soul_harvest`        | +4 XP on kill                                           | Reaping, Thirsting, Withering      | Wraith, Witch, Slayer              |
| `strider`             | Rough terrain costs only 1 MP                           | Coursing, Flickering, Blazing      | Wanderer, Wayfarer, Ranger         |
| `threat_shroud`       | Reduce enemy detection range by 2                       | Cloaking, Veiling, Flickering      | Scout, Wraith, Wanderer            |
| `vision_bonus`        | +2 sight range                                          | Watching, Piercing, Flickering     | Seer, Scout, Navigator             |
| `vision_bonus`        | +4 sight range                                          | Watching, Piercing, Flickering     | Seer, Scout, Navigator             |
| `wraith_immune`       | Immune to Phase Wraith teleport ambush                  | Hallowed, Warding, Blazing         | Sentinel, Warden, Technomancer     |
