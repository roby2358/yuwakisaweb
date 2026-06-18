import {
    STARTING_STATS, STAT_POINTS_PER_LEVEL, MAX_DODGE,
    maxHP, maxAether, PLAYER_MP, BASE_VISION,
    EQUIP_SLOT, ALL_EQUIPMENT,
    TERRAIN_DEFENSE_BONUS, TERRAIN_RANGE_BONUS,
    RANGER_TERRAIN, isChaosTerrain, POI_RANGE_BONUS, weaponIsRanged
} from './config.js';
import { hexDistance } from './hex.js';

export class Player {
    constructor(startQ, startR) {
        this.q = startQ;
        this.r = startR;
        this.stats = { ...STARTING_STATS };
        this.hp = maxHP(this.stats.vigor);
        this.aether = maxAether(this.stats.warding);
        this.xp = 0;
        this.level = 1;
        this.gold = 0;
        this.equipment = { weapon: 'rusty_blade', armor: 'worn_leather', artifact: null };
        this.learnedSkills = new Set(['restore']);
        // Trained/usable skills (the Train panel's left column). Skills not in
        // this set are latent: learned but unavailable until trained at a
        // Magicsmith. Seeded with restore so a fresh game can still heal.
        this.activeSkills = new Set(['restore']);
        this.skills = ['restore', null, null, null, null];
        // Skill points: the room to keep skills active. The active-skill count can
        // never exceed sp, and sp itself is capped at maxSP. Gained from visiting
        // havens/huts and from skill gems.
        this.sp = 5;
        this.maxSP = 50;
        // Per-skill rank (1..SKILL_MAX_RANK) for tiered skills. Absent = rank 1.
        // Skill advancement (spending SP to raise ranks) is not wired yet, so this
        // stays empty for now and every tiered skill resolves at rank 1.
        this.skillRanks = {};
        this.inventory = ['stick_bow'];
        this.statPoints = 0;
        this.pendingSkillChoice = false;
        this.mp = PLAYER_MP;
        this.warpShieldTurns = 0;
        this.reflectTurns = 0;
        this.movedThisTurn = false;
        this.hexesMovedThisTurn = 0;
        this.phaseStepUsedThisTurn = false;
        this.sprintUsedThisTurn = false;
        this.seenDialogs = new Set();
    }

    weapon() {
        return ALL_EQUIPMENT[this.equipment[EQUIP_SLOT.WEAPON]];
    }

    armor() {
        return ALL_EQUIPMENT[this.equipment[EQUIP_SLOT.ARMOR]];
    }

    artifact() {
        const id = this.equipment[EQUIP_SLOT.ARTIFACT];
        if (!id) return null;
        return ALL_EQUIPMENT[id];
    }

    // Every non-empty equipment slot as a concrete list, so callers can filter,
    // find, and reduce over the player's gear functionally.
    equippedItems() {
        return ['weapon', 'armor', 'artifact'].map(slot => this[slot]()).filter(Boolean);
    }

    // First equipped item carrying `special`, or null. Use for on/off abilities
    // where a second copy adds nothing.
    equipped(special) {
        return this.equippedItems().find(item => item.special === special) || null;
    }

    // Sum a numeric field across every equipped item carrying `special`. Unlike
    // equipped(), which stops at the first match, this lets duplicate passives
    // (the same bonus on both armor and artifact) stack their magnitudes.
    sumEquipped(special, field) {
        return this.equippedItems()
            .filter(item => item.special === special)
            .reduce((total, item) => total + item[field], 0);
    }

    effectiveVigor() {
        return this.stats.vigor + this.sumEquipped('vigor_bonus', 'vigorBonus');
    }

    defense(terrainType) {
        const arm = this.armor();
        let def = arm ? arm.defense : 0;
        def += Math.floor(this.effectiveVigor() / 3);
        def += Math.floor(this.stats.might / 5);
        def += TERRAIN_DEFENSE_BONUS[terrainType] || 0;
        const lastStand = this.equipped('last_stand');
        if (lastStand && this.hp <= this.maxHP() / 2) def += lastStand.lastStandBonus;
        const momDef = this.equipped('momentum');
        if (momDef) def += this.hexesMovedThisTurn * momDef.momentumBonus;
        if (RANGER_TERRAIN.includes(terrainType)) def += this.sumEquipped('ranger_defense', 'rangerBonus');
        if (isChaosTerrain(terrainType)) {
            def += this.sumEquipped('chaos_defense', 'chaosDefenseBonus');
            def += this.sumEquipped('chaos_attune', 'chaosAttuneDef');
        }
        return def;
    }

    maxHP() {
        return maxHP(this.effectiveVigor()) + this.sumEquipped('hp_bonus', 'hpBonus');
    }

    maxAether() {
        return maxAether(this.stats.warding)
            + this.sumEquipped('aether_bonus', 'aetherBonus')
            + this.sumEquipped('armor_aether_bonus', 'aetherBonus');
    }

    vision() {
        return BASE_VISION + this.sumEquipped('vision_bonus', 'visionBonus');
    }

    maxMP() {
        let m = PLAYER_MP;
        const mpPen = this.equipped('mp_penalty');
        if (mpPen) m -= mpPen.mpPenalty;
        const highDef = this.equipped('high_def_mp_penalty');
        if (highDef) m -= highDef.mpPenalty;
        m += this.sumEquipped('mp_bonus', 'mpBonus');
        return Math.max(1, m);
    }

    _chaosBonus(wep, isChaosEnemy) {
        return (wep && wep.special === 'chaos_bonus' && isChaosEnemy) ? wep.chaosBonus : 0;
    }

    meleeDamage(isChaosEnemy) {
        const wep = this.weapon();
        const wepDmg = wep ? (weaponIsRanged(wep) ? Math.ceil(wep.damage / 4) : wep.damage) : 1;
        let dmg = wepDmg + this.stats.might + this._chaosBonus(wep, isChaosEnemy);
        if (wep && wep.special === 'charge' && this.movedThisTurn) {
            if (wep.chargeBonus) dmg += wep.chargeBonus;
            if (wep.chargeMultiplier) dmg *= wep.chargeMultiplier;
        }
        if (wep && wep.special === 'channel') dmg += wep.channelBonus;
        const wallItem = this.equipped('wall_of_steel') || this.equipped('wall_crown');
        if (wallItem && !this.movedThisTurn) dmg += (wallItem.wallBonus || wallItem.wallCrownBonus);
        return dmg;
    }

    rangedDamage(dist, isChaosEnemy) {
        const wep = this.weapon();
        let dmg = (wep ? wep.damage : 1) + this.stats.reflex + this._chaosBonus(wep, isChaosEnemy);
        if (wep && wep.special === 'sniper' && dist !== undefined && dist >= wep.range) {
            dmg += wep.sniperBonus;
        }
        if (wep && wep.special === 'channel') dmg += wep.channelBonus;
        return dmg;
    }

    dodge() {
        let d = 2 * this.stats.vigor;
        const dodgeItem = this.equipped('dodge_bonus');
        if (dodgeItem) d += dodgeItem.dodgeBonus;
        d = Math.min(d, MAX_DODGE);
        return d;
    }

    weaponRange(terrainType, poiType) {
        const wep = this.weapon();
        if (!weaponIsRanged(wep)) return 0;
        let range = wep.range;
        range += TERRAIN_RANGE_BONUS[terrainType] || 0;
        range += POI_RANGE_BONUS[poiType] || 0;
        return range;
    }

    isEngaged(enemies) {
        return enemies.some(e => hexDistance(this.q, this.r, e.q, e.r) === 1);
    }

    // Total SP an active skill at `rank` consumes. Each step costs one more than
    // the last (+1 to activate, then +2, +3, +4, +5), so rank R is the Rth
    // triangular number: 1, 3, 6, 10, 15.
    rankSPCost(rank) {
        return rank * (rank + 1) / 2;
    }

    // SP not yet committed — the room to train or level up another skill.
    freeSP() {
        let used = 0;
        for (const id of this.activeSkills) used += this.rankSPCost(this.rankOf(id));
        return this.sp - used;
    }

    // Current rank of a skill, the single source of truth for "what level is this
    // skill." Floors at 1: a skill with no stored rank is at its base tier.
    rankOf(skillId) {
        const rank = this.skillRanks[skillId];
        return rank === undefined ? 1 : rank;
    }

    // Add SP up to the maxSP ceiling; returns how much was actually gained.
    gainSP(amount) {
        const before = this.sp;
        this.sp = Math.min(this.maxSP, this.sp + amount);
        return this.sp - before;
    }

    toJSON() {
        return {
            q: this.q, r: this.r,
            stats: this.stats, hp: this.hp, aether: this.aether,
            xp: this.xp, level: this.level, gold: this.gold,
            equipment: this.equipment,
            learnedSkills: [...this.learnedSkills],
            activeSkills: [...this.activeSkills],
            skills: this.skills, sp: this.sp, maxSP: this.maxSP,
            skillRanks: this.skillRanks,
            inventory: this.inventory,
            statPoints: this.statPoints, pendingSkillChoice: this.pendingSkillChoice,
            mp: this.mp, warpShieldTurns: this.warpShieldTurns, reflectTurns: this.reflectTurns,
            seenDialogs: [...this.seenDialogs]
        };
    }

    static fromJSON(data) {
        const p = new Player(data.q, data.r);
        Object.assign(p, data);
        p.learnedSkills = new Set(data.learnedSkills);
        p.activeSkills = new Set(data.activeSkills);
        p.seenDialogs = new Set(data.seenDialogs);
        p.movedThisTurn = false;
        p.hexesMovedThisTurn = 0;
        p.phaseStepUsedThisTurn = false;
        p.sprintUsedThisTurn = false;
        return p;
    }
}
