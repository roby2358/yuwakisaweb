// world.js — GameWorld: hex grid, POIs, fog of war

import { TERRAIN, MAP_COLS, MAP_ROWS, MOVEMENT_COST, POI, WEAPONS, ARMORS, ARTIFACTS, ALL_EQUIPMENT, NON_MAGICAL_ITEMS, SKILLS, rollMagicItem } from './config.js';
import { hexKey, hexNeighbors, hexDistance, hexesInRange, bfsHexes } from './hex.js';
import { Rando } from './rando.js';

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
    }

    getHex(q, r) {
        return this.hexes.get(hexKey(q, r));
    }

    isPassable(hex) {
        return hex && !hex.isEdge && hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.MOUNTAIN;
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
                    terrain: null, poi: null, goldDeposit: 0, shatteredCount: 0
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
        const goldCount = Math.max(3, Math.round(n * 0.01));
        for (let i = 0; i < forestCount && idx < plains.length; i++, idx++) plains[idx].terrain = TERRAIN.FOREST;
        for (let i = 0; i < goldCount && idx < plains.length; i++, idx++) { plains[idx].terrain = TERRAIN.GOLD; plains[idx].goldDeposit = 10; }
        const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
        Rando.shuffle(hills);
        const quarryCount = Math.max(2, Math.round(n * 0.02));
        for (let i = 0; i < quarryCount && i < hills.length; i++) hills[i].terrain = TERRAIN.QUARRY;
    }

    _placePOIs() {
        this.pois = [];
        const candidates = this.passableHexes();
        const used = new Set();
        const MIN_DIST = 10;
        const self = this;

        function place(type, count, preferRight) {
            let pool = candidates.filter(h => !used.has(hexKey(h.q, h.r)));
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
                if (type === POI.RUIN) { poi.ruinState = 'new'; }
                if (type === POI.BREACH) { poi.closed = false; poi.guardianId = null; }
                if (type === POI.MAW) { poi.closed = false; poi.guardianId = null; }
                if (type === POI.HUT) {
                    // Assign a random skill (excluding restore which everyone starts with)
                    const skillPool = Object.values(SKILLS).filter(s => s.id !== 'restore');
                    poi.skill = Rando.choice(skillPool).id;
                }
                self.pois.push(poi);
                placed++;
            }
            return placed;
        }

        place(POI.HAVEN, Rando.int(4, 6), false);
        place(POI.VILLAGE, Rando.int(8, 12), false);
        place(POI.RUIN, Rando.int(12, 20), false);
        place(POI.BREACH, Rando.int(6, 8), false);
        place(POI.MAW, 1, true);
        place(POI.HUT, Rando.int(8, 12), false);
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


    _validate() {
        const havens = this.pois.filter(p => p.type === POI.HAVEN);
        const maw = this.pois.find(p => p.type === POI.MAW);
        if (havens.length === 0 || !maw) return false;
        return this.hasPath(havens[0], maw);
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
