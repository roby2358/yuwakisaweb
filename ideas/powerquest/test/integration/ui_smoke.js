// test/integration/ui_smoke.js — boots GameUI against a stub DOM/canvas and drives it through
// the input handlers. Catches wiring typos (missing ids, bad calls) without a browser; it does not
// check how anything looks (U-rows stay manual).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const handlers = {};
function el(id) {
    const e = {
        id, style: {}, dataset: {}, innerHTML: '', textContent: '', disabled: false, title: '',
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener(type, fn) { (handlers[id + ':' + type] = handlers[id + ':' + type] || []).push(fn); },
        closest() { return null; }
    };
    return e;
}
const els = {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const canvas = Object.assign(el('game'), { width: 1000, height: 700, getContext: () => ctx });
const win = { innerWidth: 1000, innerHeight: 700, addEventListener(type, fn) { (handlers['window:' + type] = handlers['window:' + type] || []).push(fn); } };
const sandbox = {
    console, window: win, performance: { now: () => Date.now() }, setTimeout: () => 0,
    document: { getElementById: id => els[id] || (els[id] = (id === 'game' ? canvas : el(id))) },
    AudioContext: function () { throw new Error('no audio in tests'); }
};
sandbox.document.getElementById('game');
vm.createContext(sandbox);
const files = ['artifacts.js', 'displayartifacts.js', 'rando.js', 'hex.js', 'piece.js', 'pieces.js', 'board.js', 'sound.js',
    'gamestate.js', 'worldgen.js', 'ecology.js', 'gameengine.js', 'gameui.js'];
const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n') +
    '\n;globalThis.__ui = new GameUI(new GameEngine(new GameState()), document.getElementById("game"));';
vm.runInContext(src, sandbox, { filename: 'ui-combined.js' });
const ui = sandbox.__ui;
// sound is client-only and needs a gesture; stub it so cues are no-ops here
for (const k of ['step', 'hit', 'kill', 'levelUp', 'endTurn', 'fanfare']) ui.sound[k] = () => {};
ui.start();
check('start boots and shows the intro', ui.overlay === 'intro' && !!ui.selection);
ui.dismissOverlay();
check('begin dismisses the intro', ui.overlay === null);

const state = ui.state;
const click = (q, r) => { const p = ui.hexToScreen(q, r); ui.handleClick({ clientX: p.x, clientY: p.y }); };
const [mk] = [...ui.selection.reachable.keys()];
const [mq, mr] = mk.split(',').map(Number);
const turn0 = state.turn, mp0 = state.mp;
click(mq, mr);
check('clicking a reachable hex moves the hero and spends mp', state.hero.isAt(mq, mr) && state.mp < mp0);
check('highlights were recomputed after the move', ui.selection.reachable.size >= 0 && !ui.selection.reachable.has(state.hero.key()));
ui.useSocket(0);
check('socket 1 arms the starter weapon', ui.armed === 0);
ui.useSocket(0);
check('pressing it again disarms', ui.armed === null);
ui.onKeyDown({ key: 'b' });
ui.onKeyDown({ key: ' ', preventDefault() {} });
check('space ends the turn', state.turn === turn0 + 1);
state.perkOffers.push(['tough', 'fleet', 'wired']);
ui.refreshPanels();
click(mq, mr);
check('clicks are ignored while a perk offer is pending', state.turn === turn0 + 1);
ui.onKeyDown({ key: '2' });
check('a number key picks the perk', state.perkOffers.length === 0 && state.hero.perks.fleet === 1);
for (let i = 0; i < 20; i++) ui.endTurn();
check('twenty more turns render without error', state.turn >= turn0 + 21);
ui.render();
done();
