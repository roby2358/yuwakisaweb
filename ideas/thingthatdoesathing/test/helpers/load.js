// test/helpers/load.js — boot the DOM-free engine stack in a fresh vm context.
//
// Concatenates the engine-side modules and runs them as ONE script, like the browser's
// classic <script> tags: one shared top-level lexical scope, so each module's `const X`
// is visible to the next. No DOM, no canvas, no displayartifacts.js. Every call returns a
// fresh context, so tests don't share Rando state.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

const ENGINE_MODULES = [
    'artifacts.js', 'rando.js', 'colortheory.js', 'hex.js',
    'piece.js', 'board.js', 'gamestate.js', 'gameengine.js'
];

function source(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function load() {
    const combined = ENGINE_MODULES.map(source).join('\n;\n');
    const bridge = '\n;Object.assign(__exports, { GameState, GameEngine, Piece, Board, ' +
        'GameArtifacts, Hex, Rando, bfsHexes, NEIGHBOR_DIRS, ' +
        "GameDisplayArtifacts: typeof GameDisplayArtifacts === 'undefined' ? undefined : GameDisplayArtifacts });";
    const ctx = vm.createContext({ console, __exports: {} });
    vm.runInContext(combined + bridge, ctx, { filename: 'engine-combined.js' });
    return ctx.__exports;
}

// A fresh engine with a game already generated from `seed` at board `size`.
function newGame(seed, size) {
    const g = load();
    const state = new g.GameState();
    const engine = new g.GameEngine(state);
    engine.newGame(seed, size);
    return { g, state, engine };
}

// The parts of GameState a command may change, as a comparable string.
function snapshot(state) {
    return JSON.stringify({
        sources: state.sources, targets: state.targets,
        pieces: state.pieces.map(p => [p.id, p.kind, p.key(), p.color]),
        things: state.things, hand: state.hand,
        turn: state.turn, delivered: state.delivered, lost: state.lost,
        spawnTimer: state.spawnTimer, nextId: state.nextId, phase: state.phase
    });
}

// A controlled board for rule tests: every inner hex PLAINS, edges WATER, no pieces, no
// Things, one red source and red target parked far away in the bottom row so they stay out
// of the way, and the spawn timer held back so no crate appears mid-test. Crates are red. Middle row r=4 runs
// q = -2 … 13 (col 0 … 15); its inner hexes are q = -1 … 12.
function flatGame(seed = 7) {
    const ctx = newGame(seed, 'small');
    const { g, state, engine } = ctx;
    for (const [, hex] of state.hexes) hex.terrain = hex.isEdge ? g.GameArtifacts.TERRAIN.WATER : g.GameArtifacts.TERRAIN.PLAINS;
    state.pieces = [];
    state.things = [];
    state.sources = [{ q: -3, r: 8, colors: ['red'] }];      // col 1, row 8
    state.targets = [{ q: 10, r: 8, color: 'red', delivered: 0 }];   // col 14, row 8
    state.spawnTimer = -1000;
    ctx.T = g.GameArtifacts.TERRAIN;
    ctx.put = (kind, q, r, facing = null) => { const t = { kind, q, r, facing }; state.things.push(t); return t; };
    ctx.piece = (kind, q, r) => engine.addPiece(kind, q, r, kind === 'gremlin' ? '#888888' : 'red');
    ctx.terrain = (q, r, t) => { state.hexes.get(g.Hex.key(q, r)).terrain = t; };
    return ctx;
}

// Direction indices (Hex neighbor order): E, NE, NW, W, SW, SE.
const DIR = { E: 0, NE: 1, NW: 2, W: 3, SW: 4, SE: 5 };

// Terrain of every hex, in Map order.
function terrainSignature(state) {
    const out = [];
    for (const [key, hex] of state.hexes) out.push(key + '=' + hex.terrain);
    return out.join(';');
}

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i * 7919);

module.exports = { ROOT, ENGINE_MODULES, source, load, newGame, flatGame, DIR, snapshot, terrainSignature, SEEDS };
