// hexmap.js — Hex grid: terrain storage, movement, map generators

class HexMap {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.grid = new Uint8Array(w * h);       // terrain type
        this.variation = new Uint8Array(w * h);   // sprite variation per cell
    }

    clear(t) {
        this.grid.fill(t != null ? t : T_CLEAR);
        for (let i = 0; i < this.variation.length; i++)
            this.variation[i] = R(0, SPRITE_COLS - 1);
    }

    get(x, y) {
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) return -1;
        return this.grid[y * this.w + x];
    }

    getVar(x, y) {
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) return 0;
        return this.variation[y * this.w + x];
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

    // Move in hex direction, return new pos (or same if blocked)
    closein(dir, x, y) {
        if (dir < 0 || dir > 5) return { x, y };
        const n = hexNeighbor(x, y, dir);
        if (this.inBounds(n.x, n.y) && !this.isBlocked(n.x, n.y)) return n;
        return { x, y };
    }

    // Get all walkable neighbors sorted by preference toward a direction
    getShiftPositions(x, y, targetDir) {
        // Sort the 6 directions by closeness to targetDir (using cube dot product)
        const dirs = [0, 1, 2, 3, 4, 5];
        const td = CUBE_DIRS[targetDir];
        dirs.sort((a, b) => {
            const da = CUBE_DIRS[a], db = CUBE_DIRS[b];
            const dotA = da.x * td.x + da.y * td.y + da.z * td.z;
            const dotB = db.x * td.x + db.y * td.y + db.z * td.z;
            return dotB - dotA; // higher dot = more aligned = preferred
        });
        const out = [];
        for (const d of dirs) {
            const n = hexNeighbor(x, y, d);
            if (this.inBounds(n.x, n.y) && !this.isBlocked(n.x, n.y))
                out.push(n);
        }
        return out;
    }

    // Hex distance (Manhattan in cube coords)
    range(x1, y1, x2, y2) { return hexDist(x1, y1, x2, y2); }

    // Direction from one hex to another
    delta(x1, y1, x2, y2) { return hexDirTo(x1, y1, x2, y2); }

    // BFS: return first step toward (tx,ty) avoiding blocked terrain and occupied hexes.
    // occupied is a function(x,y)->bool for dynamically blocked cells (other guys).
    // Returns {x,y} of the first step, or null if no path found.
    bfsStep(sx, sy, tx, ty, occupied) {
        const key = (x, y) => y * this.w + x;
        const start = key(sx, sy), goal = key(tx, ty);
        const came = new Map();  // key -> previous key
        const queue = [start];
        came.set(start, -1);

        while (queue.length) {
            const cur = queue.shift();
            const cx = cur % this.w, cy = (cur - cx) / this.w;
            if (cur === goal) {
                // Trace back to the first step from start
                let step = cur;
                while (came.get(step) !== start) step = came.get(step);
                return { x: step % this.w, y: (step - step % this.w) / this.w };
            }
            for (let d = 0; d < 6; d++) {
                const n = hexNeighbor(cx, cy, d);
                if (!this.inBounds(n.x, n.y) || this.isBlocked(n.x, n.y)) continue;
                const nk = key(n.x, n.y);
                if (came.has(nk)) continue;
                // Allow the goal hex even if occupied (we want to path to adjacent)
                if (nk !== goal && occupied(n.x, n.y)) continue;
                came.set(nk, cur);
                queue.push(nk);
            }
        }
        return null;
    }

    // Random placement
    rndSpot(avoidFlags) {
        for (let t = 0; t < 500; t++) {
            const x = R(0, this.w - 1), y = R(0, this.h - 1);
            if (!this.check(x, y, avoidFlags)) return { x, y };
        }
        return { x: 0, y: 0 };
    }

    rndCent(avoidFlags) {
        for (let t = 0; t < 500; t++) {
            const x = Math.floor((R(0, this.w - 1) + R(0, this.w - 1)) / 2);
            const y = Math.floor((R(0, this.h - 1) + R(0, this.h - 1)) / 2);
            if (!this.check(x, y, avoidFlags)) return { x, y };
        }
        return this.rndSpot(avoidFlags);
    }

    rndRevcent(avoidFlags) {
        for (let t = 0; t < 500; t++) {
            let x = Math.max(R(0, this.w - 1), R(0, this.w - 1));
            let y = Math.max(R(0, this.h - 1), R(0, this.h - 1));
            if (R(0, 1)) x = this.w - 1 - x;
            if (R(0, 1)) y = this.h - 1 - y;
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
                if (dx * dx + dy * dy > 1) this.set(x, y, R(0, 1) ? t1 : t2);
            }
        for (let x = 0; x < this.w; x++) {
            this.set(x, 0, R(0, 1) ? t1 : t2);
            this.set(x, this.h - 1, R(0, 1) ? t1 : t2);
        }
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
