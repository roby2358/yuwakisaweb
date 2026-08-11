// test/smoke.js — DOM-free smoke test for the engine/state/board/piece stack.
//
// Boots the server-side modules (no canvas, no DOM, no display artifacts) in a vm
// context and checks the refactor invariants: pieces are Piece instances carrying their
// own color/label, the Board answers terrain queries, a game is reachable and reproducible
// from its seed, and a move mutates the player piece in place.
//
// Run:  node test/smoke.js       (exit 0 = all pass, 1 = any fail)
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// DOM-free load order (no displayartifacts — the engine never calls the pixel helpers).
const MODULES = [
    'artifacts.js', 'rando.js', 'colortheory.js', 'hex.js',
    'piece.js', 'board.js', 'gamestate.js', 'gameengine.js'
];

// Concatenate and run as ONE script: like the browser's classic <script> tags, this
// shares a single top-level lexical scope so each module's `const X` is visible to the
// next. (Separate vm.runInContext calls would each get their own scope and not see it.)
const combined = MODULES
    .map(file => fs.readFileSync(path.join(ROOT, file), 'utf8'))
    .join('\n;\n');
const bridge = '\n;Object.assign(__exports, { GameState, GameEngine, Piece, Board, GameArtifacts });';

const ctx = vm.createContext({ console, __exports: {} });
vm.runInContext(combined + bridge, ctx, { filename: 'combined.js' });

let failures = 0;
function check(label, cond) {
    if (cond) { console.log('  ok   ' + label); return; }
    console.log('  FAIL ' + label);
    failures++;
}

// ---- Boot a reproducible game ----
const { GameState, GameEngine, Piece, Board, GameArtifacts } = ctx.__exports;
const state = new GameState();
const engine = new GameEngine(state);
engine.newGame(12345);

console.log('Pieces:');
check('player is a Piece', state.player instanceof Piece);
check('target is a Piece', state.target instanceof Piece);
check("player label is 'P'", state.player.label === 'P');
check("target label is '★'", state.target.label === '★');
check('player color left null (drawn with display constant)', state.player.color === null);
check('enemies are all Pieces', state.enemies.every(e => e instanceof Piece));
check('every enemy carries a #rrggbb color', state.enemies.every(e => /^#[0-9a-f]{6}$/i.test(e.color)));
check("every enemy label is 'E'", state.enemies.every(e => e.label === 'E'));
check('enemyColors parallel array is gone', state.enemyColors === undefined);

console.log('Board:');
check('engine.board is a Board', engine.board instanceof Board);
check('board wraps the state hex Map', engine.board.hexes === state.hexes);
check('target is reachable from player', engine.board.hasPath(state.player, state.target));
check('passableHexes are all passable & non-edge',
    engine.board.passableHexes().every(h => !h.isEdge && engine.board.isPassable(h)));

console.log('Movement:');
check('fresh turn has full MP', state.mp === GameArtifacts.PLAYER_MP);
const reachable = engine.computeReachable();
check('computeReachable returns non-empty set', reachable.size > 0);
check('player hex excluded from reachable', !reachable.has(state.player.key()));
const destKey = reachable.keys().next().value;
const [dq, dr] = destKey.split(',').map(Number);
const before = state.player.key();
const res = engine.movePlayer(dq, dr);
check('movePlayer reports ok', res.ok === true);
check('player piece moved in place', state.player.isAt(dq, dr) && state.player.key() !== before);
check('player is still a Piece after moving', state.player instanceof Piece);

// ---- Reproducibility: same seed → same layout ----
console.log('Reproducibility:');
const a = new GameEngine(new GameState()); a.newGame(999);
const b = new GameEngine(new GameState()); b.newGame(999);
const sig = eng => JSON.stringify({
    p: eng.state.player.key(), t: eng.state.target.key(),
    e: eng.state.enemies.map(x => [x.key(), x.color])
});
check('same seed reproduces player, target, enemies & colors', sig(a) === sig(b));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
