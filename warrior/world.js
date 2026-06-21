// world.js — GameWorld: hex grid, POIs, fog of war

import { TERRAIN, MAP_COLS, MAP_ROWS, MOVEMENT_COST, POI, WEAPONS, ARMORS, ARTIFACTS, NON_MAGICAL_ITEMS, rollMagicItem } from './config.js';
import { hexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes } from './hex.js';
import { Rando } from './rando.js';

const SPECIAL_TERRAINS = new Set([
    TERRAIN.SPECIAL_PLAINS, TERRAIN.SPECIAL_FOREST, TERRAIN.SPECIAL_HILLS
]);

export class GameWorld {
    constructor() {
        this.hexes = null;
        this.pois = [];
        this.revealed = new Set();
        this.visible = new Set();
        this.breachesClosed = 0;
    }

    generate() {
        let attempts = 0;
        do {
            this.hexes = this._generateRectGrid();
            this._assignTerrain();
            this._placePOIs();
            attempts++;
        } while (attempts < 20 && !this._validate());
        this._placePrizes();
    }

    getHex(q, r) {
        return this.hexes.get(hexKey(q, r));
    }

    isPassable(hex) {
        return hex && !hex.isEdge
            && hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.MOUNTAIN
            && hex.terrain !== TERRAIN.BREACH && hex.terrain !== TERRAIN.MAW;
    }

    passableHexes() {
        const result = [];
        for (const [, hex] of this.hexes) if (this.isPassable(hex)) result.push(hex);
        return result;
    }

    updateVision(q, r, radius, hasMawCompass) {
        this.visible = new Set();
        const inRange = hexesInRange(q, r, radius);
        for (const h of inRange) {
            const key = hexKey(h.q, h.r);
            if (this.hexes.has(key)) { this.visible.add(key); this.revealed.add(key); }
        }
        if (hasMawCompass) {
            for (const poi of this.pois) {
                if (poi.type === POI.MAW) {
                    const key = hexKey(poi.q, poi.r);
                    this.revealed.add(key);
                }
            }
        }
    }

    hasLOS(from, to) {
        const dist = hexDistance(from.q, from.r, to.q, to.r);
        if (dist <= 1) return true;
        for (let i = 1; i < dist; i++) {
            const t = i / dist;
            const midQ = from.q + (to.q - from.q) * t;
            const midR = from.r + (to.r - from.r) * t;
            const s = -midQ - midR;
            let rq = Math.round(midQ), rr = Math.round(midR), rs = Math.round(s);
            const qd = Math.abs(rq - midQ), rd = Math.abs(rr - midR), sd = Math.abs(rs - s);
            if (qd > rd && qd > sd) rq = -rr - rs;
            else if (rd > sd) rr = -rq - rs;
            const hex = this.hexes.get(hexKey(rq, rr));
            if (hex && hex.terrain === TERRAIN.MOUNTAIN) return false;
        }
        return true;
    }

    hasPath(from, to) {
        const costs = bfsHexes(from, this.hexes, hex => {
            const c = MOVEMENT_COST[hex.terrain];
            return c === undefined ? Infinity : c;
        }, Infinity);
        return costs.has(hexKey(to.q, to.r));
    }

    poiAt(q, r) {
        return this.pois.find(p => p.q === q && p.r === r);
    }

    closeBreach(poi) {
        poi.closed = true;
        this.breachesClosed++;
    }

    havens() {
        return this.pois.filter(p => p.type === POI.HAVEN);
    }

    _diamondSquare(size, roughness) {
        const grid = new Float64Array(size * size);
        const get = (x, y) => grid[y * size + x];
        const set = (x, y, v) => { grid[y * size + x] = v; };
        set(0, 0, Math.random()); set(size - 1, 0, Math.random());
        set(0, size - 1, Math.random()); set(size - 1, size - 1, Math.random());
        let step = size - 1, scale = roughness;
        while (step > 1) {
            const half = step / 2;
            for (let y = half; y < size - 1; y += step)
                for (let x = half; x < size - 1; x += step)
                    set(x, y, (get(x - half, y - half) + get(x + half, y - half) +
                        get(x - half, y + half) + get(x + half, y + half)) / 4 +
                        (Math.random() - 0.5) * scale);
            for (let y = 0; y < size; y += half)
                for (let x = (y + half) % step; x < size; x += step) {
                    let sum = 0, cnt = 0;
                    if (x >= half) { sum += get(x - half, y); cnt++; }
                    if (x + half < size) { sum += get(x + half, y); cnt++; }
                    if (y >= half) { sum += get(x, y - half); cnt++; }
                    if (y + half < size) { sum += get(x, y + half); cnt++; }
                    set(x, y, sum / cnt + (Math.random() - 0.5) * scale);
                }
            step = half; scale *= roughness;
        }
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
        for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
        return grid;
    }

    _generateRectGrid() {
        const map = new Map();
        const hm = this._diamondSquare(129, 0.55);
        for (let row = 0; row < MAP_ROWS; row++) {
            const qOffset = -Math.floor(row / 2);
            for (let col = 0; col < MAP_COLS; col++) {
                const q = col + qOffset, r = row;
                const gx = Math.round(col / (MAP_COLS - 1) * 128);
                const gy = Math.round(row / (MAP_ROWS - 1) * 128);
                const elevation = hm[gy * 129 + gx];
                const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
                map.set(hexKey(q, r), {
                    q, r, col, row, elevation, isEdge,
                    terrain: null, poi: null, goldDeposit: 0, shatteredCount: 0, skillGem: false
                });
            }
        }
        return map;
    }

    _assignTerrain() {
        const inner = [];
        for (const [, hex] of this.hexes) {
            if (hex.isEdge) { hex.terrain = TERRAIN.WATER; continue; }
            inner.push(hex);
        }
        inner.sort((a, b) => a.elevation - b.elevation);
        const n = inner.length;
        for (let i = 0; i < n; i++) {
            const pct = i / n;
            if (pct < 0.25) inner[i].terrain = TERRAIN.WATER;
            else if (pct < 0.85) inner[i].terrain = TERRAIN.PLAINS;
            else if (pct < 0.95) inner[i].terrain = TERRAIN.HILLS;
            else inner[i].terrain = TERRAIN.MOUNTAIN;
        }
        const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
        Rando.shuffle(plains);
        let idx = 0;
        const forestCount = Math.round(n * 0.10);
        for (let i = 0; i < forestCount && idx < plains.length; i++, idx++) plains[idx].terrain = TERRAIN.FOREST;
        const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
        Rando.shuffle(hills);
        const quarryCount = Math.max(2, Math.round(n * 0.02));
        for (let i = 0; i < quarryCount && i < hills.length; i++) hills[i].terrain = TERRAIN.QUARRY;
        this._placeSpecialHexes(inner, n);
    }

    // Prize hexes: lighter-tinted "special" versions of plains / forest / hills.
    // ~1% of the map, split across the three terrains. The prize each one holds
    // is rolled later in _placePrizes, once POIs have claimed their hexes.
    _placeSpecialHexes(inner, n) {
        const kinds = [
            [TERRAIN.PLAINS, TERRAIN.SPECIAL_PLAINS],
            [TERRAIN.FOREST, TERRAIN.SPECIAL_FOREST],
            [TERRAIN.HILLS, TERRAIN.SPECIAL_HILLS],
        ];
        const perKind = Math.max(1, Math.round(n * 0.01 / kinds.length));
        for (const [base, special] of kinds) {
            const pool = inner.filter(h => h.terrain === base);
            Rando.shuffle(pool);
            for (let i = 0; i < perKind && i < pool.length; i++) pool[i].terrain = special;
        }
    }

    _placePOIs() {
        this.pois = [];
        const candidates = this.passableHexes();
        const used = new Set();
        const MIN_DIST = 10;
        const self = this;

        function place(type, count, preferRight, reachable) {
            let pool = candidates.filter(h => !used.has(hexKey(h.q, h.r)));
            if (reachable) pool = pool.filter(h => reachable.has(hexKey(h.q, h.r)));
            if (preferRight) pool.sort((a, b) => b.col - a.col);
            else Rando.shuffle(pool);

            let placed = 0;
            for (const hex of pool) {
                if (placed >= count) break;
                const key = hexKey(hex.q, hex.r);
                let tooClose = false;
                for (const poi of self.pois) {
                    if (hexDistance(hex.q, hex.r, poi.q, poi.r) < MIN_DIST) { tooClose = true; break; }
                }
                if (tooClose) continue;
                used.add(key);
                hex.poi = type;
                const poi = { q: hex.q, r: hex.r, type, id: self.pois.length };
                if (type === POI.HAVEN) poi.shopItems = self._generateShopItems();
                if (type === POI.RUIN) { poi.ruinState = 'new'; hex.terrain = TERRAIN.RUINS; }
                if (type === POI.BREACH) { poi.closed = false; poi.guardianId = null; hex.terrain = TERRAIN.BREACH; }
                if (type === POI.MAW) { poi.closed = false; poi.guardianId = null; hex.terrain = TERRAIN.MAW; }
                // HUT skills are assigned later by SkillLibrary.deal (a non-binding
                // pool skill), so the world doesn't pick one here.
                self.pois.push(poi);
                placed++;
            }
            return placed;
        }

        place(POI.HAVEN, Rando.int(4, 6), false);
        place(POI.VILLAGE, Rando.int(8, 12), false);
        place(POI.RUIN, Rando.int(12, 20), false);
        place(POI.MAW, 1, true);
        // Breaches must be reachable from the Maw — otherwise the player
        // can never close them and they waste an encounter slot.
        place(POI.BREACH, Rando.int(6, 8), false, this.mawDistanceMap());
        place(POI.HUT, Rando.int(8, 12), false);
    }

    // Every prize hex (special terrain, not claimed by a POI) holds one reward,
    // chosen by weight: gold is the common find, skill gems uncommon, scrolls rare.
    // Each placer stamps whichever marker that reward's pickup path already reads —
    // goldDeposit, skillGem, or a SCROLL poi — so checkHexEntry needs no new cases.
    _placePrizes() {
        const prizes = [
            { weight: 7, item: h => { h.goldDeposit = Rando.int(10, 20); } },
            { weight: 2, item: h => { h.skillGem = true; } },
            { weight: 1, item: h => this._placeScrollPrize(h) },
        ];
        const hexes = this.passableHexes().filter(h => !h.poi && SPECIAL_TERRAINS.has(h.terrain));
        for (const hex of hexes) Rando.weighted(prizes)(hex);
    }

    // Prize scrolls are placed empty; SkillLibrary.deal assigns each a distinct skill.
    _placeScrollPrize(hex) {
        this._makeScroll(null, hex);
    }

    _generateShopItems() {
        const magicalCount = Rando.int(2, 3);
        const nonMagicalCount = Rando.int(2, 3);
        const magicalItems = [];
        for (let i = 0; i < magicalCount; i++) magicalItems.push(rollMagicItem());
        const nonMagicalPool = [...NON_MAGICAL_ITEMS];
        Rando.shuffle(nonMagicalPool);
        const items = [
            ...magicalItems,
            ...nonMagicalPool.slice(0, nonMagicalCount)
        ];
        Rando.shuffle(items);
        return items;
    }


    // Movement-cost reachability from an arbitrary passable origin.
    reachableFrom(q, r) {
        const start = this.getHex(q, r);
        if (!start) return new Map();
        return bfsHexes(start, this.hexes, hex => {
            const c = MOVEMENT_COST[hex.terrain];
            return c === undefined ? Infinity : c;
        }, Infinity);
    }

    mawDistanceMap() {
        const maw = this.pois.find(p => p.type === POI.MAW);
        if (!maw) return null;
        return this.reachableFrom(maw.q, maw.r);
    }

    // Hexes that are passable, unoccupied, reachable from (originQ, originR),
    // and accepted by pred(hex) — the raw candidate set for any scroll placement.
    _scrollCandidates(originQ, originR, pred) {
        const reachable = this.reachableFrom(originQ, originR);
        return this.passableHexes().filter(h =>
            !h.poi && reachable.has(hexKey(h.q, h.r)) && pred(h));
    }

    _makeScroll(skillId, hex) {
        hex.poi = POI.SCROLL;
        const poi = { q: hex.q, r: hex.r, type: POI.SCROLL, id: this.pois.length, skill: skillId };
        this.pois.push(poi);
        return poi;
    }

    // World-gen story scroll: prefers plains — converting the chosen one to
    // SPECIAL_PLAINS so the scroll rides a "special" hex like every other prize —
    // and only falls back to other terrain when no plains qualifies. Null if
    // nowhere fits.
    placeScroll(skillId, originQ, originR, pred) {
        const candidates = this._scrollCandidates(originQ, originR, pred);
        const plains = candidates.filter(h => h.terrain === TERRAIN.PLAINS);
        const pool = plains.length > 0 ? plains : candidates;
        if (pool.length === 0) return null;
        const hex = Rando.choice(pool);
        if (hex.terrain === TERRAIN.PLAINS) hex.terrain = TERRAIN.SPECIAL_PLAINS;
        return this._makeScroll(skillId, hex);
    }

    // In-game drop (e.g. the Maw's RETURN scroll): lands on any passable hex —
    // hills, forest, whatever — and leaves the terrain unchanged. Null if nowhere fits.
    dropScroll(skillId, originQ, originR, pred) {
        const candidates = this._scrollCandidates(originQ, originR, pred);
        if (candidates.length === 0) return null;
        return this._makeScroll(skillId, Rando.choice(candidates));
    }

    _validate() {
        const havens = this.pois.filter(p => p.type === POI.HAVEN);
        const maw = this.pois.find(p => p.type === POI.MAW);
        if (havens.length === 0 || !maw) return false;
        const dists = this.mawDistanceMap();
        if (!dists) return false;
        // All havens must have a path to the Maw
        const havenDists = [];
        for (const h of havens) {
            const d = dists.get(hexKey(h.q, h.r));
            if (d === undefined) return false;
            havenDists.push(d);
        }
        // At least half the havens must be more than halfway from the Maw
        // (relative to the farthest haven)
        const maxHavenDist = Math.max(...havenDists);
        const farCount = havenDists.filter(d => d > maxHavenDist / 2).length;
        return farCount >= Math.ceil(havens.length / 2);
    }

    toJSON() {
        return {
            hexes: [...this.hexes.entries()],
            pois: this.pois,
            revealed: [...this.revealed],
            breachesClosed: this.breachesClosed
        };
    }

    static fromJSON(data) {
        const w = new GameWorld();
        w.hexes = new Map(data.hexes);
        w.pois = data.pois;
        w.revealed = new Set(data.revealed);
        w.visible = new Set();
        w.breachesClosed = data.breachesClosed;
        return w;
    }
}
