// mapgen.js — terrain generation, extracted from the baseline index.js. Produces a
// Map<key, hex> of the PowerRange board. Hex runtime fields used by the economy
// (onFire, controlledBy) live here so the whole hex shape is created in one place.
// Classic script: depends on config.js (TERRAIN, MAP_COLS, MAP_ROWS), hex.js, rando.js.

// ---- Heightmap (diamond-square) ----
function diamondSquare(size, roughness) {
    const grid = new Float64Array(size * size);
    const get = (x, y) => grid[y * size + x];
    const set = (x, y, v) => { grid[y * size + x] = v; };

    set(0, 0, Math.random());
    set(size - 1, 0, Math.random());
    set(0, size - 1, Math.random());
    set(size - 1, size - 1, Math.random());

    let step = size - 1;
    let scale = roughness;
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
        step = half;
        scale *= roughness;
    }

    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) { min = Math.min(min, grid[i]); max = Math.max(max, grid[i]); }
    for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / (max - min) * 100;
    return grid;
}

function buildGrid() {
    const hexes = new Map();
    const hm = diamondSquare(129, 0.55);

    for (let row = 0; row < MAP_ROWS; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < MAP_COLS; col++) {
            const q = col + qOffset;
            const r = row;
            const gx = Math.round(col / (MAP_COLS - 1) * 128);
            const gy = Math.round(row / (MAP_ROWS - 1) * 128);
            const elevation = hm[gy * 129 + gx];
            const isEdge = row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;

            hexes.set(Hex.key(q, r), {
                q, r, col, row, elevation, isEdge,
                terrain: null,
                onFire: 0,          // turns remaining while burning
                controlledBy: null  // faction id or null, recomputed each income phase
            });
        }
    }
    return hexes;
}

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
        if (pct < 0.22) inner[i].terrain = TERRAIN.WATER;
        else if (pct < 0.84) inner[i].terrain = TERRAIN.PLAINS;
        else if (pct < 0.94) inner[i].terrain = TERRAIN.HILLS;
        else inner[i].terrain = TERRAIN.MOUNTAIN;
    }

    // Gold and forest scattered through the plains; quarries among the hills.
    const plains = inner.filter(h => h.terrain === TERRAIN.PLAINS);
    Rando.shuffle(plains);
    const forestCount = Math.round(n * 0.10);
    const goldCount = Math.max(3, Math.round(n * 0.02));
    let idx = 0;
    for (let i = 0; i < forestCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.FOREST;
    for (let i = 0; i < goldCount && idx < plains.length; i++, idx++)
        plains[idx].terrain = TERRAIN.GOLD;

    const hills = inner.filter(h => h.terrain === TERRAIN.HILLS);
    Rando.shuffle(hills);
    const quarryCount = Math.max(1, Math.round(n * 0.01));
    for (let i = 0; i < quarryCount && i < hills.length; i++)
        hills[i].terrain = TERRAIN.QUARRY;
}

function generateMap() {
    const hexes = buildGrid();
    assignTerrain(hexes);
    return hexes;
}
