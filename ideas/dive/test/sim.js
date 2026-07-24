// Headless verification for DIVE: loads the DOM-free half (artifacts, libs, state,
// engine) into a vm sandbox and checks generation, the dive loop, predator rules,
// and the market economy. Run from the project root:
//   node test/sim.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// The prototype uses plain script includes (no ES modules), so "importing" for
// tests = evaluate the files in one sandbox and pull out the globals.
// GameDisplayArtifacts is deliberately absent: the engine must never need it.
function loadModules() {
    const files = ['artifacts.js', 'rando.js', 'colortheory.js', 'hex.js',
        'gamestate.js', 'gameengine.js'];
    const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    const context = {};
    vm.createContext(context);
    vm.runInContext(src +
        '\nthis.__exports = { GameArtifacts, Rando, ColorTheory, Hex, bfsHexes,' +
        ' findPath, GameState, GameEngine };', context);
    return context.__exports;
}

const M = loadModules();
const A = M.GameArtifacts;
const T = A.TERRAIN;

function newGameEngine(seed) {
    const state = new M.GameState();
    const engine = new M.GameEngine(state);
    engine.newGame(seed);
    return engine;
}

// A tiny hand-built world for behavior tests: 10x10, all DEEP, base at (0,0),
// callers repaint terrain / place pieces per scenario.
function testWorld() {
    const state = new M.GameState();
    const hexes = new Map();
    for (let row = 0; row < 10; row++) {
        const qOffset = -Math.floor(row / 2);
        for (let col = 0; col < 10; col++) {
            const q = col + qOffset, r = row;
            hexes.set(M.Hex.key(q, r), {
                q, r, col, row, elevation: 50, isEdge: false,
                terrain: T.DEEP, node: null
            });
        }
    }
    state.hexes = hexes;
    hexes.get('0,0').terrain = T.BASE;
    state.base = { q: 0, r: 0 };
    state.sub = { q: 0, r: 0 };
    const engine = new M.GameEngine(state);
    state.o2 = engine.stat('o2');
    state.hull = engine.stat('hull');
    state.mp = A.SUB_MP;
    M.Rando.seed(1);
    return engine;
}

function hexAt(engine, q, r) {
    return engine.state.hexes.get(M.Hex.key(q, r));
}

// Structural equality across the vm-realm boundary (deepStrictEqual trips on the
// sandbox's distinct Object.prototype).
function same(actual, expected, message) {
    assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

const results = [];
function test(name, fn) {
    try {
        fn();
        results.push(['ok', name]);
    } catch (err) {
        results.push(['FAIL', name + ' — ' + err.message]);
    }
}

// ---- Generation ----

test('map generates all bands, base on shallows edge, nodes per table', () => {
    const e = newGameEngine(12345);
    const s = e.state;
    assert.strictEqual(s.hexes.size, A.MAP_COLS * A.MAP_ROWS);

    const byTerrain = {};
    for (const [, hex] of s.hexes)
        byTerrain[hex.terrain] = (byTerrain[hex.terrain] || 0) + 1;
    for (const t of [T.ROCK, T.SHALLOWS, T.REEF, T.KELP, T.DEEP, T.VENT, T.TRENCH])
        assert.ok(byTerrain[t] > 0, 'band missing: ' + t);
    assert.strictEqual(byTerrain[T.BASE], 1);

    for (const [, hex] of s.hexes) {
        if (hex.isEdge) assert.strictEqual(hex.terrain, T.ROCK, 'edge must be rock');
        if (hex.terrain === T.KELP)
            assert.strictEqual(hex.node.material, A.MATERIAL.GLOWFIBER, 'kelp always has fiber');
        if (hex.terrain === T.VENT)
            assert.strictEqual(hex.node.material, A.MATERIAL.EMBERGLASS, 'vents always have emberglass');
    }

    assert.strictEqual(hexAt(e, s.base.q, s.base.r).terrain, T.BASE);
    same(s.sub, s.base);
    assert.strictEqual(s.eels.length, A.EEL_BASE_COUNT);
    assert.strictEqual(s.eelColors.length, A.EEL_BASE_COUNT);
    assert.strictEqual(s.leviathans.length, 0);
    assert.strictEqual(s.o2, 10);
    assert.strictEqual(s.hull, 3);
    assert.strictEqual(s.mp, A.SUB_MP);
});

test('same seed reproduces the same world', () => {
    const snapshot = engine => {
        const parts = [];
        for (const [key, hex] of engine.state.hexes)
            parts.push(key, hex.terrain, hex.node ? hex.node.material + hex.node.amount : '-');
        return parts.join('|') + '#' + JSON.stringify(engine.state.eels);
    };
    assert.strictEqual(snapshot(newGameEngine(999)), snapshot(newGameEngine(999)));
});

test('diver can reach trench and vents from base (band gating is O2, not walls)', () => {
    const e = newGameEngine(4242);
    assert.ok(e.bandsReachable());
});

// ---- Dive loop: exit, drain, gather, board ----

test('dive/board cycle: O2 full on exit, MP capped to fins, bag empties to hold', () => {
    const e = testWorld();
    const s = e.state;
    assert.ok(e.dive().ok);
    assert.ok(s.diverOut);
    assert.strictEqual(s.o2, 10);
    assert.strictEqual(s.mp, e.stat('fins'));

    s.bag = { glowfiber: 3 };
    assert.ok(e.board().ok);
    assert.ok(!s.diverOut);
    same(s.hold, { glowfiber: 3 });
    same(s.bag, {});
});

test('O2 drains by band; base hex refills for free', () => {
    const e = testWorld();
    const s = e.state;
    e.dive();
    e.endTurn();                          // on BASE: drain 0, refill
    assert.strictEqual(s.o2, 10);

    s.diver = { q: 3, r: 3 };             // DEEP: drain 2
    e.endTurn();
    assert.strictEqual(s.o2, 8);

    hexAt(e, 3, 3).terrain = T.TRENCH;    // TRENCH: drain 3
    e.endTurn();
    assert.strictEqual(s.o2, 5);
});

test('gather pulls one unit for 2 MP and depletes the node', () => {
    const e = testWorld();
    const s = e.state;
    hexAt(e, 2, 2).terrain = T.KELP;
    hexAt(e, 2, 2).node = { material: A.MATERIAL.GLOWFIBER, amount: 2 };
    e.dive();
    s.diver = { q: 2, r: 2 };
    s.mp = 4;

    assert.ok(e.canGather());
    assert.ok(e.gather().ok);
    same(s.bag, { glowfiber: 1 });
    assert.strictEqual(s.mp, 2);
    assert.strictEqual(hexAt(e, 2, 2).node.amount, 1);

    const res = e.gather();               // spends the last MP -> auto end turn
    assert.ok(res.ok && res.endedTurn);
    assert.strictEqual(hexAt(e, 2, 2).node, null);   // depleted kelp loses cover too
});

test('blackout drops the bag as a cache, rescues to sub, charges the fee', () => {
    const e = testWorld();
    const s = e.state;
    e.dive();
    s.diver = { q: 4, r: 4 };
    s.bag = { emberglass: 2 };
    s.o2 = 2;                             // DEEP drains 2 -> 0 -> blackout
    s.credits = 20;

    const events = e.endTurn();
    assert.ok(events.some(ev => ev.type === 'blackout'));
    assert.ok(!s.diverOut);
    assert.strictEqual(s.o2, 10);
    assert.strictEqual(s.credits, 20 - A.RESCUE_FEE);
    same(s.caches, [{ q: 4, r: 4, contents: { emberglass: 2 } }]);
    same(s.bag, {});
});

test('scoop recovers a cache into the bag', () => {
    const e = testWorld();
    const s = e.state;
    s.caches = [{ q: 2, r: 1, contents: { voidamber: 2 } }];
    e.dive();
    s.diver = { q: 2, r: 1 };
    assert.ok(e.canScoop());
    assert.ok(e.scoop().ok);
    same(s.bag, { voidamber: 2 });
    assert.strictEqual(s.caches.length, 0);
});

// ---- Predators ----

test('an eel that senses the diver chases and mauls; the eel guards the cache', () => {
    const e = testWorld();
    const s = e.state;
    e.dive();
    s.diver = { q: 5, r: 5 };
    s.bag = { prismshard: 1 };
    s.eels = [{ q: 7, r: 5, speed: 3 }];  // dist 2, open water
    s.eelColors = ['#ffffff'];

    const events = e.endTurn();
    assert.ok(events.some(ev => ev.type === 'maul'));
    assert.ok(!s.diverOut);
    same(s.eels[0], { q: 5, r: 5, speed: 3 });
    same(s.caches, [{ q: 5, r: 5, contents: { prismshard: 1 } }]);
});

test('kelp with standing fiber hides the diver from eels', () => {
    const e = testWorld();
    const s = e.state;
    hexAt(e, 5, 5).terrain = T.KELP;
    hexAt(e, 5, 5).node = { material: A.MATERIAL.GLOWFIBER, amount: 1 };
    e.dive();
    s.diver = { q: 5, r: 5 };
    const eel = { q: 6, r: 5, speed: 1 };
    assert.ok(!e.eelCanSense(eel), 'hidden in kelp');

    hexAt(e, 5, 5).node = null;           // stripped kelp is no cover
    assert.ok(e.eelCanSense(eel), 'exposed once fiber is gone');
});

test('leviathan hears only a moving sub, closes, bites; hull 0 wrecks the hold', () => {
    const e = testWorld();
    const s = e.state;
    s.sub = { q: 5, r: 5 };
    s.hold = { voidamber: 3 };
    s.hull = 1;
    s.leviathans = [{ q: 5, r: 8, name: 'Test Shadow' }];   // dist 3

    s.subMoved = false;                   // parked and silent: no chase from dist 3
    M.Rando.seed(7);
    e.endTurn();
    assert.ok(new M.Hex(5, 5).distance(new M.Hex(s.leviathans[0].q, s.leviathans[0].r)) >= 2,
        'silent sub not approached from afar');

    s.leviathans = [{ q: 5, r: 8, name: 'Test Shadow' }];
    s.subMoved = true;                    // engine wake: chase, stop adjacent, bite
    const events = e.endTurn();
    assert.ok(events.some(ev => ev.type === 'bite'));
    assert.ok(events.some(ev => ev.type === 'wreck'));
    same(s.sub, s.base, 'tender refloats the sub at base');
    assert.strictEqual(s.hull, e.stat('hull'));
    same(s.hold, {});
    same(s.caches, [{ q: 5, r: 5, contents: { voidamber: 3 } }]);
});

test('leviathans wake as attention crosses thresholds', () => {
    const e = newGameEngine(777);
    const s = e.state;
    s.upgrades.o2 = 1;
    s.upgrades.fins = 1;                  // attention 2 -> first threshold
    const events = e.endTurn();
    assert.strictEqual(s.leviathans.length, 1);
    assert.ok(events.some(ev => ev.type === 'wake'));
    assert.strictEqual(hexAt(e, s.leviathans[0].q, s.leviathans[0].r).terrain, T.TRENCH);
});

// ---- Market ----

test('sell and craft: prices, tier bump, materials consumed, docked-only', () => {
    const e = testWorld();
    const s = e.state;
    assert.ok(e.isDocked());
    s.hold = { glowfiber: 10 };
    assert.ok(e.sell('glowfiber').ok);
    assert.strictEqual(s.credits, 20);
    same(s.hold, {});

    s.credits = 100;
    s.hold = { glowfiber: 4 };
    assert.ok(e.canCraft('o2'));
    assert.ok(e.craft('o2').ok);
    assert.strictEqual(s.upgrades.o2, 1);
    assert.strictEqual(e.stat('o2'), 14);
    assert.strictEqual(s.o2, 14);
    assert.strictEqual(s.credits, 80);
    same(s.hold, {});
    assert.strictEqual(e.attention(), 1);

    s.sub = { q: 3, r: 3 };               // undocked: market is closed
    assert.ok(!e.sell('glowfiber').ok);
    assert.ok(!e.canCraft('o2'));
});

test('the Deepwave Beacon wins the game', () => {
    const e = testWorld();
    const s = e.state;
    s.credits = 300;
    s.hold = { voidamber: 6, emberglass: 6, pearl: 3 };
    assert.ok(e.canCraftBeacon());
    assert.ok(e.craftBeacon().won);
    assert.ok(s.gameWon);
    assert.strictEqual(s.credits, 50);
});

test('reachability: predator hexes are walls, movement is mode-aware', () => {
    const e = testWorld();
    const s = e.state;
    s.sub = { q: 5, r: 5 };
    s.eels = [{ q: 6, r: 5, speed: 1 }];
    s.mp = 2;
    const reachable = e.computeReachable();
    assert.ok(!reachable.has('6,5'), 'eel hex is a wall');
    assert.ok(reachable.has('4,5'));
    assert.ok(!e.movePlayer(9, 9).ok, 'far hex rejected');
    assert.ok(e.movePlayer(4, 5).ok);
    assert.ok(s.subMoved, 'sub move raises engine wake');
});

// ---- Report ----
let failed = 0;
for (const [status, name] of results) {
    if (status === 'FAIL') failed++;
    console.log(`  ${status === 'ok' ? '✓' : '✗'} ${name}`);
}
console.log(failed === 0
    ? `\nAll ${results.length} checks passed.`
    : `\n${failed}/${results.length} checks FAILED.`);
process.exit(failed === 0 ? 0 : 1);
