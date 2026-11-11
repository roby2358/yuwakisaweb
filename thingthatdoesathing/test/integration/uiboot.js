// test/integration/uiboot.js — boot the real UI against a stub DOM (runs with the suite).
//
// Loads every script index.html loads, in order, into a vm with a fake document, canvas,
// and requestAnimationFrame, then drives the UI through clicks and keys: pick a board size
// from the intro, pick each card, turn the ghost, place, select and rotate, wait, run tick animations to completion,
// and play to the first milestone. Catches runtime errors in rendering and input wiring without a
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
// The page rolls each board's seed with Math.random; seed that too, so every run plays the
// same boards and the whole-game check below can't flake on an unlucky one.
const UI_RANDOM_SEED = 1;   // any seed whose boards the simple bot below can win
let rnd = UI_RANDOM_SEED >>> 0;
const seededMath = Object.create(Math, { random: { value: () => {   // mulberry32
    rnd = (rnd + 0x6D2B79F5) >>> 0;
    let t = rnd;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
} } });
// setTimeout runs on the same fake clock: a timer fires once `clock` passes its due time.
let timers = [];
let timerId = 0;
const fakeSetTimeout = (fn, ms) => { timers.push({ id: ++timerId, due: clock + ms, fn }); return timerId; };
const fakeClearTimeout = id => { timers = timers.filter(t => t.id !== id); };
const fireDueTimers = () => {
    const due = timers.filter(t => t.due <= clock);
    timers = timers.filter(t => t.due > clock);
    due.forEach(t => t.fn());
};
const windowListeners = {};
const ctx = vm.createContext({
    console, document, Math: seededMath, JSON, Number, String, Array, Map, Set, Object, Proxy, parseInt, Float64Array,
    window: {
        innerWidth: 1280, innerHeight: 720,
        addEventListener: (t, fn) => (windowListeners[t] ||= []).push(fn),
    },
    performance: { now: () => clock },
    requestAnimationFrame: fn => rafQueue.push(fn),
    setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
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
// Advance the clock `ms`, firing animation frames and timers as a browser would.
const advance = ms => {
    for (let t = 0; t < ms; t += 50) {
        clock += 50;
        const q = rafQueue; rafQueue = [];
        q.forEach(fn => fn(clock - 60));
        fireDueTimers();
    }
};

const run = (label, fn) => {
    try { fn(); check(label, true); } catch (e) { check(label + ': ' + e.stack, false); }
};

run('the intro waits for a size: no board, and clicks and Space do nothing', () => {
    if (ui.overlay !== 'intro' || ui.state.hexes) throw new Error('expected the intro and no board');
    canvas.fire('mousedown', { button: 0, clientX: 10, clientY: 10 });
    windowListeners.mouseup.forEach(fn => fn({ button: 0, clientX: 10, clientY: 10, preventDefault() {} }));
    key(' '); key('Escape');
    if (ui.overlay !== 'intro') throw new Error('the intro closed without a size');
});
run('a size from the intro opens the keys legend; any key closes it', () => {
    key('1');
    if (!ui.state.hexes || ui.overlay !== 'help' || els['help-panel'].classList.set.has('hidden'))
        throw new Error('the first game must open on the keys legend');
    key('2');
    if (ui.overlay || ui.picked || !els['help-panel'].classList.set.has('hidden'))
        throw new Error('a key must close the legend and do nothing else');
});
run('every size button builds its board; key 1 picks the first size', () => {
    const sizes = vm.runInContext('GameArtifacts.MAP_SIZES', ctx);
    const keys = Object.keys(sizes);
    if (els['intro-sizes'].children.length !== keys.length || els['new-sizes'].children.length !== keys.length)
        throw new Error('one button per size in each picker');
    keys.forEach((size, i) => {
        els['new-sizes'].children[i].fire('click');
        const { cols, rows } = sizes[size];
        if (ui.overlay || ui.state.size !== size || ui.state.hexes.size !== cols * rows) throw new Error('bad board for ' + size);
        ui.render();
        els['new-game'].fire('click');
        if (ui.overlay !== 'size') throw new Error('New Game did not open the size picker');
    });
    key('Escape');
    if (ui.overlay) throw new Error('Esc did not go back to the game');
    els['new-game'].fire('click'); key('1');
    if (ui.overlay || ui.state.size !== keys[0]) throw new Error('key 1 did not start a ' + keys[0] + ' game');
});
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
run('D removes the hovered Thing and ticks', () => {
    const s = ui.state, turn = s.turn;
    const t = s.things[s.things.length - 1];
    const { x, y } = ui.hexToScreen(t.q, t.r);
    canvas.fire('mousemove', { clientX: x, clientY: y });
    key('d');
    settle();
    if (ui.engine.thingAt(t.q, t.r)) throw new Error('Thing still there');
    if (s.turn !== turn + 1) throw new Error('no tick');
});
run('a hand card button click picks it', () => {
    const btn = els.cards.children[1];
    btn.fire('click');
    if (!ui.picked || ui.picked.slot !== 1) throw new Error('button did not pick');
    canvas.fire('mousedown', { button: 2 });
    if (ui.picked) throw new Error('right-click did not unpick');
});
run('Wait button ticks', () => {
    const s = ui.state, turn = s.turn;
    els['end-turn'].fire('click'); settle();
    if (s.turn !== turn + 1) throw new Error('expected one tick');
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
run('the Discard spot throws away the picked card and ticks; X does too', () => {
    const s = ui.state;
    const things = s.things.length;
    let turn = s.turn;
    els.discard.fire('click');
    if (s.turn !== turn) throw new Error('Discard with no card picked must do nothing');
    key('2');
    if (!els.discard.classList.set.has('armed')) throw new Error('Discard not armed while a card is picked');
    els.discard.fire('click');
    if (s.turn !== turn + 1 || ui.picked || s.things.length !== things) throw new Error('Discard click did not discard');
    settle();
    turn = s.turn;
    key('1'); key('x');
    if (s.turn !== turn + 1 || ui.picked) throw new Error('X did not discard');
    settle();
});
run('a Rocket card draws, places, and its flight and splat animate', () => {
    const s = ui.state;
    s.hand[0] = { kind: 'ROCKET', color: 'white' };
    ui.render();
    key('1');
    const [k] = [...ui.picked.legal];
    clickHex(...k.split(',').map(Number));
    if (!s.things.some(t => t.kind === 'ROCKET')) throw new Error('Rocket not placed');
    settle();
    // Hand-feed an animation with a flight that splats a gremlin, as the engine reports it.
    const crate = s.pieces.find(p => p.kind === 'crate');
    const gremlin = s.pieces.find(p => p.kind === 'gremlin');
    if (crate && gremlin) {
        const before = new Map([crate, gremlin].map(p => [p.id, { q: p.q, r: p.r, color: p.color, label: p.label, kind: p.kind }]));
        ui.startAnim(before, { events: [
            { type: 'move', id: crate.id, path: [{ q: crate.q + 1, r: crate.r }, { q: crate.q + 2, r: crate.r }] },
            { type: 'splat', id: gremlin.id, by: crate.id, trap: false },
        ] });
        if (ui.anim.tracks.get(gremlin.id).pts.length !== 3) throw new Error('the hit gremlin must wait for the flier');
        settle();
    }
});
run('a Trap card places, and the tally shows ex-gremlins and trapped', () => {
    const s = ui.state;
    s.hand[0] = { kind: 'TRAP', color: 'white' };
    ui.render();
    key('1');
    const [k] = [...ui.picked.legal];
    clickHex(...k.split(',').map(Number));
    if (!s.things.some(t => t.kind === 'TRAP')) throw new Error('Trap not placed');
    settle();
    s.exGremlins = 7;
    s.trapped = 4;
    ui.updateHUD();
    if (String(els['ex-info'].textContent) !== '7') throw new Error('Ex-gremlins not in the tally');
    if (String(els['trap-info'].textContent) !== '4') throw new Error('Trapped not in the tally');
});
run('a game plays through the UI to the first milestone banner', () => {
    // Fresh board: earlier steps dropped random Things that this bot can't plan around.
    els['new-game'].fire('click'); key('1');
    const s = ui.state, e = ui.engine;
    const goal = vm.runInContext('GameArtifacts.FIRST_MILESTONE', ctx);
    for (let i = 0; i < 2000 && s.delivered < goal; i++) {
        // Lay belts toward the target along a BFS path, else wait.
        const prev = new Map([[s.sources[0].q + ',' + s.sources[0].r, null]]);
        const queue = [s.sources[0]];
        while (queue.length) {
            const c = queue.shift();
            for (const n of e.board.neighbors(c.q, c.r)) {
                const k = n.q + ',' + n.r;
                if (prev.has(k) || !e.board.isPassable(n)) continue;
                prev.set(k, c); queue.push(n);
            }
        }
        const pathHexes = [];
        for (let c = s.targets[0]; c; c = prev.get(c.q + ',' + c.r)) pathHexes.unshift(c);
        let acted = false;
        for (let j = 0; j < pathHexes.length - 1 && !acted; j++) {
            const a = pathHexes[j], b = pathHexes[j + 1];
            const want = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].findIndex(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
            const t = e.thingAt(a.q, a.r);
            if (t && t.facing !== null && t.facing !== want && t.kind === 'BELT') { clickHex(a.q, a.r); acted = true; break; }
            if (t) continue;
            const slot = s.hand.findIndex(card => card.kind === 'BELT');
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
    if (s.delivered < goal) throw new Error('no milestone in 2000 commands: ' + JSON.stringify({ src: s.sources, tgt: s.targets, things: s.things, pieces: s.pieces.map(p => [p.kind, p.q, p.r]), d: s.delivered, turn: s.turn, hand: s.hand }));
    const banner = els.milestone.classList.set;
    if (banner.has('hidden') || els['milestone-title'].textContent !== 'IT DOES THE THING') throw new Error('no milestone banner');
    // The small board's first milestone unlocks the Slide (R-49): the news panel names it.
    if (ui.overlay !== 'news' || !els['news-title'].textContent.startsWith('New card'))
        throw new Error('no new-card panel: ' + ui.overlay + ' ' + els['news-title'].textContent);
    key('Escape');
    if (ui.overlay) throw new Error('a key must close the new-card panel');
    const turn = s.turn;
    key(' '); settle();
    if (s.turn !== turn + 1) throw new Error('play did not go on past the milestone');
    advance(4000);
    if (!banner.has('hidden')) throw new Error('banner never hid');
});
run('Go ticks on its own, holds while a card is picked, and Pause stops it', () => {
    els['new-game'].fire('click'); key('1');
    const s = ui.state;
    els.go.fire('click');
    if (els.go.textContent !== 'Pause') throw new Error('button did not flip to Pause');
    advance(3000);
    const ran = s.turn;
    if (ran < 4) throw new Error('only reached turn ' + ran);
    key('1');
    settle(); advance(1000);
    const held = s.turn;
    advance(1000);
    if (s.turn !== held) throw new Error('ticked while a card was picked');
    key('Escape');
    advance(1000);
    if (s.turn === held) throw new Error('did not resume after the card went back');
    els.go.fire('click');
    settle();
    const paused = s.turn;
    advance(2000);
    if (s.turn !== paused || els.go.textContent !== 'Go') throw new Error('Pause did not stop it');
});
run('Enter toggles Go: on, then off once the tick in flight finishes', () => {
    const s = ui.state;
    key('Enter');
    if (!ui.running || els.go.textContent !== 'Pause') throw new Error('Enter did not start Go');
    advance(2000);
    if (s.turn < 2) throw new Error('Go via Enter did not tick');
    const t = s.turn;
    key('Enter');
    if (ui.running || els.go.textContent !== 'Go') throw new Error('Enter did not stop Go');
    settle(); advance(2000);
    if (s.turn !== t) throw new Error('ticked again after Enter stopped Go');
});
run('Help shows the keys and holds Go; closing it lets Go pick up again', () => {
    els['new-game'].fire('click'); key('1');
    const s = ui.state;
    els.go.fire('click');
    advance(1000);
    els.help.fire('click');
    if (ui.overlay !== 'help' || els['help-panel'].classList.set.has('hidden')) throw new Error('Help did not show the keys');
    settle(); advance(500);
    const held = s.turn;
    advance(2000);
    if (s.turn !== held) throw new Error('ticked while Help was open');
    els['help-panel'].fire('click');
    if (ui.overlay) throw new Error('a click must close Help');
    advance(1000);
    if (s.turn === held || !ui.running) throw new Error('Go did not pick up after Help closed');
    els.go.fire('click'); settle();
});
run('Space while Go runs finishes the tick in flight, then stops', () => {
    els['new-game'].fire('click'); key('1');
    const s = ui.state;
    els.go.fire('click');
    advance(1000);
    for (let i = 0; i < 40 && !ui.anim; i++) advance(50);   // catch a tick mid-animation
    const t = s.turn;
    if (!ui.anim) throw new Error('expected a tick in flight');
    key(' ');
    if (els.go.textContent !== 'Go' || ui.running) throw new Error('Space did not turn Go off');
    settle(); advance(2000);
    if (s.turn !== t) throw new Error('ticked again after Space stopped Go');
    key(' '); settle(); advance(2000);
    if (s.turn !== t + 1) throw new Error('Space with Go off must do exactly one tick');
});
run('a click selects a hex and holds Go; a second click turns its mover; a click elsewhere lets go', () => {
    els['new-game'].fire('click'); key('1');
    const s = ui.state;
    s.hand[0] = { kind: 'BELT', color: vm.runInContext('GameArtifacts.WHITE', ctx) };
    key('1');
    const [k] = ui.picked.legal;
    const [q, r] = k.split(',').map(Number);
    clickHex(q, r); settle();
    const belt = ui.engine.thingAt(q, r);
    if (!belt) throw new Error('belt not placed');
    els.go.fire('click');
    advance(1000);
    clickHex(q, r);
    if (!ui.selected || ui.selected.q !== q || ui.selected.r !== r) throw new Error('click did not select');
    const facing = belt.facing;
    if (ui.engine.thingAt(q, r).facing !== facing) throw new Error('the first click must not turn it');
    settle(); advance(1000);
    const held = s.turn;
    advance(2000);
    if (s.turn !== held) throw new Error('ticked while a hex was selected');
    clickHex(q, r);
    if (ui.engine.thingAt(q, r).facing === facing) throw new Error('the second click did not turn it');
    if (s.turn !== held) throw new Error('turning must not tick');
    const other = [...s.hexes.values()].find(h => h.q !== q || h.r !== r);
    clickHex(other.q, other.r);
    if (ui.selected) throw new Error('a click elsewhere did not deselect');
    advance(1000);
    if (s.turn === held) throw new Error('Go did not resume after deselecting');
    els.go.fire('click'); settle();
});
run('a newly opened color or unlocked card shows a panel that holds Go until a click or any key', () => {
    const s = ui.state;
    const opened = () => ui.startAnim(new Map(), { events: [{ type: 'open', color: 'red', source: s.sources[0], target: s.targets[0] }] });
    els.go.fire('click');
    settle();
    opened(); settle();
    if (ui.overlay !== 'news' || els['news-panel'].classList.set.has('hidden')) throw new Error('no new-color panel');
    if (els['news-title'].textContent !== 'Red crates!') throw new Error('panel title: ' + els['news-title'].textContent);
    const held = s.turn;
    advance(2000);
    if (s.turn !== held) throw new Error('Go ticked behind the panel');
    key('1');
    if (ui.overlay || ui.picked) throw new Error('a key must close the panel and do nothing else');
    advance(1000);
    if (s.turn === held) throw new Error('Go did not resume after the panel closed');
    els.go.fire('click'); settle();
    opened(); settle();
    els['news-panel'].fire('click');
    if (ui.overlay || !els['news-panel'].classList.set.has('hidden')) throw new Error('a click must close the panel');
    // A color and cards at once (a medium board's first milestone): one panel names both.
    ui.startAnim(new Map(), { events: [{ type: 'open', color: 'red', source: s.sources[0], target: s.targets[0] },
        { type: 'unlock', kinds: ['PUSHER', 'PULLER'] }] });
    settle();
    if (ui.overlay !== 'news' || els['news-title'].textContent !== 'Red crates!' || !/Pusher.*Puller/.test(els['news-sub'].textContent))
        throw new Error('color + cards panel: ' + els['news-title'].textContent + ' / ' + els['news-sub'].textContent);
    key('x');
    ui.startAnim(new Map(), { events: [{ type: 'unlock', kinds: ['SLIDE'] }] });
    settle();
    if (ui.overlay !== 'news' || els['news-title'].textContent !== 'New card: Slide') throw new Error('card panel: ' + els['news-title'].textContent);
    els['news-panel'].fire('click');
    if (ui.overlay) throw new Error('a click must close the card panel');
});
run('New Game asks for a size, then resets', () => {
    key(' '); settle();
    els['new-game'].fire('click');
    if (ui.overlay !== 'size' || ui.state.turn === 1) throw new Error('the picker must not reset the game yet');
    key('2');
    if (ui.state.turn !== 1 || ui.overlay) throw new Error('not reset');
});
done();
