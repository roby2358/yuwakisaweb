// test/helpers/fixtures.js — shared setup for rule tests: controlled boards built on a real
// generated map, so each test can stage exactly the situation its rule needs.
'use strict';

const { newGame } = require('./load');

// A fresh game with the Sweepers removed and nothing awake: a quiet city to stage on.
// `overrides` patch GameArtifacts (e.g. { FADE_THRESHOLD: 0 } turns fading off so a test
// of another rule can stage awake blocks that would otherwise fade).
const NO_FADE = { FADE_THRESHOLD: 0 };
function quiet(seed, overrides) {
    const ctx = newGame(seed, overrides);
    ctx.state.sweepers = [];
    for (const [, h] of ctx.state.hexes) h.awake = false;
    return ctx;
}

// A block whose whole radius-`radius` neighborhood is blocks (an interior hex).
function interiorBlock(ctx, radius = 1) {
    const { engine } = ctx;
    const b = engine.board;
    return b.blocks().find(h => b.within(h.q, h.r, radius).every(n => b.isBlock(n) && !n.isEdge));
}

// Place a Sweeper of SWEEPER_KINDS[kindIdx] at (q, r).
function addSweeper(ctx, q, r, kindIdx = 0) {
    const { g, state } = ctx;
    const sw = new g.Sweeper(state.nextSweeperId++, q, r, g.GameArtifacts.SWEEPER_KINDS[kindIdx]);
    state.sweepers.push(sw);
    return sw;
}

// Plant rig `i` at (q, r) directly (staging, not the command).
function stageRig(ctx, i, q, r) {
    const rig = ctx.state.rigs[i];
    rig.moveTo(q, r);
    rig.status = 'planted';
    return rig;
}

// Move @ somewhere far from (q, r) on passable, unoccupied ground, so it stays out of the way.
function parkPlayerAway(ctx, q, r, minDist = 12) {
    const { g, state, engine } = ctx;
    const taken = new Set([...engine.sweeperKeys(), ...engine.stationKeys()]);
    const spot = engine.board.passableHexes()
        .filter(h => !taken.has(g.Hex.key(h.q, h.r)) && new g.Hex(h.q, h.r).distance({ q, r }) >= minDist)[0];
    state.player.moveTo(spot.q, spot.r);
    return spot;
}

const awakeKeys = state => [...state.hexes.values()].filter(h => h.awake).map(h => h.q + ',' + h.r).sort();

module.exports = { NO_FADE, quiet, interiorBlock, addSweeper, stageRig, parkPlayerAway, awakeKeys };
