import {
    STARTING_STATS, STAT_POINTS_PER_LEVEL, MAX_DODGE,
    maxHP, maxAether, PLAYER_MP, BASE_VISION,
    EQUIP_SLOT, ALL_EQUIPMENT,
    TERRAIN_DEFENSE_BONUS, TERRAIN_RANGE_BONUS,
    RANGER_TERRAIN, isChaosTerrain, POI_RANGE_BONUS
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
        this.skills = ['restore', null, null, null];
        this.inventory = ['stick_bow'];
        this.statPoints = 0;
        this.pendingSkillChoice = false;
        this.mp = PLAYER_MP;
        this.warpShieldTurns = 0;
        this.usedSkillsThisTurn = new Set();
        this.movedThisTurn = false;
        this.hexesMovedThisTurn = 0;
        this.hasGarrisonCharter = false;
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

    equipped(special) {
        for (const slot of ['weapon', 'armor', 'artifact']) {
            const item = this[slot]();
            if (item && item.special === special) return item;
        }
        return null;
    }

    defense(terrainType) {
        const arm = this.armor();
        let def = arm ? (arm.defense || 0) : 0;
        def += Math.floor(this.stats.vigor / 3);
        def += TERRAIN_DEFENSE_BONUS[terrainType] || 0;
        const lastStand = this.equipped('last_stand');
        if (lastStand && this.hp <= this.maxHP() / 2) def += lastStand.lastStandBonus;
        const momDef = this.equipped('momentum_defense');
        if (momDef) def += this.hexesMovedThisTurn * (momDef.momentumDefense || 1);
        const ranger = this.equipped('ranger_defense');
        if (ranger && RANGER_TERRAIN.includes(terrainType)) def += ranger.rangerBonus;
        const chaosDef = this.equipped('chaos_defense');
        if (chaosDef && isChaosTerrain(terrainType)) def += chaosDef.chaosDefenseBonus;
        const chaosAtt = this.equipped('chaos_attune');
        if (chaosAtt && isChaosTerrain(terrainType)) def += chaosAtt.chaosAttuneDef;
        return def;
    }

    maxHP() {
        let hp = maxHP(this.stats.vigor);
        const hpItem = this.equipped('hp_bonus');
        if (hpItem) hp += hpItem.hpBonus;
        return hp;
    }

    maxAether() {
        let ae = maxAether(this.stats.warding);
        const aeItem = this.equipped('aether_bonus');
        if (aeItem) ae += aeItem.aetherBonus;
        const aeArmor = this.equipped('armor_aether_bonus');
        if (aeArmor) ae += aeArmor.aetherBonus;
        return ae;
    }

    vision() {
        let v = BASE_VISION;
        const visItem = this.equipped('vision_bonus');
        if (visItem) v += visItem.visionBonus;
        return v;
    }

    maxMP() {
        let m = PLAYER_MP;
        const mpPen = this.equipped('mp_penalty');
        if (mpPen) m -= mpPen.mpPenalty;
        const highDef = this.equipped('high_def_mp_penalty');
        if (highDef) m -= highDef.mpPenalty;
        const mpItem = this.equipped('mp_bonus');
        if (mpItem) m += mpItem.mpBonus;
        return Math.max(1, m);
    }

    _chaosBonus(wep, isChaosEnemy) {
        return (wep && wep.special === 'chaos_bonus' && isChaosEnemy) ? (wep.chaosBonus || 2) : 0;
    }

    meleeDamage(isChaosEnemy) {
        const wep = this.weapon();
        const wepDmg = wep ? (wep.type === 'ranged' ? Math.ceil(wep.damage / 4) : wep.damage) : 1;
        let dmg = wepDmg + this.stats.might + this._chaosBonus(wep, isChaosEnemy);
        if (wep && wep.special === 'momentum' && this.movedThisTurn) dmg += wep.momentumBonus;
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
        return dmg;
    }

    dodge() {
        let d = Math.min(this.stats.reflex, MAX_DODGE);
        const dodgeItem = this.equipped('dodge_bonus');
        if (dodgeItem) d += dodgeItem.dodgeBonus;
        return d;
    }

    weaponRange(terrainType, poiType) {
        const wep = this.weapon();
        if (!wep || wep.type !== 'ranged') return 0;
        let range = wep.range;
        range += TERRAIN_RANGE_BONUS[terrainType] || 0;
        range += POI_RANGE_BONUS[poiType] || 0;
        return range;
    }

    isEngaged(enemies) {
        return enemies.some(e => hexDistance(this.q, this.r, e.q, e.r) === 1);
    }

    toJSON() {
        return {
            q: this.q, r: this.r,
            stats: this.stats, hp: this.hp, aether: this.aether,
            xp: this.xp, level: this.level, gold: this.gold,
            equipment: this.equipment,
            learnedSkills: [...this.learnedSkills],
            skills: this.skills, inventory: this.inventory,
            statPoints: this.statPoints, pendingSkillChoice: this.pendingSkillChoice,
            mp: this.mp, warpShieldTurns: this.warpShieldTurns,
            hasGarrisonCharter: this.hasGarrisonCharter
        };
    }

    static fromJSON(data) {
        const p = new Player(data.q, data.r);
        Object.assign(p, data);
        p.learnedSkills = new Set(data.learnedSkills);
        p.usedSkillsThisTurn = new Set();
        p.movedThisTurn = false;
        p.hexesMovedThisTurn = 0;
        if (p.hp == null) p.hp = p.maxHP();
        if (p.aether == null) p.aether = p.maxAether();
        return p;
    }
}
