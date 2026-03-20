import { ENEMY_TYPE, ENEMY_DEFS, MAX_ENEMIES, MOVEMENT_COST, UNSHATTERED_VERSION, POI } from './config.js';
import { hexKey, hexNeighbors, hexDistance, hexesInRange, findPath } from './hex.js';
import { Rando } from './rando.js';
import { ColorTheory } from './colortheory.js';

export class EnemyManager {
    constructor() {
        this.enemies = [];
        this.creatureDefs = {};
        this.nextId = 0;
    }

    getDef(type) {
        return ENEMY_DEFS[type] || this.creatureDefs[type];
    }

    spawn(type, q, r, homeQ, homeR) {
        if (this.enemies.length >= MAX_ENEMIES) return null;
        const def = this.getDef(type);
        if (!def) return null;
        const enemy = {
            id: this.nextId++,
            type,
            q, r,
            hp: def.hp,
            maxHp: def.hp,
            homeQ: homeQ !== undefined ? homeQ : q,
            homeR: homeR !== undefined ? homeR : r,
            turnsSinceSpawn: 0
        };
        this.enemies.push(enemy);
        return enemy;
    }

    remove(enemy) {
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);
    }

    enemyAt(q, r) {
        return this.enemies.find(e => e.q === q && e.r === r);
    }

    generateCreatureTypes() {
        const prefixes = [
            'Ash','Vel','Dra','Gor','Mur','Thr','Zan','Kri','Vor','Eld',
            'Grim','Sar','Fen','Bal','Rix','Nar','Osi','Bry','Cal','Dul'
        ];
        const predators = [
            'tiger','lion','cheetah','wolf','bear','hawk',
            'shark','viper','panther','cobra','eagle','falcon'
        ];
        const suffixes = [
            'ax','or','ith','old','un','ek','ang','us','ar','on',
            'ine','oth','usk','el','arn','ox'
        ];

        const usedNames = new Set();
        const palette = ColorTheory.randomScheme(() => Math.random());

        for (let i = 0; i < 12; i++) {
            let name;
            do {
                const prefix = Rando.choice(prefixes);
                const predator = Rando.choice(predators);
                const suffix = Rando.choice(suffixes);
                name = prefix + predator + suffix;
            } while (usedNames.has(name));
            usedNames.add(name);

            const attack = 3 + Math.floor(i * 9 / 11);
            const hp = attack * 4 + Rando.int(-3, 3);
            const defense = Math.floor(attack / 4);
            const xp = attack * 2;
            const gold = Math.max(1, Math.floor(attack / 3));
            const detectRange = Math.min(7, 4 + Math.floor(attack / 4));
            const aggroRange = Rando.int(3, detectRange);

            const baseColor = palette[i % palette.length];
            const [bh, bs, bl] = ColorTheory.rgbToHsl(baseColor[0], baseColor[1], baseColor[2]);
            const varied = ColorTheory.hslToRgb(bh, Math.min(1, bs + 0.1), Math.max(0.3, Math.min(0.7, bl + Rando.float(-0.15, 0.15))));
            const color = ColorTheory.rgbToHex(varied[0], varied[1], varied[2]);

            const typeKey = 'creature_' + i;
            this.creatureDefs[typeKey] = {
                name,
                label: name[0],
                hp,
                attack,
                defense,
                speed: 1,
                detectRange,
                aggroRange,
                xp,
                gold,
                behavior: 'wildlife',
                chaosSpawned: false,
                color
            };
        }
    }

    spawnInitial(world, playerQ, playerR) {
        const passable = world.passableHexes();
        const farEnough = (q, r) => hexDistance(q, r, playerQ, playerR) > 5;

        // 2d4 Void Stalkers
        const numStalkers = Rando.int(1, 4) + Rando.int(1, 4);
        for (let i = 0; i < numStalkers; i++) {
            const hex = Rando.choice(passable.filter(h => farEnough(h.q, h.r) && !this.enemyAt(h.q, h.r)));
            if (hex) this.spawn(ENEMY_TYPE.VOID_STALKER, hex.q, hex.r);
        }

        // 1d3 Flux Archers
        const numArchers = Rando.int(1, 3);
        for (let i = 0; i < numArchers; i++) {
            const hex = Rando.choice(passable.filter(h => farEnough(h.q, h.r) && !this.enemyAt(h.q, h.r)));
            if (hex) this.spawn(ENEMY_TYPE.FLUX_ARCHER, hex.q, hex.r);
        }

        // Spawn guardians and crawlers at breach/maw POIs
        for (const poi of world.pois) {
            if (poi.type === POI.MAW) {
                const g = this.spawn(ENEMY_TYPE.UNRAVELER, poi.q, poi.r, poi.q, poi.r);
                if (g) poi.guardianId = g.id;
            } else if (poi.type === POI.BREACH) {
                const g = this.spawn(ENEMY_TYPE.BREACH_GUARDIAN, poi.q, poi.r, poi.q, poi.r);
                if (g) poi.guardianId = g.id;
                // 1-2 crawlers near each breach
                const nearby = hexesInRange(poi.q, poi.r, 2)
                    .filter(h => world.isPassable(world.getHex(h.q, h.r)) && !this.enemyAt(h.q, h.r)
                        && !(h.q === poi.q && h.r === poi.r));
                const numCrawlers = Rando.int(1, 2);
                for (let i = 0; i < numCrawlers; i++) {
                    const hex = Rando.choice(nearby.filter(h => !this.enemyAt(h.q, h.r)));
                    if (hex) this.spawn(ENEMY_TYPE.BREACH_CRAWLER, hex.q, hex.r, poi.q, poi.r);
                }
            }
        }
    }

    spawnInitialCreatures(world, playerQ, playerR, visibleSet) {
        const creatureTypes = Object.keys(this.creatureDefs);
        if (creatureTypes.length === 0) return;

        const candidates = world.passableHexes().filter(h => {
            const key = hexKey(h.q, h.r);
            if (visibleSet.has(key)) return false;
            if (this.enemyAt(h.q, h.r)) return false;
            const hex = world.getHex(h.q, h.r);
            if (hex && UNSHATTERED_VERSION[hex.terrain] !== undefined) return false;
            return true;
        });

        for (let i = 0; i < 20 && candidates.length > 0; i++) {
            const idx = Rando.int(0, candidates.length - 1);
            const hex = candidates[idx];
            candidates.splice(idx, 1);
            const type = Rando.choice(creatureTypes);
            this.spawn(type, hex.q, hex.r);
        }
    }

    // --- Movement methods ---

    validAdjacentMoves(enemy, occupied, avoidShattered, playerQ, playerR, world) {
        return hexNeighbors(enemy.q, enemy.r).filter(n => {
            const key = hexKey(n.q, n.r);
            if (!world.isPassable(world.getHex(n.q, n.r))) return false;
            if (occupied.has(key)) return false;
            if (n.q === playerQ && n.r === playerR) return false;
            const poi = world.poiAt(n.q, n.r);
            if (poi && poi.type === POI.HAVEN) return false;
            if (avoidShattered) {
                const hex = world.getHex(n.q, n.r);
                if (hex && UNSHATTERED_VERSION[hex.terrain] !== undefined) return false;
            }
            return true;
        });
    }

    moveEnemyToNearest(enemy, valid, occupied) {
        if (!valid || valid.length === 0) return;
        const oldKey = hexKey(enemy.q, enemy.r);
        occupied.delete(oldKey);
        enemy.q = valid[0].q;
        enemy.r = valid[0].r;
        occupied.add(hexKey(enemy.q, enemy.r));
    }

    moveEnemyToward(enemy, tq, tr, occupied, world) {
        const next = this.getNextStepToward(enemy, tq, tr, occupied, world);
        if (next) {
            const oldKey = hexKey(enemy.q, enemy.r);
            occupied.delete(oldKey);
            enemy.q = next.q;
            enemy.r = next.r;
            occupied.add(hexKey(enemy.q, enemy.r));
        }
    }

    moveEnemyAway(enemy, fromQ, fromR, occupied, playerQ, playerR, world) {
        const valid = this.validAdjacentMoves(enemy, occupied, false, playerQ, playerR, world);
        valid.sort((a, b) => hexDistance(b.q, b.r, fromQ, fromR) - hexDistance(a.q, a.r, fromQ, fromR));
        this.moveEnemyToNearest(enemy, valid, occupied);
    }

    wanderEnemy(enemy, occupied, playerQ, playerR, world) {
        const valid = this.validAdjacentMoves(enemy, occupied, false, playerQ, playerR, world);
        if (valid.length > 0) {
            this.moveEnemyToNearest(enemy, [Rando.choice(valid)], occupied);
        }
    }

    wanderWildlife(enemy, occupied, playerQ, playerR, world) {
        const valid = this.validAdjacentMoves(enemy, occupied, true, playerQ, playerR, world);
        if (valid.length > 0) {
            this.moveEnemyToNearest(enemy, [Rando.choice(valid)], occupied);
        }
    }

    moveWildlifeToward(enemy, tq, tr, occupied, playerQ, playerR, world) {
        const valid = this.validAdjacentMoves(enemy, occupied, true, playerQ, playerR, world);
        valid.sort((a, b) => hexDistance(a.q, a.r, tq, tr) - hexDistance(b.q, b.r, tq, tr));
        this.moveEnemyToNearest(enemy, valid, occupied);
    }

    getNextStepToward(enemy, tq, tr, occupied, world) {
        const isPassable = (q, r) => {
            if (!world.isPassable(world.getHex(q, r))) return false;
            const poi = world.poiAt(q, r);
            if (poi && poi.type === POI.HAVEN) return false;
            const key = hexKey(q, r);
            if (q === tq && r === tr) return true;
            return !occupied.has(key);
        };
        const movementCost = (q, r) => {
            const hex = world.getHex(q, r);
            if (!hex) return 1;
            return MOVEMENT_COST[hex.terrain] || 1;
        };
        const path = findPath({ q: enemy.q, r: enemy.r }, { q: tq, r: tr }, isPassable, movementCost);
        if (!path || path.length < 2) return null;
        const next = path[1];
        const nextKey = hexKey(next.q, next.r);
        if (occupied.has(nextKey)) return null;
        return next;
    }
}
