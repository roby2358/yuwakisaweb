// Boots the FULL script-tag stack (hex, data, map, game, render, ui) against a
// minimal DOM shim — catches wiring errors in render/ui that logic tests miss.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(id) {
  const el = {
    id, innerHTML: '', textContent: '', title: '', style: {}, value: '',
    focus() {},
    width: 672, height: 672,
    scrollTop: 0, scrollHeight: 0,
    children: [],
    listeners: {},
    classList: {
      set: new Set(),
      add(c) { this.set.add(c); },
      remove(c) { this.set.delete(c); },
      toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); },
      contains(c) { return this.set.has(c); },
    },
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    appendChild(child) { el.children.push(child); child.parentElement = el; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 672, height: 672 }; },
    getContext() { return ctx2dStub(); },
    fire(type, ev) { for (const fn of el.listeners[type] || []) fn(ev); },
  };
  return el;
}

function ctx2dStub() {
  return new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

function bootPage(storage) {
  const ids = ['board', 'overlay', 'overlay-text', 'overlay-btn', 'end-turn', 'new-river',
    'name-input', 'gong-count', 'tower', 'stretch', 'party', 'actions', 'inventory', 'log', 'hint'];
  const elements = {};
  for (const id of ids) elements[id] = makeElement(id);
  elements['gong-count'].parentElement = makeElement('clock-box');

  const rafQueue = [];
  const docListeners = {};
  const ctx = vm.createContext({
    console, performance,
    setTimeout, clearTimeout,
    confirm: () => true,
    requestAnimationFrame: fn => { rafQueue.push(fn); return rafQueue.length; },
    location: { reload() {} },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k),
    },
    Date, Math,
    document: {
      getElementById: id => elements[id],
      createElement: tag => makeElement(tag),
      addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
    },
  });
  for (const f of ['hex.js', 'data.js', 'map.js', 'game.js', 'render.js', 'ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  for (const fn of docListeners['DOMContentLoaded']) fn(); // UI.init
  // Fresh browsers land on the name screen; saved ones resume straight in.
  if (!ctx.Game.state()) {
    elements['name-input'].value = 'Ada of the Bank';
    elements['overlay-btn'].fire('click', {});
  }
  return { ctx, elements, rafQueue };
}

function runFrames(rafQueue, n) {
  for (let i = 0; i < n; i++) {
    const batch = rafQueue.splice(0);
    for (const fn of batch) fn(performance.now());
  }
}

test('the page boots: game created, panel rendered, frames draw', () => {
  const { ctx, elements, rafQueue } = bootPage(new Map());
  assert.ok(ctx.Game.state(), 'game exists');
  const leader = ctx.Game.byHero('burton');
  assert.strictEqual(leader.name, 'Ada of the Bank', 'the leader wears the entered name');
  assert.ok(elements['party'].children.length >= 1, 'party cards rendered');
  assert.strictEqual(elements['gong-count'].textContent, ctx.Data.CONFIG.GONG_PERIOD);
  assert.ok(elements['log'].innerHTML.includes('Tower'), 'opening line logged');
  runFrames(rafQueue, 5); // draw loop survives real state
});

test('board clicks and End Turn run without error', async () => {
  const { ctx, elements, rafQueue } = bootPage(new Map());
  runFrames(rafQueue, 2);
  elements['board'].fire('click', { clientX: 300, clientY: 400 });
  const turnBefore = ctx.Game.state().turn;
  elements['end-turn'].fire('click', {});
  await new Promise(res => setTimeout(res, 1500)); // enemy phase animations
  assert.strictEqual(ctx.Game.state().turn, turnBefore + 1, 'the clock ticked');
  runFrames(rafQueue, 5);
});

test('the river autosaves and resumes across page loads', async () => {
  const storage = new Map();
  const first = bootPage(storage);
  first.elements['end-turn'].fire('click', {});
  await new Promise(res => setTimeout(res, 1500));
  const savedTurn = first.ctx.Game.state().turn;
  const burton1 = first.ctx.Game.byHero('burton');
  assert.ok(storage.has('riverworld.save'), 'the River kept a save');

  const second = bootPage(storage); // "close the browser, come back tomorrow"
  const S2 = second.ctx.Game.state();
  assert.strictEqual(S2.turn, savedTurn, 'same turn on resume — no name screen in the way');
  const burton2 = second.ctx.Game.byHero('burton');
  assert.strictEqual(burton2.name, burton1.name, 'same pilgrim');
  assert.strictEqual(burton2.c, burton1.c);
  assert.strictEqual(burton2.r, burton1.r);
  assert.ok(second.elements['log'].innerHTML.includes('kept your place'), 'resume is announced');

  second.elements['new-river'].fire('click', {}); // confirm() stub says yes
  assert.ok(!storage.has('riverworld.save'), 'New River erases the save');
});
