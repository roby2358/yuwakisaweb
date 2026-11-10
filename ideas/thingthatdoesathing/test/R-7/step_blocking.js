// R-7: a step into an off-map hex, mountain, Wall, or a hex holding a piece is blocked and
// the piece stays; plains, ice, a bridge, or a mover's hex accept it.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
const { engine, put, piece, terrain, T } = flatGame();
const c = piece('crate', 3, 4);
const tryStep = (setup, expect, label) => {
    c.moveTo(3, 4); engine.state.things = []; terrain(4, 4, T.PLAINS);
    engine.state.pieces = [c];
    setup();
    const res = engine.step(c, DIR.E);
    check(label + ' → ' + res, res === expect && (expect === 'blocked' ? c.isAt(3, 4) : c.isAt(4, 4)));
};
tryStep(() => terrain(4, 4, T.MOUNTAIN), 'blocked', 'mountain');
tryStep(() => put('WALL', 4, 4), 'blocked', 'wall');
tryStep(() => piece('gremlin', 4, 4), 'blocked', 'another piece');
tryStep(() => {}, 'moved', 'plains');
tryStep(() => terrain(4, 4, T.ICE), 'moved', 'ice');
tryStep(() => put('BELT', 4, 4, DIR.W), 'moved', 'a belt');
tryStep(() => { terrain(4, 4, T.WATER); put('BRIDGE', 4, 4); }, 'moved', 'a bridge');
// Off-map: from the east-most column of row 4 (col 15 is q = 13).
c.moveTo(13, 4); engine.state.things = [];
check('off-map is blocked', engine.step(c, DIR.E) === 'blocked' && c.isAt(13, 4));
done();
