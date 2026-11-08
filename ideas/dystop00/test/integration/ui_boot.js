// test/integration/ui_boot.js — boots the real GameUI under a minimal DOM/canvas stub and
// drives it through the boot overlays, a select-move, a plant, a few animated turns, and
// hover previews. Catches runtime errors in gameui.js / sound.js wiring; it does not check
// what anything looks like (that's the U-rows, by hand).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('../helpers/load');
const { check, done } = require('../helpers/check');

// ---- the stub ----
const noop = () => {};
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
function el(id) {
    return {
        id, width: 300, height: 150, textContent: '', innerHTML: '', className: '', disabled: false, style: {},
        children: [],
        classList: { toggle: noop, add: noop, remove: noop },
        appendChild(c) { this.children.push(c); },
        addEventListener(type, fn) { (this.listeners ||= {})[type] = fn; },
        getContext: () => ctx2d,
    };
}
const els = new Map();
const document = {
    getElementById: id => { if (!els.has(id)) els.set(id, el(id)); return els.get(id); },
    createElement: tag => el(tag),
};
const winListeners = {};
let now = 0;
const timers = [];
const live = new Set();
let intervalId = 0;
const sandbox = {
    console, document, Math, JSON, Map, Set, Array, Object, Number, String, Float64Array, Uint8Array,
    window: { innerWidth: 1280, innerHeight: 800, addEventListener: (t, f) => { winListeners[t] = f; } },
    performance: { now: () => now },
    requestAnimationFrame: fn => timers.push(fn),
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    setInterval: (fn) => { const id = ++intervalId; const tick = () => { if (live.has(id)) { fn(); timers.push(tick); } }; live.add(id); timers.push(tick); return id; },
    clearInterval: id => live.delete(id),
    AudioContext: function () {
        const node = () => ({ connect: noop, start: noop, stop: noop, setPeriodicWave: noop, frequency: {}, gain: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop }, type: '' });
        return { state: 'running', currentTime: 0, sampleRate: 8000, destination: {}, resume: noop,
            createPeriodicWave: () => ({}), createOscillator: node, createGain: node, createBiquadFilter: node,
            createBufferSource: () => ({ ...node(), buffer: null }),
            createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }) };
    },
    Float32Array,
};
vm.createContext(sandbox);
const order = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<script src="([^"]+)"/g).map(s => s.slice(13, -1));
const src = order.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n') + '\n;this.__ui = ui; this.__Hex = Hex;';
let err = null;
try { vm.runInContext(src, sandbox, { filename: 'page.js' }); } catch (e) { err = e; }
check('page scripts load and ui.start() runs', !err);
if (err) { console.log(err.stack); done(); }

const ui = sandbox.__ui, Hex = sandbox.__Hex, s = ui.state;
// Run queued timers/frames, advancing the clock so animations finish.
function flush(rounds = 400) {
    for (let i = 0; i < rounds && timers.length; i++) { now += 50; const fn = timers.shift(); fn(); }
}
const key = k => winListeners.keydown({ key: k, preventDefault: noop });
const click = (q, r) => {
    const p = ui.hexToScreen(q, r);
    ui.onMouseDown({ button: 0, clientX: p.x, clientY: p.y, preventDefault: noop });
    ui.onMouseUp({ button: 0, clientX: p.x, clientY: p.y });
};
try {
    check('starts on INSERT DISK', ui.overlay === 'insert');
    key('x'); flush(60);
    check('boot runs into the title card', ui.overlay === 'title');
    key(' ');
    check('title dismissed: in play', ui.overlay === null);
    click(s.player.q, s.player.r);
    check('clicking @ selects', !!ui.selection && ui.selection.reachable.size > 0);
    const [k1] = [...ui.selection.reachable].find(([, c]) => c <= 2);
    const { q, r } = Hex.fromKey(k1);
    ui.hoveredHex = { q, r }; ui.render();
    click(q, r);
    check('clicking a yellow hex moves @', s.player.isAt(q, r));
    key('t');
    check('T plants', s.rigs[0].status === 'planted');
    for (let i = 0; i < 6 && !s.outcome; i++) { key(' '); flush(); }
    check('turns animate and finish', ui.anim === null && (s.turn > 1 || s.outcome));
    ui.onMouseMove({ clientX: 400, clientY: 300 });
    ui.render();
    check('no errors through play', true);
} catch (e) { console.log(e.stack); check('no errors through play', false); }
done();
