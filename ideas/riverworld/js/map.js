// Valley generation. Row 0 is the far north (the Tower); row ROWS-1 is where you wake.
// Stretches count 1 (start) to 5 (polar ice). Pure logic — no DOM.

var MapGen = (function () {
  const C = Data.CONFIG;

  // Chance a stone is held by a grail-slaver state, by stretch.
  const SLAVER_CHANCE = { 1: 0.25, 2: 0.4, 3: 0.55, 4: 0.7 };
  const WANDERER_CHANCE = { 1: 0.55, 2: 0.5, 3: 0.35, 4: 0.35 };

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stretchOf(r) {
    return 5 - Math.floor(r / C.STRETCH_ROWS);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function generate(rng) {
    const course = riverCourse(rng);
    const tiles = [];
    for (let r = 0; r < C.ROWS; r++) {
      tiles[r] = [];
      const mWest = 1 + (rng() < 0.4 ? 1 : 0);
      const mEast = 1 + (rng() < 0.4 ? 1 : 0);
      for (let c = 0; c < C.COLS; c++) {
        tiles[r][c] = makeTile(r, c, course[r], mWest, mEast, rng);
      }
    }
    buildTower(tiles);
    const stones = placeStones(tiles, rng, course);
    const start = stones[0]; // generation walks south to north — the first stone is where you wake
    return { tiles, stones, start };
  }

  function riverCourse(rng) {
    const course = [];
    let center = 7;
    for (let r = 0; r < C.ROWS; r++) {
      if (r % 4 === 0) center = clamp(center + Math.floor(rng() * 3) - 1, 5, 9);
      const half = stretchOf(r) === 5 ? 0 : (rng() < 0.35 ? 2 : 1);
      course[r] = { center, half };
    }
    return course;
  }

  function makeTile(r, c, river, mWest, mEast, rng) {
    const tile = { terrain: 'grass', seen: false, stoneKnown: false, stone: null };
    const polar = stretchOf(r) === 5;
    if (c < mWest || c >= C.COLS - mEast) { tile.terrain = 'mountain'; return tile; }
    if (Math.abs(c - river.center) <= river.half) { tile.terrain = 'water'; return tile; }
    if (polar) { tile.terrain = 'ice'; return tile; }
    const roll = rng();
    if (roll < 0.12) tile.terrain = 'bamboo';
    else if (roll < 0.22) tile.terrain = 'trees';
    return tile;
  }

  function buildTower(tiles) {
    const towerC = Math.floor(C.COLS / 2);
    for (let c = 0; c < C.COLS; c++) {
      tiles[0][c].terrain = (c === towerC) ? 'tower' : 'mountain';
    }
  }

  // Stones sit on a bank hex beside the river, every 5-7 rows through stretches 1-4.
  // The polar stretch has none — that is the point of the polar stretch.
  function placeStones(tiles, rng, course) {
    const stones = [];
    let side = rng() < 0.5 ? -1 : 1;
    let r = C.ROWS - 3;
    let captainIdx = 0;
    while (stretchOf(r) <= 4) {
      const hex = bankHex(tiles, course[r], r, side, rng);
      if (hex) {
        const s = stretchOf(r);
        const first = stones.length === 0;
        const slaver = !first && rng() < SLAVER_CHANCE[s];
        tiles[hex.r][hex.c].terrain = 'stone';
        tiles[hex.r][hex.c].stone = {
          slaver: slaver,
          rich: slaver,
          captainName: slaver ? Data.CAPTAINS[captainIdx++ % Data.CAPTAINS.length] : null,
          captive: slaver,
          wanderer: !slaver && (first || rng() < WANDERER_CHANCE[s]),
          wandererId: null,
        };
        stones.push({ c: hex.c, r: hex.r });
      }
      side = -side;
      r -= 5 + Math.floor(rng() * 3);
    }
    guaranteeFreeStones(tiles, stones);
    return stones;
  }

  function bankHex(tiles, river, r, side, rng) {
    const offset = river.half + 1 + Math.floor(rng() * 2);
    const candidates = [river.center + side * offset, river.center + side * (river.half + 1)];
    for (const c of candidates) {
      if (c < 0 || c >= C.COLS) continue;
      const t = tiles[r][c].terrain;
      if (t === 'grass' || t === 'bamboo' || t === 'trees') return { c, r };
    }
    return null;
  }

  // Every stretch keeps at least two free stones — starving the player of any
  // safe meal isn't difficulty, it's a dead map.
  function guaranteeFreeStones(tiles, stones) {
    for (let s = 1; s <= 4; s++) {
      const inStretch = stones.filter(st => stretchOf(st.r) === s);
      const free = inStretch.filter(st => !tiles[st.r][st.c].stone.slaver);
      let need = 2 - free.length;
      for (const st of inStretch) {
        if (need <= 0) break;
        const data = tiles[st.r][st.c].stone;
        if (!data.slaver) continue;
        data.slaver = false;
        data.captainName = null;
        data.captive = false;
        need--;
      }
    }
  }

  return { generate, makeRng, stretchOf };
})();
