// UI smoke test for DIVE: loads *every* module (including gameui.js) into a vm
// sandbox with a minimal DOM/canvas/audio stub and drives a real session — start,
// dive, gather, board, market, and a stretch of turns — to catch reference errors
// in the render/HUD/market/input paths without a browser. Run from the project root:
//   node test/uismoke.js
// (For pixel-true verification, open index.html in a browser and play.)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---- Minimal DOM/canvas/audio stubs (just enough surface for gameui.js) ----
function makeElement() {
    const el = {
        textContent: '',
        innerHTML: '',
        classList: {
            add() {}, remove() {},
            toggle() {}, contains() { return false; }
        },
        addEventListener() {},
        appendChild() {},
        querySelectorAll() { return []; },
        blur() {}
    };
    return el;
}

function makeCanvas() {
    const noop = () => {};
    const ctx = {
        fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, arcTo: noop,
        closePath: noop, fill: noop, stroke: noop, arc: noop, fillText: noop
    };
    const canvas = makeElement();
    canvas.width = 0;
    canvas.height = 0;
    canvas.getContext = () => ctx;
    return canvas;
}

function makeSandbox() {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, id === 'game' ? makeCanvas() : makeElement());
            return elements.get(id);
        },
        createElement() { return makeElement(); }
    };
    const gainStub = () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
    const oscStub = () => ({ setPeriodicWave() {}, frequency: {}, connect() {}, start() {}, stop() {} });
    function AudioContext() {
        return {
            currentTime: 0, state: 'running', destination: {},
            resume() {}, createPeriodicWave() { return {}; },
            createOscillator: oscStub, createGain: gainStub
        };
    }
    const context = {
        document,
        window: { innerWidth: 1200, innerHeight: 800, addEventListener() {} },
        AudioContext,
        __elements: elements
    };
    vm.createContext(context);
    return context;
}

// ---- Load every module in page order and boot the game ----
const files = ['artifacts.js', 'displayartifacts.js', 'rando.js', 'colortheory.js',
    'hex.js', 'sound.js', 'gamestate.js', 'gameengine.js', 'gameui.js'];
const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const sandbox = makeSandbox();
vm.runInContext(src + `
this.__game = (function () {
    const state = new GameState();
    const engine = new GameEngine(state);
    const ui = new GameUI(engine, document.getElementById('game'));
    return { state, engine, ui, Hex, Rando };
})();`, sandbox);

const { state, engine, ui, Hex, Rando } = sandbox.__game;

// ---- Drive a session through the real UI methods ----
ui.start();                       // attach + newGame(+render with intro overlay)
assert.ok(state.hexes.size > 0, 'game generated');
ui.dismissOverlay();              // start of play; opens the (stubbed) AudioContext

// Select the sub and take a real move from the reachable set.
ui.selectPlayer();
assert.ok(ui.selection.reachable.size > 0, 'sub has moves');
const [firstKey] = ui.selection.reachable.keys();
const dest = Hex.fromKey(firstKey);
ui.commitMove(dest.q, dest.r);

// Dive, walk the diver onto a kelp node, gather, come back, board.
ui.doDive();
assert.ok(state.diverOut, 'diver deployed');
let kelp = null;
for (const [, hex] of state.hexes)
    if (hex.node && hex.node.material === 'glowfiber') { kelp = hex; break; }
assert.ok(kelp, 'a glowfiber node exists');
state.diver = { q: kelp.q, r: kelp.r };
engine.recomputeSight();
state.mp = 4;
ui.doGather();
assert.ok((state.bag.glowfiber || 0) > 0 || state.phase === 'player', 'gathered (or turn rolled)');
state.diver = { q: state.sub.q, r: state.sub.r };
ui.doBoard();
assert.ok(!state.diverOut, 'boarded');

// Dock and open the market; the panel HTML must actually build.
state.sub = { q: state.base.q, r: state.base.r };
state.hold = { glowfiber: 5, prismshard: 2 };
ui.openMarket();
const marketHtml = sandbox.__elements.get('market-panel').innerHTML;
assert.ok(marketHtml.includes('Berth Station'), 'market panel built');
assert.ok(marketHtml.includes('Glowfiber'), 'sell rows listed');
assert.ok(marketHtml.includes('Deepwave Beacon'), 'beacon row listed');
ui.dismissOverlay();

// Force some Attention so the predator ecology runs, then grind turns through the
// full UI path (render + HUD + toasts) watching for anything that throws.
state.upgrades.o2 = 1;
state.upgrades.fins = 1;
for (let i = 0; i < 30; i++) {
    ui.selectPlayer();
    const keys = [...ui.selection.reachable.keys()];
    if (keys.length > 0 && Rando.bool(0.7)) {
        const h = Hex.fromKey(Rando.choice(keys));
        ui.commitMove(h.q, h.r);
    } else {
        ui.doEndTurn();
    }
    ui.onMouseMove({ clientX: 400, clientY: 300 });   // hover path
}
assert.ok(state.turn > 10, 'turns advanced');
assert.ok(state.leviathans.length >= 1, 'a leviathan woke at attention 2');

// Victory path through the UI's beacon handler.
state.sub = { q: state.base.q, r: state.base.r };
state.diverOut = false;
state.credits = 300;
state.hold = { voidamber: 6, emberglass: 6, pearl: 3 };
ui.openMarket();
ui.onMarketClick({ hasAttribute: n => n === 'data-beacon', getAttribute: () => null });
assert.ok(state.gameWon, 'beacon crafted through the market UI');
ui.render();                      // victory overlay draws without error

console.log('UI smoke: all paths exercised without errors.');
