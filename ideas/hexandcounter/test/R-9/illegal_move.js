// R-9: movePlayer to a hex outside computeReachable() — an enemy hex, an impassable hex,
// a hex out of MP range, or off the map — returns { ok:false } and changes nothing.
'use strict';
const { newGame, snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { g, state, engine } = newGame(777);
const board = engine.board;

function rejects(label, q, r) {
    const before = snapshot(state);
    const res = engine.movePlayer(q, r);
    check(`${label}: { ok:false }`, res.ok === false && Object.keys(res).length === 1);
    check(`${label}: state unchanged`, snapshot(state) === before);
}

// Enemy hex: park an enemy on a passable neighbor of the player.
const nb = board.neighbors(state.player.q, state.player.r).find(h => board.isPassable(h));
state.enemies[0].moveTo(nb.q, nb.r);
rejects('enemy hex', nb.q, nb.r);

// Impassable hex: an edge (water) hex.
const water = [...state.hexes.values()].find(h => h.isEdge);
rejects('impassable hex', water.q, water.r);

// Out of range: the target, far across the map.
rejects('out of MP range', state.target.q, state.target.r);

// Off the map.
rejects('off the map', -999, -999);

// The player's own hex.
rejects("player's own hex", state.player.q, state.player.r);
done();
