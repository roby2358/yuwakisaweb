'use strict';

function wildlifeBehaviorFor(attack) {
    if (attack >= 30) return 'ruins-guardian';
    if (attack >= 20) return 'monster';
    return 'wildlife';
}

const NUM_CREATURE_TIERS = 12;

const CREATURE_NAME_PREFIXES = [
    'Ash','Vel','Dra','Gor','Mur','Thr','Zan','Kri','Vor','Eld',
    'Grim','Sar','Fen','Bal','Rix','Nar','Osi','Bry','Cal','Dul'
];
const CREATURE_NAME_SUFFIXES = [
    'ax','or','ith','old','un','ek','ang','us','ar','on',
    'ine','oth','usk','el','arn','ox'
];
const CREATURE_NAME_PREDATORS = [
    'tiger','lion','cheetah','wolf','bear','hawk',
    'shark','viper','panther','cobra','eagle','falcon'
];

// Each tier has a melee creature and a rarer ranged one. The ranged weight
// keeps them near a quarter of wildlife on the map (their packs run a bit
// larger, since pack size divides by attack) — enough to shape an approach,
// not so many that clusters of shooters pin the player down.
const RANGED_CREATURE_SPAWN_WEIGHT = 0.25;

// Ranged tier bands (early / mid / late): each band's reach, and the role words
// appended to the creature's procedural name so the role reads in the log too.
const RANGED_CREATURE_BANDS = [
    { range: 2, roles: ['Slinger', 'Skirmisher', 'Spitter', 'Archer'] },
    { range: 3, roles: ['Hexer', 'Hurler', 'Spellslinger', 'Caster'] },
    { range: 4, roles: ['Warden', 'Sentinel', 'Stormcaller', 'Magus'] }
];

// Draws names from makeName until one is unused, and claims it.
function uniqueCreatureName(usedNames, makeName) {
    let name;
    do { name = makeName(); } while (usedNames.has(name));
    usedNames.add(name);
    return name;
}

// The palette color with saturation shifted by satShift and lightness
// jittered ±0.15 (held to 0.3-0.7), as a hex string.
function variedCreatureColor(baseColor, satShift) {
    const [h, s, l] = ColorTheory.rgbToHsl(baseColor[0], baseColor[1], baseColor[2]);
    const sat = Math.max(0, Math.min(1, s + satShift));
    const [r, g, b] = ColorTheory.hslToRgb(h, sat, Math.max(0.3, Math.min(0.7, l + Rando.float(-0.15, 0.15))));
    return ColorTheory.rgbToHex(r, g, b);
}

// Gaussian weight over tiers, peaked at `peakTier`. Sigma = 2 so ±2 tiers common, ±4 rare.
// Scaled by each def's spawnWeight.
function spawnTierWeights(creatureDefs, peakTier) {
    const sigma = 2;
    return Object.keys(creatureDefs).map(type => {
        const def = creatureDefs[type];
        const d = (def.tier - peakTier) / sigma;
        return { item: type, weight: Math.exp(-d * d) * def.spawnWeight };
    });
}

class EnemyManager {
    constructor() {
        this.enemies = [];
        this.creatureDefs = {};
        this.nextId = 0;
    }

    getDef(type) {
        return ENEMY_DEFS[type] || this.creatureDefs[type];
    }

    spawn(type, q, r, homeQ, homeR) {
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
        const usedNames = new Set();
        const palette = ColorTheory.randomScheme(() => Math.random());

        for (let i = 0; i < NUM_CREATURE_TIERS; i++) {
            const attack = Math.round(3 * Math.pow(10, i / 11));
            const detectRange = Math.min(7, 4 + Math.floor(attack / 4));
            const baseColor = palette[i % palette.length];

            // Fields the tier's melee and ranged creatures share.
            const tierFields = {
                speed: 1,
                detectRange,
                aggroRange: Rando.int(3, detectRange),
                xp: attack * 2,
                gold: Math.max(1, Math.floor(attack / 3)),
                tier: i,
                behavior: wildlifeBehaviorFor(attack),
                chaosSpawned: false
            };

            const name = uniqueCreatureName(usedNames, () =>
                Rando.choice(CREATURE_NAME_PREFIXES) + Rando.choice(CREATURE_NAME_PREDATORS) + Rando.choice(CREATURE_NAME_SUFFIXES));
            this.creatureDefs['creature_' + i] = {
                ...tierFields,
                name,
                label: name[0],
                hp: attack * 4 + Rando.int(-3, 3),
                attack,
                defense: Math.floor(attack / 4),
                spawnWeight: 1,
                color: variedCreatureColor(baseColor, 0.1)
            };

            this.creatureDefs['ranged_creature_' + i] =
                this.rangedCreatureDef(tierFields, attack, baseColor, usedNames);
        }
    }

    // The ranged counterpart of a tier: frailer than its melee kin, shoots
    // and strikes at three-quarters of the tier's attack (rangedAttack equals
    // attack). Behavior keys off the tier's attack, so the top
    // tier is a ranged ruins-guardian.
    rangedCreatureDef(tierFields, tierAttack, baseColor, usedNames) {
        const band = RANGED_CREATURE_BANDS[Math.min(RANGED_CREATURE_BANDS.length - 1, Math.floor(tierFields.tier / 4))];
        const name = uniqueCreatureName(usedNames, () =>
            Rando.choice(CREATURE_NAME_PREFIXES) + Rando.choice(CREATURE_NAME_SUFFIXES) + ' ' + Rando.choice(band.roles));
        const attack = Math.max(1, Math.round(tierAttack * 0.75));
        return {
            ...tierFields,
            name,
            label: name[0],
            hp: Math.max(4, Math.round(tierAttack * 2.5) + Rando.int(-2, 2)),
            attack,
            rangedAttack: attack,
            range: band.range,
            defense: Math.floor(tierAttack / 6),
            spawnWeight: RANGED_CREATURE_SPAWN_WEIGHT,
            color: variedCreatureColor(baseColor, -0.15)
        };
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

    wildlifeMight() {
        let total = 0;
        for (const e of this.enemies) {
            const def = this.getDef(e.type);
            if (def && !def.chaosSpawned) total += def.attack;
        }
        return total;
    }

    chaosMight() {
        let total = 0;
        for (const e of this.enemies) {
            const def = this.getDef(e.type);
            if (def && def.chaosSpawned) total += def.attack;
        }
        return total;
    }

    spawnInitialCreatures(world, playerQ, playerR, pickPack, visibleSet) {
        if (Object.keys(this.creatureDefs).length === 0) return;

        const candidates = world.passableHexes().filter(h => {
            const key = hexKey(h.q, h.r);
            if (visibleSet.has(key)) return false;
            if (this.enemyAt(h.q, h.r)) return false;
            if (world.poiAt(h.q, h.r)) return false;
            const hex = world.getHex(h.q, h.r);
            if (hex && UNSHATTERED_VERSION[hex.terrain] !== undefined) return false;
            return hexDistance(h.q, h.r, playerQ, playerR) > 6;
        });

        while (this.wildlifeMight() < 1000 && candidates.length > 0) {
            const idx = Rando.int(0, candidates.length - 1);
            const hex = candidates[idx];
            candidates.splice(idx, 1);
            if (this.enemyAt(hex.q, hex.r)) continue;
            const { type, packSize } = pickPack(hex.q, hex.r);
            this.spawnPack(world, hex.q, hex.r, type, packSize, playerQ, playerR);
        }
    }

    spawnWildlife(world, playerQ, playerR, pickPack) {
        if (this.wildlifeMight() >= 1000) return;
        if (!Rando.bool(0.20)) return;
        if (Object.keys(this.creatureDefs).length === 0) return;
        const pool = world.passableHexes().filter(h => {
            if (this.enemyAt(h.q, h.r)) return false;
            if (world.poiAt(h.q, h.r)) return false;
            if (hexDistance(h.q, h.r, playerQ, playerR) <= 6) return false;
            const hex = world.getHex(h.q, h.r);
            if (hex && UNSHATTERED_VERSION[hex.terrain] !== undefined) return false;
            return true;
        });
        if (pool.length === 0) return;
        const spot = Rando.choice(pool);
        const { type, packSize } = pickPack(spot.q, spot.r);
        this.spawnPack(world, spot.q, spot.r, type, packSize, playerQ, playerR);
    }

    // Place a pack of `packSize` enemies of `type`: first at (q,r), the rest on
    // eligible hexes within 2 of the origin, preferring adjacent. Pack members
    // honor the same player-safety buffer as the origin.
    spawnPack(world, q, r, type, packSize, playerQ, playerR) {
        this.spawn(type, q, r);
        if (packSize <= 1) return;
        const slots = hexesInRange(q, r, 2).filter(n => {
            if (n.q === q && n.r === r) return false;
            if (this.enemyAt(n.q, n.r)) return false;
            if (world.poiAt(n.q, n.r)) return false;
            const hex = world.getHex(n.q, n.r);
            if (!hex || !world.isPassable(hex)) return false;
            if (UNSHATTERED_VERSION[hex.terrain] !== undefined) return false;
            return hexDistance(n.q, n.r, playerQ, playerR) > 6;
        });
        Rando.shuffle(slots);
        // Stable sort by ring distance: adjacent (dist 1) before dist 2.
        slots.sort((a, b) => hexDistance(a.q, a.r, q, r) - hexDistance(b.q, b.r, q, r));
        const fill = Math.min(packSize - 1, slots.length);
        for (let i = 0; i < fill; i++) {
            this.spawn(type, slots[i].q, slots[i].r);
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
            if (poi && (poi.type === POI.HAVEN || poi.type === POI.VILLAGE || poi.type === POI.GARRISON || poi.type === POI.GARRISON_BUILD)) return false;
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

    toJSON() {
        return {
            enemies: this.enemies,
            creatureDefs: this.creatureDefs,
            nextId: this.nextId
        };
    }

    static fromJSON(data) {
        const em = new EnemyManager();
        em.enemies = data.enemies;
        em.creatureDefs = data.creatureDefs;
        em.nextId = data.nextId;
        return em;
    }

    getNextStepToward(enemy, tq, tr, occupied, world) {
        const isPassable = (q, r) => {
            if (!world.isPassable(world.getHex(q, r))) return false;
            // The explicit goal is always reachable as a destination — a swarm marching
            // on a settlement must be able to path to it even though settlement hexes are
            // otherwise impassable. Intermediate settlements still block, so units never
            // route through a sanctuary.
            if (q === tq && r === tr) return true;
            const poi = world.poiAt(q, r);
            if (poi && (poi.type === POI.HAVEN || poi.type === POI.VILLAGE || poi.type === POI.GARRISON || poi.type === POI.GARRISON_BUILD)) return false;
            return !occupied.has(hexKey(q, r));
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
