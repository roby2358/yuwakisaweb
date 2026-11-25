// worldgen.js — WorldGen
//
// Map and site generation for Power Quest (ONTOLOGY.md §4 "Generate the world"). DOM-free; every
// random draw routes through the seeded Rando so a seed reproduces the world (INV-1). Operates
// on a GameEngine (its state, board and creature factory).
const WorldGen = (function () {
    const A = GameArtifacts;
    const { TERRAIN } = A;

    // Diamond-square heightmap over a (size x size) grid, normalized to [0, 100].
    function diamondSquare(size, roughness) {
        const grid = new Float64Array(size * size);
        const get = (x, y) => grid[y * size + x];
        const set = (x, y, v) => { grid[y * size + x] = v; };
        set(0, 0, Rando.random());
        set(size - 1, 0, Rando.random());
        set(0, size - 1, Rando.random());
        set(size - 1, size - 1, Rando.random());
        let step = size - 1;
        let scale = roughness;
        while (step > 1) {
            const half = step / 2;
            for (let y = half; y < size - 1; y += step)
                for (let x = half; x < size - 1; x += step)
                    set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                        get(x - half, y + half) + get(x + half, y + half)) / 4 +
                        (Rando.random() - 0.5) * scale);
            for (let y = 0; y < size; y += half)
                for (let x = (y + half) % step; x < size; x += step) {
                    let sum = 0, cnt = 0;
                    if (x >= half) { sum += get(x - half, y); cnt++; }
                    if (x + half < size) { sum += get(x + half, y); cnt++; }
                    if (y >= half) { sum += get(x, y - half); cnt++; }
                    if (y + half < size) { sum += get(x, y + half); cnt++; }
                    set(x, y, sum / cnt + (Rando.random() - 0.5) * scale);
                }
            step = half;
            scale *= roughness;
        }
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
        for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
        return grid;
    }

    // Rectangle of MAP_COLS x MAP_ROWS axial hexes with per-row q offset; elevation and moisture sampled.
    function generateGrid() {
        const { MAP_COLS, MAP_ROWS, HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS } = A;
        const hexes = new Map();
        const elev = diamondSquare(HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS);
        const wet = diamondSquare(HEIGHTMAP_SIZE, HEIGHTMAP_ROUGHNESS);
        const last = HEIGHTMAP_SIZE - 1;
        for (let row = 0; row < MAP_ROWS; row++) {
            const qOffset = -Math.floor(row / 2);
            for (let col = 0; col < MAP_COLS; col++) {
                const q = col + qOffset, r = row;
                const gi = Math.round(row / (MAP_ROWS - 1) * last) * HEIGHTMAP_SIZE + Math.round(col / (MAP_COLS - 1) * last);
                const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
                hexes.set(Hex.key(q, r), { q, r, col, row, elevation: elev[gi], moisture: wet[gi], isEdge, terrain: null });
            }
        }
        return hexes;
    }

    // Water below WATER_PCT and on the edge ring, mesa at/above MESA_PCT, plains between, and the
    // wettest JUNGLE_FRAC of plains become jungle.
    function assignTerrain(hexes) {
        const inner = [];
        for (const [, hex] of hexes) {
            if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
            inner.push(hex);
        }
        inner.sort((a, b) => a.elevation - b.elevation);
        const n = inner.length;
        for (let i = 0; i < n; i++) {
            const pct = i / n;
            inner[i].terrain = pct < A.WATER_PCT ? TERRAIN.WATER : pct >= A.MESA_PCT ? TERRAIN.MESA : TERRAIN.PLAINS;
        }
        const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS).sort((a, b) => b.moisture - a.moisture);
        const jungle = Math.round(plains.length * A.JUNGLE_FRAC);
        for (let i = 0; i < jungle; i++) plains[i].terrain = TERRAIN.JUNGLE;
    }

    // The largest connected passable component of inner hexes, as an array of hexes.
    function largestLand(board) {
        const seen = new Set();
        let best = [];
        for (const [key, hex] of board.hexes) {
            if (seen.has(key) || hex.isEdge || !board.isPassable(hex)) continue;
            const comp = [];
            const stack = [hex];
            seen.add(key);
            while (stack.length) {
                const h = stack.pop();
                comp.push(h);
                for (const nb of board.neighbors(h.q, h.r)) {
                    const nk = Hex.key(nb.q, nb.r);
                    if (seen.has(nk) || nb.isEdge || !board.isPassable(nb)) continue;
                    seen.add(nk);
                    stack.push(nb);
                }
            }
            if (comp.length > best.length) best = comp;
        }
        return best;
    }

    // Build up to `attempts` worlds from the current Rando stream; stop at the first that passes.
    function build(engine, attempts) {
        const s = engine.state;
        const inner = (A.MAP_COLS - 2) * (A.MAP_ROWS - 2);
        for (let i = 0; i < attempts; i++) {
            s.hexes = generateGrid();
            assignTerrain(s.hexes);
            engine.adoptBoard();
            const land = largestLand(engine.board);
            if (land.length < A.MIN_LAND_FRAC * inner) continue;
            if (populate(engine, land)) return true;
        }
        return false;
    }

    function nearest(list, p) {
        let best = null, bd = Infinity;
        for (const v of list) { const dd = hexDist(v, p); if (dd < bd) { bd = dd; best = v; } }
        return best;
    }

    // Place villages, ruins, lairs, the hero, guardians and roamers. False if the land can't fit them.
    function populate(engine, land) {
        const s = engine.state;
        s.villages = []; s.ruins = []; s.lairs = []; s.enemies = []; s.nemeses = [];
        s.explored = {}; s.nextId = 1; s.log = []; s.perkOffers = [];
        s.stats = { kills: 0, shutdowns: 0, founded: 0, crafted: 0, deposited: 0 };
        const pool = Rando.shuffle(land.slice());
        const sites = [];
        const clear = h => sites.every(p => hexDist(p, h) >= A.SITE_MIN_DIST);
        const pick = (pred, weightFn) => {
            const cand = pool.filter(h => clear(h) && pred(h));
            if (cand.length === 0) return null;
            return weightFn ? Rando.weighted(cand.map(h => ({ item: h, weight: weightFn(h) }))) : cand[0];
        };

        // Villages: plains, spread out.
        for (let i = 0; i < A.VILLAGE_COUNT; i++) {
            const h = pick(h => h.terrain === TERRAIN.PLAINS && s.villages.every(v => hexDist(v, h) >= A.VILLAGE_MIN_DIST));
            if (!h) break;
            const v = new Village(h.q, h.r, s.nextId++, engine.makeName());
            v.trust = A.START_TRUST;
            v.hp = engine.villageHpMax(v);
            s.villages.push(v);
            sites.push(v);
        }
        if (s.villages.length < 3) return false;
        const home = Rando.choice(s.villages);
        home.home = true; home.trust = A.HOME_TRUST; home.discovered = true;

        // Ruins: one near home with a tier-1 blueprint, the rest anywhere (jungle and mesa favored).
        const [d0, d1] = A.START_RUIN_DIST;
        const startSpot = pick(h => { const dd = hexDist(home, h); return dd >= d0 && dd <= d1; });
        const bp1 = Rando.choice(Object.keys(A.MODULES).filter(id => A.MODULES[id].tier === 1 && id !== A.STARTER_MODULE));
        if (startSpot) {
            const ru = new Ruin(startSpot.q, startSpot.r, s.nextId++, bp1);
            s.ruins.push(ru); sites.push(ru);
        }
        for (let i = s.ruins.length; i < A.RUIN_COUNT; i++) {
            const h = pick(() => true, h => h.terrain === TERRAIN.PLAINS ? 1 : 2);
            if (!h) break;
            const cap = engine.siteTier(h);
            const mods = Object.keys(A.MODULES).filter(id => id !== A.STARTER_MODULE && A.MODULES[id].tier <= cap);
            const bp = Rando.weighted(mods.map(id => ({ item: id, weight: A.MODULES[id].tier === cap ? 1 : 0.5 })));
            const ru = new Ruin(h.q, h.r, s.nextId++, bp);
            s.ruins.push(ru); sites.push(ru);
        }

        // Lairs: away from home and from every village; each gets a guardian.
        const lairSpots = (kind) => pick(h => hexDist(home, h) >= A.HOME_SAFE_DIST && s.villages.every(v => hexDist(v, h) >= A.LAIR_VILLAGE_MIN));
        for (const [kind, count] of [['camp', A.CAMP_COUNT], ['den', A.DEN_COUNT]]) {
            for (let i = 0; i < count; i++) {
                const h = lairSpots(kind);
                if (!h) break;
                const lair = new Lair(h.q, h.r, s.nextId++, kind, engine.siteTier(h));
                s.lairs.push(lair); sites.push(lair);
                const group = kind === 'camp' ? 'raider' : Rando.choice(['beast', 'relic']);
                const gk = engine.kindAtTier(group, Math.min(A.MAX_ENEMY_TIER, lair.tier + 1));
                const g = engine.makeCreature(gk, lair.q, lair.r, { home: lair.id, guardian: true });
                s.enemies.push(g);
            }
        }

        // Hero on home with the starter module.
        const hero = new Hero(home.q, home.r);
        hero.sockets = [A.STARTER_MODULE, null];
        hero.blueprints = [A.STARTER_MODULE];
        s.hero = hero;
        const st = engine.heroStats();
        hero.hp = st.hpMax;
        hero.charge = st.chargeMax;

        // Roamers: beasts and relic monsters across the land, none near home.
        const taken = new Set(s.enemies.map(e => e.key()));
        for (let i = 0; i < A.ROAMER_COUNT; i++) {
            const h = pool.find(h => !taken.has(Hex.key(h.q, h.r)) && clear(h) && hexDist(home, h) >= 6);
            if (!h) break;
            const kind = engine.pickKind(['beast', 'relic'], engine.siteTier(h));
            const c = engine.makeCreature(kind, h.q, h.r, {});
            s.enemies.push(c);
            taken.add(c.key());
            pool.splice(pool.indexOf(h), 1);
        }
        engine.reveal(true);
        return true;
    }

    return { build, diamondSquare, generateGrid, assignTerrain, largestLand, nearest };
})();
