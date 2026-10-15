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
        'GameArtifacts, Hex, Rando, bfsHexes, ' +
        "GameDisplayArtifacts: typeof GameDisplayArtifacts === 'undefined' ? undefined : GameDisplayArtifacts });";
    const ctx = vm.createContext({ console, __exports: {} });
    vm.runInContext(combined + bridge, ctx, { filename: 'engine-combined.js' });
    return ctx.__exports;
}

// A fresh engine with a game already generated from `seed`.
function newGame(seed) {
    const g = load();
    const state = new g.GameState();
    const engine = new g.GameEngine(state);
    engine.newGame(seed);
    return { g, state, engine };
}

// The parts of GameState a command may change, as a comparable string.
function snapshot(state) {
    return JSON.stringify({
        player: state.player.key(),
        target: state.target.key(),
        enemies: state.enemies.map(e => [e.key(), e.color]),
        turn: state.turn, mp: state.mp, gameWon: state.gameWon, phase: state.phase
    });
}

// Terrain of every hex, in Map order.
function terrainSignature(state) {
    const out = [];
    for (const [key, hex] of state.hexes) out.push(key + '=' + hex.terrain);
    return out.join(';');
}

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i * 7919);

module.exports = { ROOT, ENGINE_MODULES, source, load, newGame, snapshot, terrainSignature, SEEDS };
