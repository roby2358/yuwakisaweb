'use strict';
// text.js — every line the player reads, in one table keyed by event or label
// name. Each entry has a kind and an array of variants (even when there is only
// one); say(key, vars) picks a variant through Rando, styles it by kind and fills
// its {named} placeholders. A missing key, a placeholder left unfilled, or a var
// the line doesn't use throws: there is no fallback text.
//
// Kinds:
//   label     — buttons, titles, HUD and panel text, tooltips: plain text
//   log       — combat-log lines: plain text (colour classes stay at the call site)
//   narration — dialog prose: one <p> per paragraph (paragraphs split on a blank line)
//   stage     — stage directions: italic paragraphs
//   speech    — spoken lines: quoted paragraphs (the call site may wrap them in a colour)
// In the three prose kinds **text** is bold. Functional text (labels, mechanical
// log lines) keeps one variant so the UI stays learnable. Skill names and item
// names are data in config.js and arrive through placeholders.

const TEXT = (() => {
    const entry = kind => (...variants) => ({ kind, variants });
    const label = entry('label');
    const log = entry('log');
    const narration = entry('narration');
    const stage = entry('stage');
    const speech = entry('speech');
    return {
        // ---- Buttons ----
        btn_ok: label('OK'),
        btn_steady: label('Steady'),
        btn_continue: label('Continue'),
        btn_accept: label('Accept'),
        btn_decline: label('Decline'),
        btn_rest: label('Rest'),
        btn_weaponsmith: label('Weaponsmith'),
        btn_magicsmith: label('Magicsmith'),
        btn_train: label('Train'),
        btn_leave: label('Leave'),
        btn_learn: label('Learn'),
        btn_search: label('Search'),
        btn_done: label('Done'),
        btn_cancel: label('Cancel'),
        btn_return: label('Return'),
        btn_equip: label('Equip'),
        btn_unequip: label('Unequip'),
        btn_buy: label('Buy {gold}g'),
        btn_sell: label('Sell {gold}g'),
        btn_sell_all: label('Sell all {gold}g'),
        confirm_new_game: label('Start a new game?'),

        // ---- HUD, skill bar and canvas captions ----
        hud_turn: label('Turn {turn}'),
        hud_level: label('Lv {level}'),
        hud_gold: label('{gold}g'),
        hud_mp: label('MP {mp}'),
        hud_unknown: label('Unknown'),
        hud_enemy: label('{name} (HP {hp}/{max})'),
        hud_threat_map: label('Threat Map — Space/click to dismiss'),
        hud_world_map: label('World Map — M/Esc to close'),
        slot_ranged: label('Ranged'),
        ae_n: label('{n} AE'),
        why_need_ae: label('Need {n} AE'),
        why_phase_step_used: label('Phase Step already used this turn!'),
        why_sprint_used: label('Sprint already used this turn!'),
        why_too_close: label('Too close to enemies!'),
        why_shattered: label('Cannot use on shattered terrain!'),

        // ---- Character panel ----
        stat_might: label('Might'),
        stat_reflex: label('Reflex'),
        stat_warding: label('Warding'),
        stat_vigor: label('Vigor'),
        stat_line: label('{stat}: {n}'),
        char_points: label('Points: {n}'),
        char_sp: label('SP: {sp} / {max}'),
        char_attack: label('Attack: {wpn} + {stat}'),
        char_defense: label('Defense: {n}'),
        char_dodge: label('Dodge: {n}%'),
        char_vision: label('Vision: {n}'),
        char_mp: label('MP: {n}'),
        char_empty_slot: label('(empty)'),
        metric_title: label('TURN TIMING'),
        metric_all_turns: label('All turns'),
        metric_outside_poi: label('Outside POI'),
        metric_row: label('{label} (n={n})'),
        metric_stats: label('avg {avg} · p10 {p10} · p25 {p25} · p50 {p50} · p75 {p75} · p90 {p90}'),
        metric_ms: label('{ms}ms'),
        metric_no_data: label('no data'),

        // ---- Skills and inventory panels ----
        skills_equipped: label('EQUIPPED (click to unequip)'),
        skills_learned: label('LEARNED (click to equip)'),
        skills_latent: label('Latent'),
        skills_empty_slot: label('Slot {n}: Empty'),
        inv_gold: label('Gold: {gold}'),
        inv_no_items: label('No items'),

        // ---- Combat log: fighting ----
        log_dmg_to_enemy: log('{source}: {dmg} dmg to {name}'),
        log_dmg_to_you: log('{source}: {dmg} dmg to you'),
        log_stunned: log('Stunned!'),
        log_ranged_negated: log('Ranged attack negated!'),
        log_warp_absorbed: log('Warp Shield absorbed the hit!'),
        log_warp_flickers: log('Warp Shield flickers — the hit lands.'),
        log_dodged: log('Dodged!'),
        log_reflect_fails: log('Reflect fails!'),
        log_reflect_hit: log('Reflect: {dmg} dmg to {name}'),
        log_thorns: log('Thorns: {dmg} dmg to {name}'),
        log_burning_aura: log('Burning aura: {name} is burning!'),
        log_unraveler_reforms: log('The Unraveler reforms within another chaos spawn!'),
        log_defeated: log('{name} defeated!'),
        log_gold: log('+{gold}g'),
        log_one_ae: log('+1 AE'),
        log_heal_on_kill: log('+{n} HP (heal on kill)'),
        log_soul_harvest: log('Soul Harvest: +{n} XP'),
        log_opportunist: log('Opportunist: +{gold}g'),
        found_item: log('Found: {item}'),
        found_magic_item: log('Found: {item}!'),
        log_guardian_falls: log('The guardian falls! Use Restore near the breach to seal it.'),
        log_xp: log('+{n} XP'),
        log_level_up: log('LEVEL UP! Now level {level}'),
        log_skill_point: log('+{n} Skill Point'),
        log_engaged: log('Engaged! Half MP.'),
        log_no_ranged_weapon: log('No ranged weapon!'),
        log_no_targets_in_range: log('No targets in range!'),
        log_no_valid_targets: log('No valid targets!'),
        log_garrison_ready: log('A garrison stands ready!'),
        log_garrison_slays: log('Garrison slays {name}!'),

        // ---- Combat log: the map ----
        log_food: log('+{n} HP (food)'),
        log_gold_harvest: log('+{gold}g (harvest)'),
        log_gold_deposit: log('+{gold}g (gold deposit)'),
        log_gem_sp: log('+1 SP (skill gem)'),
        log_gem_xp: log('The skill gem dissolves into experience.'),
        log_gem_glints: log('A skill gem glints nearby!'),
        log_one_sp: log('+1 SP'),
        log_breach_sealed: log('Breach sealed! ({n} total)'),
        log_maw_sealed: log('The Maw is sealed. A scroll smolders in the quieted ground nearby.'),
        log_fully_rested: log('Fully rested.'),
        log_rested: log('Rested: +{hp} HP, +{ae} AE'),
        log_sanctuary: log('Sanctuary! You rest in the wilds.'),
        log_reward_haven: log('+{gold}g from haven'),
        log_reward_village: log('+{gold}g from village'),
        log_sage_gift: log('The Wise Man gives you {item}!'),
        log_sage_teaches: log('The Wise Man teaches {skill}!'),
        log_scroll_sp: log('You unfurl a scroll; its lore crystallizes into a Skill Point.'),
        log_scroll_xp: log('You unfurl a scroll; its lore dissolves into experience.'),
        log_scroll_learn: log('You unfurl a scroll and learn {skill}!'),
        log_shop_new_item: log('A new {item} has appeared in the shop!'),
        log_bought_skill: log('Learned {skill}'),
        log_bought: log('Bought {item}'),
        log_sold_all: log('Sold {n} items for {gold}g'),
        log_sold: log('Sold {item} for {gold}g'),
        log_ruins_clear_first: log('Clear the area before exploring the ruins.'),
        log_ruins_stir: log('Something stirs in the ruins...'),
        log_ruins_new_creatures: log('New creatures have moved into the ruins!'),
        log_ruins_nothing: log('Nothing of interest here.'),
        log_no_arts_sp: log('No new arts within reach — the insight becomes a Skill Point.'),
        log_no_arts_xp: log('No new arts within reach — the insight dissolves into experience.'),
        log_learned: log('Learned {skill}!'),

        // ---- The Unraveler and the Maw ----
        title_unraveler: label('The Unraveler'),
        unraveler_sighted: narration('A chaos-wrought figure stirs near the Maw. **The Unraveler** walks the world.\n\nWhile it lives, the Maw cannot be sealed. Hunt it down — and beware: each time you fell it, it reforms within another chaos spawn until none remain.'),
        unraveler_jumped: narration('The Unraveler has jumped to another host!'),
        title_unraveler_vanquished: label('The Unraveler Vanquished'),
        unraveler_vanquished: narration('The Unraveler is vanquished! Now close the Maw!'),
        title_maw_sealed: label('The Maw is Sealed'),
        maw_sealed: narration('You have closed the Maw. The world breathes again.\n\nWhere the rift collapsed, a **\u{1F4DC} scroll** has settled into the ground nearby. Seek it out.'),
        title_breach_sealed: label('Breach Sealed'),
        breach_loot: narration('Closing the breach scatters its hoard...'),
        loot_gold: label('Found {gold} gold!'),

        // ---- Havens and villages ----
        title_haven: label('{symbol} Haven'),
        haven_intro: narration('A place of safety amid the chaos.'),
        title_village: label('{symbol} Village'),
        village_intro: narration('A brief respite from the wilds.'),
        offering: label('Offering: {gold} gold'),
        gratitude_haven: narration(
            'The garrison salutes you. "The realm stands stronger for your service."',
            'A captain approaches with a pouch of coin. "The crown recognizes your valor."',
            "The haven's council offers a formal thanks and a modest stipend.",
            '"We feared the corruption would reach our walls. You have our gratitude."',
            'A herald announces your deed to the fortress. Soldiers raise their blades in honor.',
            '"The mages sensed the restoration. The haven is in your debt, warrior."',
            "The keep's steward presents you with a reward from the treasury.",
            '"Few would brave the chaos as you have. Accept this with our thanks."',
            'Word of your deed spreads quickly through the haven. A collection is taken.',
            'The haven commander clasps your hand. "You\'ve bought us time. Use this well."'),
        gratitude_village: narration(
            'A farmer presses a few coins into your hand. "Bless you, stranger."',
            'The village elder hobbles over with a small pouch. "It ain\'t much, but it\'s honest."',
            'Children run out to greet you. Their parents follow with a modest gift.',
            '"Our crops might grow again, thanks to you." A villager offers what they can spare.',
            'An old woman waves you over. "Take this. You\'ve earned more than we can give."',
            'The innkeeper sets out a meal and slides some coin across the table.',
            '"We thought we\'d have to abandon our homes. Thank you." They pass the hat.',
            'A shepherd offers a pouch of coin. "The flock can graze safely now."',
            'Smoke rises from the village hearths again. A grateful elder finds you.',
            '"Stranger, you\'ve given us hope." The village pools together a small reward.'),

        // ---- The Wise Man's hut ----
        title_hut: label("{symbol} Wise Man's Hut"),
        sage_peers: stage('An old sage peers at you.'),
        sage_nothing: speech('I have nothing to teach you at this time.'),
        sage_rummages: stage('The sage rummages through a cluttered shelf.'),
        sage_gift: speech('I have this lying around. Perhaps it will be of use.'),
        gift_item: label('{item}!'),
        sage_eyes_light: stage("The sage's eyes light up."),
        sage_teach: speech('I can teach you **{skill}**.'),

        // ---- Scrolls ----
        title_ancient_scroll: label('\u{1F4DC} Ancient Scroll'),
        title_scroll: label('\u{1F4DC} {skill}'),
        scroll_empty: narration('You unfurl an ancient scroll, but it holds no art new to you.'),
        scroll_note_sp: label('Its lingering knowledge condenses into a Skill Point.'),
        scroll_note_xp: label('Your Skill Points are already at their peak, so it dissolves into {xp} XP instead.'),
        scroll_return: stage('You unfurl the scroll the sealed Maw left behind. The way home opens to you. Walk the land as long as you wish; invoke RETURN to tally your journey.'),
        scroll_learn: stage('You unfurl an ancient scroll. Its knowledge becomes yours.'),
        scroll_added: label('Added to your skills. If your hotbar was full, equip it from the Skills panel.'),

        // ---- Shops ----
        title_weaponsmith: label('{symbol} Weaponsmith'),
        title_magicsmith: label('{symbol} Magicsmith'),
        shop_gold: label('Your gold: {gold}'),
        shop_skills: label('Skills:'),
        shop_sell: label('Sell:'),
        shop_sell_all_items: label('All non-magic items'),
        shop_hint: label('Click an item to inspect it.'),

        // ---- Train ----
        title_train: label('{symbol} Train'),
        train_help: label('Click → to train and level up (rising cost +1, +2, +3, +4, +5; max 5). Click ← to level down, or make latent at level 1.'),
        train_sp: label('SP available: {free} of {sp}'),
        train_col_latent: label('Latent'),
        train_col_trained: label('Trained'),
        train_hint: label('Click a skill to train it or level it up.'),
        train_state_latent: label('latent'),
        train_state_trained: label('trained'),
        train_tip_train: label('Train (1 SP)'),
        train_tip_need_one: label('Need 1 SP'),
        train_tip_no_levels: label('No levels'),
        train_tip_max: label('Max level'),
        train_tip_level_up: label('Level up ({n} SP)'),
        train_tip_need: label('Need {n} SP'),
        train_tip_level_down: label('Level down'),
        train_tip_make_latent: label('Make latent'),

        // ---- Ruins ----
        title_ruins: label('{symbol} Ruins'),
        ruins_new: narration('Ancient ruins loom before you.'),
        ruins_quiet: narration('The ruins are quiet…'),
        ruins_loot: narration('You explore the ruins...'),

        // ---- Level up and skill choice ----
        title_level_up: label('Level Up!'),
        levelup_level: label('Level {level}!'),
        levelup_assign: stage('Assign {n} stat points:'),
        levelup_remaining: label('Remaining: {n}'),
        title_new_skill: label('New Skill!'),
        skill_choice_prompt: narration('Choose a skill to learn:'),

        // ---- Return and the end ----
        title_return: label('Return'),
        return_confirm: narration('End your journey here? Your final score will be tallied.'),
        endgame_victory: label('VICTORY!'),
        endgame_defeat: label('DEFEAT'),
        endgame_turns: label('Turns: {turn}'),
        endgame_level: label('Level: {level}'),
        endgame_score: label('Final Score: {score}'),

        // ---- Costs (actions.js) ----
        mp_all: label('All MP'),
        mp_n: label('{n} MP'),
        skill_cost: label('{ae} AE, {mp}'),
        word_hex: label('hex'),
        word_hexes: label('hexes'),

        // ---- Damage sources: the "{source}: N dmg to X" names ----
        src_melee: label('Melee'),
        src_ranged: label('Ranged'),
        src_counters: label('{name} counters'),
        src_numbered: label('{label} {n}'),
        src_bounce: label('{label} bounce'),
        src_chain: label('Chain'),
        src_chain_bounce: label('Chain bounce'),
        src_reverberate: label('Reverberate'),
        src_reverberate_bounce: label('Reverberate bounce'),
        src_cleave: label('Cleave'),
        src_sweep: label('Sweep'),
        src_splash: label('Splash'),
        src_pierce: label('Pierce'),
        src_void_strike: label('Void Strike'),
        src_cosmic_bolt: label('Cosmic Bolt'),
        src_shockwave: label('Shockwave'),
        src_siphon_strike: label('Siphon Strike'),
        src_penetrating_shot: label('Penetrating Shot'),
        src_breach_pulse: label('Breach Pulse'),
        src_chain_lightning: label('Chain Lightning'),
        src_immolate: label('Immolate'),
        src_stun: label('Stun'),
        src_shredding_blow: label('Shredding Blow'),
        src_meteor: label('Meteor'),
        src_dimensional_rend: label('Dimensional Rend'),
        src_execute: label('Execute'),
        src_ricochet: label('Ricochet'),
        src_starfall: label('Starfall'),
        src_salvo: label('Salvo'),
        src_havens_light: label("Haven's Light"),
        src_aether_blast: label('Aether Blast'),
        src_lifedrain_blast: label('Lifedrain Blast'),

        // ---- Combat log: strikes and weapon effects ----
        log_breach_jewel: log('Breach Jewel: +{n} might!'),
        log_aether_signet: log('Aether Signet: +{n} dmg!'),
        log_shreds: log('Shreds {n} defense!'),
        log_sundered: log('Sundered {n} defense!'),
        log_lifesteal: log('+{n} HP (lifesteal)'),
        log_siphon_ae: log('+{n} AE (siphon)'),
        log_siphon_hp: log('+{n} HP (siphon)'),
        log_channel_self: log('Channel: {n} dmg to you'),
        log_burning: log('{name} is burning!'),
        log_knocked_back: log('Knocked back!'),
        log_chain_hit: log('{source} chain: {dmg} dmg to {name}'),
        log_sniper: log('Sniper: +{n} at max range'),
        log_blink: log('Blink Ring: teleported!'),
        log_not_enough_aether: log('Not enough Aether!'),

        // ---- Combat log: skills ----
        log_no_shattered_in_range: log('No shattered terrain in range!'),
        log_restored: log('Restored {n} {hexes}! +1 AE'),
        log_restored_gold: log('Restored {n} {hexes}! +1 AE, +{gold}g'),
        log_phase_step: log('Phase Step!'),
        log_water_skip: log('Water Skip!'),
        log_mountain_skip: log('Mountain Skip!'),
        log_shockwave: log('Shockwave!'),
        log_warp_shield: log('Warp Shield active!'),
        log_reflect: log('Reflect stance!'),
        log_channel_full: log('Channel Aether: already at max AE.'),
        log_channel: log('Channel Aether: -{hp} HP, +{ae} AE'),
        log_healed: log('Healed {n} HP'),
        log_sprint: log('Sprint: +{n} MP'),
        log_gravity_well: log('Gravity Well!'),
        log_meteor: log('Meteor!'),
        log_rend_cost: log('Dimensional Rend tears at you: -{n} HP'),
        log_rend_fizzle: log('Health too low — the rift fizzles.'),
        log_no_havens: log('No havens exist!'),
        log_recall: log('Recall! Teleported to haven.'),
        log_aether_tap: log('Aether Tap: +{ae} AE ({n} clean hexes)'),
        log_farsight: log('Farsight! Vision expanded.'),
        log_struck_gold: log('Struck gold nearby!'),
        log_prospect_one: log('Prospect: revealed 1 gold deposit'),
        log_prospect_many: log('Prospect: revealed {n} gold deposits'),
        log_prospect_none: log('Prospect: sensed the earth.'),
        log_commune_one: log('Commune: revealed 1 location!'),
        log_commune_many: log('Commune: revealed {n} locations!'),
        log_commune_none: log('Commune: the world has no more secrets.'),
        log_no_salvage: log('No shattered terrain nearby to salvage!'),
        log_salvage: log('Salvage: restored {n} {hexes}, {gold}g in deposits!'),
        log_insight: log('Insight! A new skill reveals itself!'),
        log_insight_fail: log('The patterns elude you...'),
        log_spirit_walk: log('Spirit Walk!'),
        log_ground_weeps: log('The ground weeps... threats revealed.'),
        log_renew: log('Renew: {n} stat points refunded.'),
        log_sanctify_blocked: log('Cannot sanctify — already a point of interest!'),
        log_looted: log('Looted {gold}g!'),
        log_looted_many: log('Looted {gold}g from {n} enemies!'),
        log_need_settlement: log('Must be at a haven or village!'),
        log_havens_light: log("Haven's Light: hit {n} enemies!"),
        log_ae_per_hit: log('+{n} AE ({hits} hit)'),
        log_hp_per_hit: log('+{n} HP ({hits} hit)'),
        log_garrison_gold: log('Need {gold}g to commission a garrison.'),
        log_garrison_poi: log('Cannot build on an existing point of interest.'),
        log_garrison_here: log('Cannot build here.'),
        log_garrison_sight: log('A haven or village must be in sight to commission a garrison.'),
        log_garrison_commissioned: log('Garrison commissioned. Construction underway.'),
        log_harvest_one: log('Bountiful Harvest: 1 crop sprouted!'),
        log_harvest_many: log('Bountiful Harvest: {n} crops sprouted!'),
        log_harvest_none: log('No suitable ground for crops.'),

        // ---- Restore and the Maw ----
        title_restore: label('Restore'),
        restore_failed: narration('Restore did not close the breach.'),
        title_maw_resists: label('The Maw Resists'),
        maw_resists: narration('The Maw seethes with chaos and refuses to close. The Unraveler must be defeated first before the Maw can be sealed.'),
        title_maw_hungers: label('The Maw Hungers'),
        maw_hungers: narration('Open breaches still feed the Maw. Seal every breach before the Maw can be closed.\n\nThe remaining breaches reveal themselves on your map.'),

        // ---- Item stat lines (itemStatLine) ----
        stat_damage: label('Dmg {n}'),
        stat_range: label('Range {n}'),
        stat_defense: label('Def {n}'),
        stat_short_damage: label('Dmg'),
        stat_short_range: label('Range'),
        stat_short_defense: label('Def'),
        // ---- Weapon effects
        spec_armor_pierce: label('Pierce {pierceAmount} def'),
        spec_aether_siphon: label('+{siphonAmount} AE/hit'),
        spec_burn: label('Burn {burnDamage}/turn'),
        spec_chain: label('Chain {chainCount}'),
        spec_chaos_bonus: label('+{chaosBonus} vs chaos'),
        spec_counter_mastery: label('Counter-attack on enemy melee'),
        spec_defense_shred: label('-{shredAmount} def/hit'),
        spec_double_strike: label('Double strike'),
        spec_triple_strike: label('Triple strike'),
        spec_ignore_defense: label('Ignore def'),
        spec_knockback: label('Knockback 1'),
        spec_lifesteal: label('+{lifestealAmount} HP/hit'),
        spec_channel: label('+{channelBonus} dmg, {channelDamage} self-dmg'),
        spec_reverberate: label('Chain {chainCount} +{chainBonus}/jump'),
        spec_riposte: label('+{riposteDamage} counter-atk'),
        // ---- Ranged weapon effects
        spec_double_shot: label('Double shot'),
        spec_triple_shot: label('Triple shot'),
        spec_free_ranged: label('Free ranged'),
        spec_free_action: label('0 MP attack'),
        spec_piercing: label('Pierce-through'),
        spec_sniper: label('+{sniperBonus} at max range'),
        spec_splash: label('Splash {splashDamage}'),
        spec_stun: label('+{stunBonus}% stun'),
        spec_sweep: label('Sweep {sweepCount} adjacent to you'),
        // ---- Armor effects
        spec_burning_aura: label('Burn adjacent {burnAuraDamage}/turn'),
        spec_counter_deflect: label('-{counterDeflect}% counter-attack dmg'),
        spec_dodge_bonus: label('+{dodgeBonus}% dodge'),
        spec_heal_on_kill: label('+{healOnKill} HP/kill'),
        spec_high_def_mp_penalty: label('+{defBonus} def -{mpPenalty} MP'),
        spec_last_stand: label('+{lastStandBonus} def <50% HP'),
        spec_momentum: label('+{momentumBonus} def/hex moved'),
        spec_ranged_defense: label('+{rangedDefenseBonus} def vs ranged'),
        spec_ranged_immune: label('Ranged immune'),
        spec_thorns: label('{thornsPercent}% reflect'),
        spec_wall_of_steel: label('+{wallBonus} melee if stationary'),
        // ---- Passive effects
        spec_aether_bonus: label('+{aetherBonus} max AE'),
        spec_aether_discount: label('-{aetherDiscount} AE skill cost'),
        spec_aether_regen: label('+{aetherRegen} AE/turn'),
        spec_aether_signet: label('+{aetherSignetDamage} dmg when AE full (costs {aetherSignetCost} AE)'),
        spec_blink_ring: label('Blink {blinkRange} hex melee +{blinkBonus}'),
        spec_breach_jewel: label('+{breachBonus} might near breach'),
        spec_chaos_attune: label('+{chaosAttuneMight} might +{chaosAttuneDef} def on corrupted'),
        spec_chaos_circlet: label('+1 AE/turn on corrupted'),
        spec_chaos_defense: label('+{chaosDefenseBonus} def on shattered/distressed'),
        spec_disengage: label('No engagement MP penalty'),
        spec_displacement_immune: label('No displacement'),
        spec_heal: label('+{healPerTurn} HP/turn'),
        spec_hp_bonus: label('+{hpBonus} HP'),
        spec_mp_bonus: label('+{mpBonus} MP'),
        spec_opportunist: label('25% gold on kill'),
        spec_ranger_defense: label('+{rangerBonus} def on forest/hills'),
        spec_reveal_maw: label('Reveals chaos'),
        spec_revive: label('+{reviveHp} HP +{reviveAether} AE/turn'),
        spec_soul_harvest: label('+{soulHarvestXP} XP/kill'),
        spec_strider: label('Rough terrain 1 MP'),
        spec_threat_shroud: label('-2 enemy detect range'),
        spec_vigor_bonus: label('+{vigorBonus} vigor'),
        spec_vision_bonus: label('+{visionBonus} vision'),
        spec_wraith_immune: label('Wraith immune'),
        // ---- Legacy specials (origitems compatibility)
        spec_mp_penalty: label('-{mpPenalty} MP'),
        spec_regen: label('+{regenAmount} HP/turn'),
        spec_armor_regen: label('+{regenAmount} HP/turn'),
        spec_armor_aether_bonus: label('+{aetherBonus} max AE'),
        spec_regen_combo: label('+{regenAmount} HP +1 AE/turn'),
        spec_wall_crown: label('+{wallCrownBonus} melee if stationary'),
        spec_aether_regen_small: label('+1 AE/turn'),
        spec_aether_regen_large: label('+3 AE/turn'),
        spec_cleave: label('Cleave'),
        spec_charge_mult: label('x{chargeMultiplier} dmg if moved'),
        spec_charge: label('+{chargeBonus} if moved'),

        // ---- Skill power lines (Skills panel, Train panel) ----
        pow_cosmic_bolt: label('{base}+War'),
        pow_shockwave: label('{base}+Mgt · AoE {range} · push'),
        pow_piercing_shot: label('{base}+Ref · ignores def'),
        pow_breach_pulse: label('{base}+War · AoE {range}'),
        pow_chain_lightning: label('{base}+War · chains {n}'),
        pow_meteor: label('{base}+War · blast r{radius}'),
        pow_starfall: label('{base}+War×2 · AoE {range}'),
        pow_void_salvo: label('{base}+Ref · {n} shots'),
        pow_ricochet: label('{base}+Ref · bounces {n}'),
        pow_lifedrain_blast: label('{base}+Vig · AoE {range} · +{n}HP/hit'),
        pow_aether_blast: label('{base}+War/2 · AoE {range} · +{n}AE/hit'),
        pow_havens_light: label('{base}+War · AoE {range}'),
        pow_void_strike: label('(wpn+Mgt+War)×{mult}'),
        pow_siphon_strike: label('(wpn+Mgt)×{mult} · heals'),
        pow_execute: label('(wpn+Mgt)×{mult} · <50% HP'),
        pow_dimensional_rend: label('wpn×{mult}+Vig · −{hp} HP'),
        pow_sweep: label('wpn+Mgt · +{n} adjacent'),
        pow_stun_blow: label('wpn+Mgt · +{n}% stun'),
        pow_immolate: label('wpn+Mgt · burn {n}'),
        pow_sundering_blow: label('wpn+Mgt · shred {n} def'),
        pow_mending_light: label('{n}+Vig×3 heal'),
        pow_hits: label('Hits {n}'),
        es_sprint: label('+{n} MP'),
        es_warp_shield: label('Block {n}%'),
        es_reflect: label('Reflect {n}% chance'),
        es_channel: label('{n}:1 HP→AE'),
        es_aether_tap: label('1 AE / {n} hex'),
        es_skill_seek: label('Learn {n}%'),
        es_sanctuary: label('Heal 1/{n}'),
        es_loot: label('Gold ×{mult}'),
    };
})();

const TEXT_PLACEHOLDER = /\{(\w+)\}/g;

function textParagraphs(s, wrap) {
    return s.split('\n\n').map(wrap).join('');
}

function textBold(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

const TEXT_RENDER = {
    label: s => s,
    log: s => s,
    narration: s => textParagraphs(textBold(s), p => `<p>${p}</p>`),
    stage: s => textParagraphs(textBold(s), p => `<p><i>${p}</i></p>`),
    speech: s => textParagraphs(textBold(s), p => `<p>"${p}"</p>`),
};

// The vars a line needs, read off source by placeholder name (every variant of
// an entry uses the same placeholders, so the first variant names them all).
function textVarsFrom(key, source) {
    const entry = TEXT[key];
    if (!entry) throw new Error(`text: no entry "${key}"`);
    const vars = {};
    for (const m of entry.variants[0].matchAll(TEXT_PLACEHOLDER)) vars[m[1]] = source[m[1]];
    return vars;
}

function say(key, vars) {
    const entry = TEXT[key];
    if (!entry) throw new Error(`text: no entry "${key}"`);
    const template = TEXT_RENDER[entry.kind](Rando.choice(entry.variants));
    const used = new Set();
    const out = template.replace(TEXT_PLACEHOLDER, (m, name) => {
        if (vars[name] === undefined) throw new Error(`text: "${key}" needs {${name}}`);
        used.add(name);
        return String(vars[name]);
    });
    for (const name of Object.keys(vars)) {
        if (!used.has(name)) throw new Error(`text: "${key}" has no {${name}}`);
    }
    return out;
}

// An item special's stat-line text. Each spec_ line's placeholders are named
// after the item fields it reads, so the vars come straight off the item.
function itemSpecialText(item) {
    const key = item.special === 'charge' && item.chargeMultiplier ? 'spec_charge_mult' : 'spec_' + item.special;
    return say(key, textVarsFrom(key, item));
}
