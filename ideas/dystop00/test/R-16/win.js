// R-16: when a broadcast leaves awake blocks ≥ ceil(WIN_FRAC × blocks), outcome = 'won', the
// regime phase does not run, and endTurn returns { ok:true, outcome:'won' }. After that every
// command returns { ok:false } and changes nothing.
'use strict';
const { NO_FADE, quiet, addSweeper } = require('../helpers/fixtures');
const { snapshot } = require('../helpers/load');
const { check, done } = require('../helpers/check');
const ctx = quiet(1616, NO_FADE);   // fading is R-31's rule
const { g, state, engine } = ctx;
const blocks = engine.board.blocks();
const target = engine.winTarget();
check('winTarget = ceil(WIN_FRAC × blocks)', target === Math.ceil(g.GameArtifacts.WIN_FRAC * blocks.length));
// Wake exactly one short of the target, leaving a block that the spread will catch.
blocks.slice(0, target - 1).forEach(h => { h.awake = true; });
const far = state.stations[0];
const sw = addSweeper(ctx, ...(() => { const n = engine.board.neighbors(far.q, far.r).find(h => engine.board.isPassable(h)); return [n.q, n.r]; })());
const swBefore = sw.key();
const spreadable = blocks.some(h => !h.awake && !engine.jammedKeys().has(g.Hex.key(h.q, h.r)) &&
    engine.board.neighbors(h.q, h.r).filter(n => n.awake).length >= g.GameArtifacts.WAKE_THRESHOLD);
check('setup: some block will wake', spreadable);
const res = engine.endTurn();
check('won', res.ok && res.outcome === 'won' && state.outcome === 'won');
check('regime did not run (Sweeper unmoved, turn not advanced)', sw.key() === swBefore && state.turn === 1);
const before = snapshot(state);
const step = engine.board.neighbors(state.player.q, state.player.r)[0];
check('every command refused after', !engine.movePlayer(step.q, step.r).ok && !engine.plant().ok &&
    !engine.retrieve().ok && !engine.endTurn().ok && snapshot(state) === before);
done();
