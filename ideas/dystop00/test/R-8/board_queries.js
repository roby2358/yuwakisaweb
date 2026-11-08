// R-8: board.moveCost = MOVEMENT_COST[terrain] (unknown → Infinity); isPassable ⇔ finite;
// passableHexes = non-edge passable hexes; within(q,r,n) = on-map hexes at distance ≤ n;
// blocks() = every BLOCK hex.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const { g, state, engine } = newGame(4242);
const b = engine.board, A = g.GameArtifacts;
for (const [name, t] of Object.entries(A.TERRAIN))
    check(`${name} cost`, b.moveCost({ terrain: t }) === A.MOVEMENT_COST[t] && b.isPassable({ terrain: t }) === Number.isFinite(A.MOVEMENT_COST[t]));
check('unknown terrain is impassable', b.moveCost({ terrain: 99 }) === Infinity);
const all = [...state.hexes.values()];
check('passableHexes', b.passableHexes().length === all.filter(h => !h.isEdge && Number.isFinite(A.MOVEMENT_COST[h.terrain])).length);
check('blocks', b.blocks().length === all.filter(h => h.terrain === A.TERRAIN.BLOCK).length);
const c = all.find(h => h.col === 10 && h.row === 10);
const w = b.within(c.q, c.r, 2);
check('within radius 2 of an inner hex = 19 hexes at distance ≤ 2',
    w.length === 19 && w.every(h => new g.Hex(h.q, h.r).distance(c) <= 2));
const corner = all.find(h => h.col === 0 && h.row === 0);
check('within drops off-map hexes', b.within(corner.q, corner.r, 1).length < 7);
done();
