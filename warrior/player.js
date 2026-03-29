import {
    STARTING_STATS, STAT_POINTS_PER_LEVEL, MAX_DODGE,
    maxHP, maxAether, PLAYER_MP, BASE_VISION,
    EQUIP_SLOT, ALL_EQUIPMENT,
    TERRAIN_DEFENSE_BONUS, TERRAIN_RANGE_BONUS,
    TERRAIN
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

    defense(terrainType) {
        const arm = this.armor();
        let def = arm ? arm.defense : 0;
        def += TERRAIN_DEFENSE_BONUS[terrainType] || 0;
        if (arm && arm.special === 'last_stand' && this.hp <= this.maxHP() / 2) {
            def += arm.lastStandBonus;
        }
        const art = this.artifact();
        if (art && art.special === 'momentum_defense') {
            def += this.hexesMovedThisTurn;
        }
        if (art && art.special === 'ranger_defense') {
            if ([TERRAIN.FOREST, TERRAIN.MOUNTAIN, TERRAIN.SHATTERED_FOREST, TERRAIN.DISTRESSED_FOREST].includes(terrainType)) {
                def += art.rangerBonus;
            }
        }
        if (art && art.special === 'chaos_defense') {
            if (terrainType >= 7 && terrainType <= 16) {
                def += art.chaosDefenseBonus;
            }
        }
        return def;
    }

    maxHP() {
        let hp = maxHP(this.stats.vigor);
        const arm = this.armor();
        if (arm && arm.special === 'hp_bonus') hp += arm.hpBonus;
        return hp;
    }

    maxAether() {
        let ae = maxAether(this.stats.warding);
        const art = this.artifact();
        if (art && art.special === 'aether_bonus') ae += art.aetherBonus;
        return ae;
    }

    vision() {
        let v = BASE_VISION;
        const arm = this.armor();
        if (arm && arm.special === 'vision_bonus') v += arm.visionBonus;
        const art = this.artifact();
        if (art && art.special === 'vision_bonus') v += art.visionBonus;
        return v;
    }

    maxMP() {
        let m = PLAYER_MP;
        const arm = this.armor();
        if (arm && arm.special === 'mp_penalty') m -= arm.mpPenalty;
        return Math.max(1, m);
    }

    meleeDamage(enemyDef) {
        const wep = this.weapon();
        let dmg = (wep ? wep.damage : 1) + this.stats.might;
        if (wep && wep.special === 'chaos_bonus' && enemyDef.chaosSpawned) dmg += 2;
        if (wep && wep.special === 'momentum' && this.movedThisTurn) dmg += wep.momentumBonus;
        const art = this.artifact();
        if (art && art.special === 'wall_crown' && !this.movedThisTurn) dmg += art.wallCrownBonus;
        return dmg;
    }

    rangedDamage(dist) {
        const wep = this.weapon();
        let dmg = (wep ? wep.damage : 1) + this.stats.reflex;
        if (wep && wep.special === 'sniper' && dist !== undefined && dist >= wep.range) {
            dmg += wep.sniperBonus;
        }
        return dmg;
    }

    dodge() {
        let d = Math.min(this.stats.reflex, MAX_DODGE);
        const arm = this.armor();
        if (arm && arm.special === 'dodge_bonus') d += arm.dodgeBonus;
        return d;
    }

    weaponRange(terrainType) {
        const wep = this.weapon();
        if (!wep || wep.type !== 'ranged') return 0;
        let range = wep.range;
        range += TERRAIN_RANGE_BONUS[terrainType] || 0;
        return range;
    }

    isEngaged(enemies) {
        return enemies.some(e => hexDistance(this.q, this.r, e.q, e.r) === 1);
    }
}
