const test = require('node:test');
const assert = require('node:assert');
const { loadLogic } = require('./helpers');

const ctx = loadLogic();
const Hex = ctx.Hex;

test('every hex has six neighbors at distance 1, both row parities', () => {
  for (const [c, r] of [[4, 4], [4, 5]]) {
    const ns = Hex.neighbors(c, r);
    assert.strictEqual(ns.length, 6);
    for (const n of ns) assert.strictEqual(Hex.distance(c, r, n.c, n.r), 1);
  }
});

test('distance is symmetric and zero on identity', () => {
  assert.strictEqual(Hex.distance(2, 3, 2, 3), 0);
  assert.strictEqual(Hex.distance(1, 1, 6, 9), Hex.distance(6, 9, 1, 1));
});

test('reachable respects the movement budget and terrain costs', () => {
  const cost = () => 1;
  const within2 = Hex.reachable(5, 5, 2, cost);
  for (const [, info] of within2) {
    assert.ok(info.cost <= 2);
    assert.ok(Hex.distance(5, 5, info.c, info.r) <= 2);
  }
  assert.ok(within2.size > 6); // more than just the immediate ring
});

test('reachable excludes impassable hexes', () => {
  const cost = (c, r) => (c === 6 ? Infinity : 1);
  const reach = Hex.reachable(5, 5, 3, cost);
  for (const [, info] of reach) assert.notStrictEqual(info.c, 6);
});

test('findPath routes around a wall with global vision', () => {
  // Wall on column 6 except a gap at r=9 — the detour is longer than one
  // turn's movement; A* must still find it (no BFS horizon).
  const cost = (c, r) => {
    if (c < 0 || c > 12 || r < 0 || r > 12) return Infinity;
    if (c === 6 && r !== 9) return Infinity;
    return 1;
  };
  const path = Hex.findPath(4, 2, { c: 9, r: 2 }, (c, r) => c === 9 && r === 2, cost);
  assert.ok(path, 'a path exists through the gap');
  assert.ok(path.some(s => s.c === 6 && s.r === 9), 'path uses the gap');
  const last = path[path.length - 1];
  assert.deepStrictEqual({ c: last.c, r: last.r }, { c: 9, r: 2 });
});
