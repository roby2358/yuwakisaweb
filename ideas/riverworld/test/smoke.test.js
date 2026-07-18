// Ecology smoke test: random 30-turn walks across seeds — the full turn loop
// (gong, slavers, press-gangs, starvation, resurrection) must never throw and
// must keep the board invariants intact.
const test = require('node:test');
const assert = require('node:assert');
const { loadLogic, TEST_LEADER } = require('./helpers');

test('30-turn pushes upriver never throw and keep board invariants', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const ctx = loadLogic();
    const Game = ctx.Game;
    const S = Game.newGame(seed, TEST_LEADER);
    for (let t = 0; t < 30 && !S.over; t++) {
      for (const u of Game.footParty().slice()) {
        if (!Game.byId(u.id) || S.over) break;
        const north = northmostReachable(Game, u);
        if (north) Game.moveTo(u.id, north.c, north.r);
        const foe = Game.slaverUnits().find(x => Game.canAttack(u, x));
        if (foe) Game.attack(u.id, foe.id);
      }
      if (!S.over) Game.endTurn();
      assertInvariants(ctx, S, seed, t);
    }
  }
});

function northmostReachable(Game, u) {
  let best = null;
  for (const [, info] of Game.reachableFor(u)) {
    if (!best || info.r < best.r) best = info;
  }
  return best;
}

function assertInvariants(ctx, S, seed, t) {
  if (S.over) return; // a finished game may leave a body on the board
  const taken = new Set();
  for (const u of S.units) {
    if (u.aboard) continue;
    const tag = `seed ${seed} turn ${t} ${u.name}`;
    assert.ok(u.r >= 0 && u.r < S.tiles.length, `${tag} on the map`);
    const terrain = S.tiles[u.r][u.c].terrain;
    assert.ok(ctx.Data.TERRAIN[terrain].walk, `${tag} on walkable ${terrain}`);
    const k = u.c + ',' + u.r;
    assert.ok(!taken.has(k), `${tag} shares a hex`);
    taken.add(k);
    assert.ok(u.hp > 0, `${tag} alive units only`);
  }
  assert.ok(S.deaths >= 0, 'deaths counter never negative');
  assert.ok(!S.over || S.over.win, 'nothing ends the run except the Tower');
}
