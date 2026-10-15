// R-7: Board terrain queries. moveCost = MOVEMENT_COST[terrain] (Infinity if unknown),
// isPassable ⇔ finite cost, passableHexes() = exactly the non-edge passable hexes.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { g, state, engine } = newGame(4242);
const { TERRAIN, MOVEMENT_COST } = g.GameArtifacts;
const board = engine.board;

for (const [name, t] of Object.entries(TERRAIN)) {
    const hex = { terrain: t };
    check(`${name}: moveCost = MOVEMENT_COST[${name}]`, board.moveCost(hex) === MOVEMENT_COST[t]);
    check(`${name}: isPassable ⇔ finite cost`, board.isPassable(hex) === (MOVEMENT_COST[t] !== Infinity));
}
check('unknown terrain costs Infinity', board.moveCost({ terrain: 99 }) === Infinity && !board.isPassable({ terrain: 99 }));

const expected = [...state.hexes.values()].filter(h => !h.isEdge && board.isPassable(h)).map(h => g.Hex.key(h.q, h.r)).sort();
const got = board.passableHexes().map(h => g.Hex.key(h.q, h.r)).sort();
check('passableHexes() is exactly the non-edge passable hexes', JSON.stringify(got) === JSON.stringify(expected));
done();
