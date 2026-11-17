// R-65: a slide is capped (D-52). Only moves from a slick hex (bare ICE or a Slide) to a slick
// hex count; on its MAX_SLIDE-th (3rd) such move in one motion a piece stops there, as if
// blocked, even with more ice ahead, so it covers at most 4 slick hexes in a row. Entering the
// first slick hex from other ground, or landing from the air, doesn't count. A shorter run is
// unchanged.
'use strict';
const { check, done } = require('../helpers/check');
const { flatGame, DIR } = require('../helpers/load');
{
    const { g } = flatGame();
    check('MAX_SLIDE is 3', g.GameArtifacts.MAX_SLIDE === 3);
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (let q = 1; q <= 8; q++) terrain(q, 4, T.ICE);
    const c = piece('crate', 0, 4);
    const { events } = engine.wait();
    check('a long ice run stops on its 4th ice hex', c.isAt(4, 4));
    const mv = events.find(e => e.type === 'move' && e.id === c.id);
    check('… having entered 4 hexes', mv && mv.path.length === 4);
}
{
    const { engine, put, piece } = flatGame();
    put('BELT', 0, 4, DIR.E); for (let q = 1; q <= 6; q++) put('SLIDE', q, 4);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a long run of Slides stops on its 4th Slide', c.isAt(4, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    // Airborne over 0 and 1, down on ice at 2, then it skids 3, 4, 5 and stops there.
    put('SPRING', -1, 4, DIR.E); for (let q = 0; q <= 10; q++) terrain(q, 4, T.ICE);
    const c = piece('crate', -1, 4);
    engine.wait();
    check('a skid after a Spring landing on ice stops 3 hexes past the landing', c.isAt(5, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    // Standing on ice at 1, pushed onto more ice: 2, 3, 4, and it stops there.
    put('PUSHER', 0, 4, DIR.E); for (let q = 1; q <= 8; q++) terrain(q, 4, T.ICE);
    const c = piece('crate', 1, 4);
    engine.wait();
    check('a piece standing on ice moved onto more ice stops 3 hexes on', c.isAt(4, 4));
}
{
    const { engine, put, piece, terrain, T } = flatGame();
    put('BELT', 0, 4, DIR.E); for (let q = 1; q <= 3; q++) terrain(q, 4, T.ICE);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a run of 3 ice is unchanged: it slides on to the first plains', c.isAt(4, 4));
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    // The 4th slick hex is the cap; a lake right after it isn't reached.
    put('BELT', 0, 4, DIR.E); for (let q = 1; q <= 4; q++) terrain(q, 4, T.ICE); terrain(5, 4, T.WATER);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a piece stopped by the cap stays on its 4th ice hex, short of the lake',
        c.isAt(4, 4) && state.lost === 0);
}
{
    const { state, engine, put, piece, terrain, T } = flatGame();
    // What happens on entering a hex still happens on the hexes it reaches: a target on the 3rd.
    state.targets = [{ q: 3, r: 4, color: 'red', delivered: 0 }];
    put('BELT', 0, 4, DIR.E); terrain(1, 4, T.ICE); terrain(2, 4, T.ICE);
    const c = piece('crate', 0, 4);
    engine.wait();
    check('a slide still delivers on a target it reaches', !state.pieces.includes(c) && state.delivered === 1);
}
done();
