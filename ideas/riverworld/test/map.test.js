const test = require('node:test');
const assert = require('node:assert');
const { loadLogic } = require('./helpers');

const ctx = loadLogic();
const { MapGen, Data } = ctx;
const C = Data.CONFIG;

function gen(seed) { return MapGen.generate(MapGen.makeRng(seed)); }

test('map has the right dimensions and exactly one tower', () => {
  const map = gen(7);
  assert.strictEqual(map.tiles.length, C.ROWS);
  assert.strictEqual(map.tiles[0].length, C.COLS);
  const towers = map.tiles.flat().filter(t => t.terrain === 'tower');
  assert.strictEqual(towers.length, 1);
});

test('every row keeps mountain walls and a river channel', () => {
  const map = gen(11);
  for (let r = 1; r < C.ROWS; r++) {
    const terrains = map.tiles[r].map(t => t.terrain);
    assert.strictEqual(terrains[0], 'mountain', `row ${r} west wall`);
    assert.strictEqual(terrains[C.COLS - 1], 'mountain', `row ${r} east wall`);
    assert.ok(terrains.includes('water'), `row ${r} has river`);
  }
});

test('stones exist only in stretches 1-4 — the polar stretch starves', () => {
  const map = gen(23);
  assert.ok(map.stones.length >= 10, 'a real river of stones');
  for (const st of map.stones) {
    assert.strictEqual(map.tiles[st.r][st.c].terrain, 'stone');
    const s = MapGen.stretchOf(st.r);
    assert.ok(s >= 1 && s <= 4, `stone at row ${st.r} in stretch ${s}`);
  }
});

test('every stretch keeps at least two free stones (or all it has)', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const map = gen(seed);
    for (let s = 1; s <= 4; s++) {
      const inStretch = map.stones.filter(st => MapGen.stretchOf(st.r) === s);
      const free = inStretch.filter(st => !map.tiles[st.r][st.c].stone.slaver);
      assert.ok(free.length >= Math.min(2, inStretch.length),
        `seed ${seed} stretch ${s}: ${free.length} free of ${inStretch.length}`);
    }
  }
});

test('the start stone is the southernmost and is free with a wanderer', () => {
  const map = gen(42);
  const maxRow = Math.max(...map.stones.map(st => st.r));
  assert.strictEqual(map.start.r, maxRow);
  const stone = map.tiles[map.start.r][map.start.c].stone;
  assert.strictEqual(stone.slaver, false);
  assert.strictEqual(stone.wanderer, true, 'someone waits at the first stone');
});

test('pickWeighted is deterministic at the roll extremes', () => {
  assert.strictEqual(Data.pickWeighted(Data.ITEMS, 0), 'ration');
  assert.strictEqual(Data.pickWeighted(Data.ITEMS, 0.9999), 'cigars');
});
