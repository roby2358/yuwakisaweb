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
check('home is a Piece', state.home instanceof Piece);
check("player label is 'P'", state.player.label === 'P');
check("home marker label is '⌂'", state.home.label === '⌂');
check('player color left null (drawn with display constant)', state.player.color === null);
check('monsters are all Pieces', state.monsters.every(monster => monster instanceof Piece));
check('every monster carries a #rrggbb color', state.monsters.every(monster => /^#[0-9a-f]{6}$/i.test(monster.color)));
check("every monster label is 'M'", state.monsters.every(monster => monster.label === 'M'));
check('legacy enemies collection is gone', state.enemies === undefined);
check('game begins with exactly 3 Sunstones', state.gems.filter(g => g.type === 'sunstone').length === GameArtifacts.SUNSTONES_REQUIRED);
check('game begins with 45 ordinary gems', state.gems.filter(g => g.type !== 'sunstone').length === GameArtifacts.INITIAL_ORDINARY_GEMS);
check('six gem types receive six distinct sampled effects', Object.keys(state.effectByGem).length === 6 && new Set(Object.values(state.effectByGem)).size === 6);
check('effect pool is larger than gem type sample', Object.keys(GameArtifacts.GEM_EFFECTS).length > Object.keys(state.effectByGem).length);
const sunstone = state.gems.find(g => g.type === 'sunstone');
state.player.moveTo(sunstone.q, sunstone.r);
engine.collectGemsNear(sunstone.q, sunstone.r);
check('collecting a Sunstone does not respawn one', state.gems.filter(g => g.type === 'sunstone').length === GameArtifacts.SUNSTONES_REQUIRED - 1);
check('a Sunstone is replaced by an ordinary gem', state.gems.length === GameArtifacts.SUNSTONES_REQUIRED + GameArtifacts.INITIAL_ORDINARY_GEMS);
check('monsters have 2 movement steps', GameArtifacts.MONSTER_MOVEMENT === 2);

console.log('Board:');
check('engine.board is a Board', engine.board instanceof Board);
check('board wraps the state hex Map', engine.board.hexes === state.hexes);
check('map is 60 x 60', GameArtifacts.MAP_COLS === 60 && GameArtifacts.MAP_ROWS === 60 && state.hexes.size === 3600);
const homeHex = state.hexes.get(state.home.key());
check('home is near the map center', Math.abs(homeHex.col - 29.5) <= 6 && Math.abs(homeHex.row - 29.5) <= 6);
check('all six home neighbors are passable', engine.board.neighbors(state.home.q, state.home.r).length === 6 && engine.board.neighbors(state.home.q, state.home.r).every(h => engine.board.isPassable(h)));
check('all passable land is connected to home', engine.reachableLandKeys(state.home).size === engine.board.passableHexes().length);
check('home is reachable from player', engine.board.hasPath(state.player, state.home));
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

console.log('Terminal state:');
const danger = new GameEngine(new GameState()); danger.newGame(321);
const adjacent = danger.board.neighbors(danger.state.player.q, danger.state.player.r).find(h => danger.board.isPassable(h));
danger.state.monsters = [new Piece(adjacent.q, adjacent.r, '#cc2244', 'M')];
danger.endTurn();
check('monster contact produces one lost status', danger.state.status === 'lost');
check('a loss remains in the monster phase', danger.state.phase === 'monsters' && danger.state.turn === 1);

// ---- Reproducibility: same seed → same layout ----
console.log('Reproducibility:');
const a = new GameEngine(new GameState()); a.newGame(999);
const b = new GameEngine(new GameState()); b.newGame(999);
const sig = eng => JSON.stringify({
    p: eng.state.player.key(), home: eng.state.home.key(),
    monsters: eng.state.monsters.map(x => [x.key(), x.color]),
    gems: eng.state.gems.map(x => [x.q, x.r, x.type]), effects: eng.state.effectByGem
});
check('same seed reproduces map actors, gems & effects', sig(a) === sig(b));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
