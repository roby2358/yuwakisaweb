// test/integration/uiboot.js — boot the real UI against a stub DOM (runs with the suite).
//
// Loads every script index.html loads, in order, into a vm with a fake document, canvas,
// and requestAnimationFrame, then drives the UI through clicks and keys: dismiss the intro,
// pick each card, turn the ghost, place, rotate, wait, run tick animations to completion,
// and play until a win. Catches runtime errors in rendering and input wiring without a
// browser. It can't judge how anything looks; that stays manual (U-rows).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { check, done } = require('../helpers/check');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

// A 2D context where every method is a no-op and every property is settable.
function fakeCtx() {
    return new Proxy({}, {
        get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })),
        set: (t, k, v) => { t[k] = v; return true; },
    });
}

function fakeEl(tag) {
    const el = {
        tagName: tag, children: [], style: {}, disabled: false, textContent: '', width: 0, height: 0,
        listeners: {},
        classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); } },
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        fire(type, ev = {}) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, ...ev }); },
        appendChild(c) { this.children.push(c); return c; },
        getContext: () => fakeCtx(),
        querySelector(sel) {
            this._q ||= {};
            return (this._q[sel] ||= fakeEl(sel));
        },
    };
    Object.defineProperty(el, 'innerHTML', { set() { el.children = []; el._q = {}; }, get: () => '' });
    return el;
}

const els = {};
const document = {
    getElementById: id => (els[id] ||= fakeEl(id)),
    createElement: tag => fakeEl(tag),
};
let rafQueue = [];
let clock = 0;
const windowListeners = {};
const ctx = vm.createContext({
    console, document, Math, JSON, Number, String, Array, Map, Set, Object, Proxy, parseInt, Float64Array,
    window: {
        innerWidth: 1280, innerHeight: 720,
        addEventListener: (t, fn) => (windowListeners[t] ||= []).push(fn),
    },
    performance: { now: () => clock },
    requestAnimationFrame: fn => rafQueue.push(fn),
    AudioContext: undefined,
});
// GameSound needs an AudioContext; give it a silent one.
ctx.window.AudioContext = ctx.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createPeriodicWave() { return {}; }
    createOscillator() { return { setPeriodicWave() {}, frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    resume() {}
};

let error = null;
try {
    const src = scripts.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n') +
        '\n;globalThis.__ui = ui;';
    vm.runInContext(src, ctx, { filename: 'page.js' });
} catch (e) { error = e; }
check('every script loads and the UI starts' + (error ? ': ' + error.stack : ''), !error);
if (error) done();

const ui = ctx.__ui;
const canvas = els.game;
const key = k => windowListeners.keydown.forEach(fn => fn({ key: k, shiftKey: false, preventDefault() {} }));
const clickHex = (q, r) => {
    const { x, y } = ui.hexToScreen(q, r);
    canvas.fire('mousemove', { clientX: x, clientY: y });
    canvas.fire('mousedown', { button: 0, clientX: x, clientY: y });
    windowListeners.mouseup.forEach(fn => fn({ button: 0, clientX: x, clientY: y, preventDefault() {} }));
};
// Run queued animation frames until the tick animation is finished.
const settle = () => {
    for (let i = 0; i < 500 && (rafQueue.length || ui.anim); i++) {
        clock += 50;
        const q = rafQueue; rafQueue = [];
        // Like a browser, hand rAF the frame-start time, which can be earlier than the
        // performance.now() the animation was started with.
        q.forEach(fn => fn(clock - 60));
    }
};

const run = (label, fn) => {
    try { fn(); check(label, true); } catch (e) { check(label + ': ' + e.stack, false); }
};

run('intro dismisses with Space', () => { key(' '); if (ui.overlay) throw new Error('overlay still up'); });
run('each card picks, the ghost turns, Esc puts it back', () => {
    for (const k of ['1', '2', '3']) {
        key(k);
        if (!ui.picked) throw new Error('no pick on ' + k);
        key('r');
        canvas.fire('wheel', { deltaY: 1 });
        key('Escape');
        if (ui.picked) throw new Error('Esc did not unpick');
    }
});
run('placing a Thing ticks and animates to completion', () => {
    const s = ui.state, turn = s.turn;
    key('1');
    const [k] = ui.picked.legal;
    const [q, r] = k.split(',').map(Number);
    clickHex(q, r);
    settle();
    if (s.turn !== turn + 1) throw new Error('no tick');
    if (ui.anim) throw new Error('animation never finished');
});
run('a hand card button click picks it', () => {
    const btn = els.hand.children[1];
    btn.fire('click');
    if (!ui.picked || ui.picked.slot !== 1) throw new Error('button did not pick');
    canvas.fire('mousedown', { button: 2 });
    if (ui.picked) throw new Error('right-click did not unpick');
});
run('Wait button and Enter tick', () => {
    const s = ui.state, turn = s.turn;
    els['end-turn'].fire('click'); settle();
    key('Enter'); settle();
    if (s.turn !== turn + 2) throw new Error('expected two ticks');
});
run('input is ignored mid-animation', () => {
    const s = ui.state;
    key(' ');
    const turn = s.turn;
    key(' ');   // animation still running: should do nothing
    if (s.turn !== turn) throw new Error('ticked during animation');
    settle();
});

// Play a full game through the UI: the sim bot's plan, executed with clicks.
run('a whole game plays through the UI to the victory card', () => {
    // Fresh board: earlier steps dropped random Things that this bot can't plan around.
    els['new-game'].fire('click'); key(' ');
    const s = ui.state, e = ui.engine;
    for (let i = 0; i < 2000 && !s.gameWon; i++) {
        // Lay belts toward the target along a BFS path, else wait.
        const prev = new Map([[s.source.q + ',' + s.source.r, null]]);
        const queue = [s.source];
        while (queue.length) {
            const c = queue.shift();
            for (const n of e.board.neighbors(c.q, c.r)) {
                const k = n.q + ',' + n.r;
                if (prev.has(k) || !e.board.isPassable(n)) continue;
                prev.set(k, c); queue.push(n);
            }
        }
        const pathHexes = [];
        for (let c = s.target; c; c = prev.get(c.q + ',' + c.r)) pathHexes.unshift(c);
        let acted = false;
        for (let j = 0; j < pathHexes.length - 1 && !acted; j++) {
            const a = pathHexes[j], b = pathHexes[j + 1];
            const want = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].findIndex(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
            const t = e.thingAt(a.q, a.r);
            if (t && t.facing !== null && t.facing !== want && t.kind === 'BELT') { clickHex(a.q, a.r); acted = true; break; }
            if (t) continue;
            const slot = s.hand.indexOf('BELT');
            if (slot < 0) {
                // No belt: dump card 1 somewhere off the path (Wait never changes the hand).
                const onPath = new Set(pathHexes.map(h => h.q + ',' + h.r));
                key('1');
                const spot = [...ui.picked.legal].find(k => !onPath.has(k));
                if (!spot) { key('Escape'); break; }
                clickHex(...spot.split(',').map(Number));
                acted = true;
                break;
            }
            key(String(slot + 1));
            while (ui.facing !== want) key('r');
            clickHex(a.q, a.r);
            acted = true;
        }
        if (!acted) key(' ');
        settle();
    }
    if (!s.gameWon) throw new Error('no win in 2000 commands: ' + JSON.stringify({ src: s.source, tgt: s.target, things: s.things, pieces: s.pieces.map(p => [p.kind, p.q, p.r]), d: s.delivered, turn: s.turn, hand: s.hand }));
    if (ui.overlay !== 'victory') throw new Error('no victory card');
    key(' ');
    if (ui.overlay) throw new Error('victory card did not dismiss');
    clickHex(s.source.q, s.source.r);   // view-only now: must not throw or tick
});
run('New Game resets', () => {
    els['new-game'].fire('click');
    if (ui.state.turn !== 1 || ui.overlay !== 'intro') throw new Error('not reset');
});
done();
