// map.js — Arena map: terrain grid, generation, movement

class GameMap {
    constructor(screen, w, h) {
        this.screen = screen;
        this.w = w;
        this.h = h;
        this.ox = 1; // screen x offset (inside border)
        this.oy = 1; // screen y offset
        this.grid = new Uint8Array(w * h);
        this.border = BD_IN;
    }

    clear(t) { this.grid.fill(t != null ? t : T_CLEAR); }

    get(x, y) {
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) return -1;
        return this.grid[y * this.w + x];
    }

    set(x, y, t) {
        if (x >= 0 && x < this.w && y >= 0 && y < this.h)
            this.grid[y * this.w + x] = t;
    }

    check(x, y, flags) {
        const t = this.get(x, y);
        if (t < 0) return true;
        return (TERRAIN[t].flags & flags) !== 0;
    }

    inBounds(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }
    isBlocked(x, y) { return !this.inBounds(x, y) || this.check(x, y, FL_NOMOVE); }

    // render whole map (double-wide: each cell = 2 screen columns)
    show() {
        this.screen.box(this.border, this.ox-1, this.oy-1, this.ox+this.w*2, this.oy+this.h, BACKGR);
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++)
                this.showCell(x, y);
    }

    showCell(x, y) {
        const t = this.get(x, y);
        if (t >= 0 && t < NUM_TERRAIN) {
            const td = TERRAIN[t];
            const sx = this.ox + x * 2;
            this.screen.plot(sx,     y + this.oy, td.ch, td.attr);
            this.screen.plot(sx + 1, y + this.oy, td.ch, td.attr);
        }
    }

    // plot a unit: character + space
    plot(x, y, ch, attr) {
        const sx = this.ox + x * 2;
        this.screen.plot(sx,     y + this.oy, ch,  attr);
        this.screen.plot(sx + 1, y + this.oy, ' ', attr);
    }

    async blip(x, y, ch, attr, ms) {
        this.plot(x, y, ch, attr);
        await delay(ms);
        this.showCell(x, y);
    }

    // spatial
    adjacent(x1, y1, x2, y2) { return Math.abs(x1-x2) <= 1 && Math.abs(y1-y2) <= 1; }
    range(x1, y1, x2, y2)    { return Math.abs(x1-x2) + Math.abs(y1-y2); }
    delta(x1, y1, x2, y2)    { return dirFromDelta(x2-x1, y2-y1); }

    closein(dir, x, y) {
        const nx = x + DIR_DX[dir];
        const ny = y + DIR_DY[dir];
        if (this.inBounds(nx, ny) && !this.isBlocked(nx, ny)) return { x:nx, y:ny };
        return { x, y };
    }

    // random placement
    rndSpot(avoidFlags) {
        for (let t = 0; t < 500; t++) {
            const x = R(0, this.w-1), y = R(0, this.h-1);
            if (!this.check(x, y, avoidFlags)) return { x, y };
        }
        return { x:0, y:0 };
    }

    rndCent(avoidFlags) {
        for (let t = 0; t < 500; t++) {
            const x = Math.floor((R(0, this.w-1) + R(0, this.w-1)) / 2);
            const y = Math.floor((R(0, this.h-1) + R(0, this.h-1)) / 2);
            if (!this.check(x, y, avoidFlags)) return { x, y };
        }
        return this.rndSpot(avoidFlags);
    }

    rndRevcent(avoidFlags) {
        for (let t = 0; t < 500; t++) {
            let x = Math.max(R(0, this.w-1), R(0, this.w-1));
            let y = Math.max(R(0, this.h-1), R(0, this.h-1));
            if (R(0,1)) x = this.w - 1 - x;
            if (R(0,1)) y = this.h - 1 - y;
            if (!this.check(x, y, avoidFlags)) return { x, y };
        }
        return this.rndSpot(avoidFlags);
    }

    roundBorder(thickness, t1, t2) {
        const cx = (this.w - 1) / 2, cy = (this.h - 1) / 2;
        const rx = cx - thickness + 2.5, ry = cy - thickness + 2.5;
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++) {
                const dx = (x - cx) / rx, dy = (y - cy) / ry;
                if (dx*dx + dy*dy > 1) this.set(x, y, R(0,1) ? t1 : t2);
            }
        // ensure impassable barrier on top and bottom rows
        for (let x = 0; x < this.w; x++) {
            this.set(x, 0, R(0,1) ? t1 : t2);
            this.set(x, this.h - 1, R(0,1) ? t1 : t2);
        }
    }

    // for AI shift: adjacent cells sorted by direction preference
    getShiftPositions(x, y, dir) {
        const dirs = [1,2,3,4,6,7,8,9];
        dirs.sort((a,b) => {
            const da = Math.abs(DIR_DX[a]-DIR_DX[dir]) + Math.abs(DIR_DY[a]-DIR_DY[dir]);
            const db = Math.abs(DIR_DX[b]-DIR_DX[dir]) + Math.abs(DIR_DY[b]-DIR_DY[dir]);
            return da - db;
        });
        const out = [];
        for (const d of dirs) {
            const nx = x + DIR_DX[d], ny = y + DIR_DY[d];
            if (this.inBounds(nx, ny) && !this.isBlocked(nx, ny))
                out.push({ x:nx, y:ny });
        }
        return out;
    }
}

// ---- Map generators ----

function forestMap(map) {
    map.clear(T_CLEAR);
    map.roundBorder(3, T_TREE, T_ROCK);
    for (let i = 0; i < 10; i++) {
        let p;
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_TREE);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_TREE);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_TREE);
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_BUSH);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_BUSH);
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_ROCK);
        p = map.rndCent(FL_TERR);    map.set(p.x, p.y, T_POOL);
    }
}

function arenaMap(map) {
    map.clear(T_SAND);
    map.roundBorder(2, T_DKWALL, T_LTWALL);
}

function ruinsMap(map) {
    map.clear(T_CLEAR);
    map.roundBorder(3, T_ROCK, T_COLUMN);
    for (let i = 0; i < 5; i++) {
        let p;
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_ROCK);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_BUSH);
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_DKWALL);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_DKWALL);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_LTWALL);
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_COLUMN);
    }
    for (let y = 0; y < map.h; y++)
        for (let x = 0; x < map.w; x++)
            if (map.get(x, y) === T_CLEAR) map.set(x, y, T_SAND);
}

function rockyMap(map) {
    map.clear(T_CLEAR);
    map.roundBorder(3, T_ROCK, T_TREE);
    for (let i = 0; i < 15; i++) {
        let p;
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_ROCK);
        p = map.rndRevcent(FL_TERR); map.set(p.x, p.y, T_ROCK);
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_BUSH);
        p = map.rndSpot(FL_TERR);    map.set(p.x, p.y, T_SAND);
        p = map.rndCent(FL_TERR);    map.set(p.x, p.y, T_SAND);
    }
}
