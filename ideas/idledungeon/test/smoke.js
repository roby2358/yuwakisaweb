// Smoke test: runs the engine and the real renderer against a no-op canvas for a few
// simulated minutes, plus save → load round trip, to catch runtime errors without a browser.
//   node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A canvas context where every method is a no-op and every property is settable.
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const canvas = { width: 0, height: 0, getContext: () => ctx2d, getBoundingClientRect: () => ({ width: 1200, height: 800 }) };
const sandbox = { console, Math, window: { devicePixelRatio: 2 } };
const context = vm.createContext(sandbox);
for (const f of ['rng', 'data', 'names', 'map', 'engine', 'render']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), context, { filename: f + '.js' });
}
const ID = sandbox.ID, E = ID.Engine, R = ID.Render;

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL ' + msg); } };

R.init(canvas);
let g = E.newGame(7);
for (const id of g.available.slice()) E.queue(g, id, g.purchase.length);
E.reorder(g, 'nextLevel', 0);
const seen = {};
for (let f = 0; f < 60 * 60 * 6; f++) {      // six minutes at 60 fps
  const res = E.tick(g, 1 / 60);
  for (const e of res.events) seen[e.type] = (seen[e.type] || 0) + 1;
  R.addEvents(res.events);
  R.draw(g, 1 / 60);
}
console.log('events:', JSON.stringify(seen));
check(seen.killed > 0, 'monsters were killed');
check(seen.purchased > 0, 'purchases happened');
check(g.depth >= 2, 'Next Level at the head was bought');
check(g.xp >= 0, 'xp never negative');
check(g.available.length + g.purchase.length === ID.CATALOG.length, 'every upgrade in exactly one list');

// Save → load keeps progress and credits time away at the passive rate.
const save = JSON.parse(JSON.stringify(E.serialize(g, 1000000)));
// Head the queue with Next Level and zero the XP so the 60 s credit can't buy anything.
save.purchase = ['nextLevel'].concat(save.purchase.filter(id => id !== 'nextLevel'));
save.xp = 0;
const res = E.load(save, 1000000 + 60000);
check(res.ok, 'load succeeds');
const g2 = res.game;
check(g2.depth === g.depth, 'depth restored');
check(JSON.stringify(g2.purchase) === JSON.stringify(save.purchase), 'queue order restored');
check(res.events.some(e => e.type === 'offline' && Math.abs(e.xp - E.stat(g2, 'party.xpRate') * 60) < 1e-6), 'offline XP = passive rate × 60s');
check(!E.load({ seed: 1, available: [], purchase: [] }, 0).ok, 'malformed save refused');

// Chests: a bonus is queued 2nd, survives save → load, and is spent (not requeued) when bought.
check(seen.chestOpened > 0, 'chests were opened');
const g3 = E.newGame(11);
check(g3.level.chests.length === Math.round(ID.N.CHEST_FRAC * g3.level.rooms.length), 'CHEST_FRAC of rooms start with a chest');
let opened = null;
for (let n = 0; n < 50 && !opened; n++) {
  g3.level.chests.push({ room: 0, x: g3.heroes[0].x, y: g3.heroes[0].y });
  E.step(g3);
  opened = g3.events.find(e => e.type === 'chestOpened' && e.outcome === 'bonus');
  g3.events = [];
}
check(opened && g3.purchase[1] === opened.id, 'bonus queued 2nd');
if (opened) {
  const s3 = JSON.parse(JSON.stringify(E.serialize(g3, 0)));
  s3.xp = 0;
  const r3 = E.load(s3, 0);
  check(r3.ok && r3.game.purchase.includes(opened.id), 'bonus survives save/load');
  const g4 = r3.game;
  E.reorder(g4, opened.id, 0);
  g4.xp = E.cost(g4, opened.id);
  const before = E.stat(g4, 'warrior.hp');
  E.step(g4);
  check(!g4.purchase.includes(opened.id) && !g4.available.includes(opened.id), 'bought bonus is gone');
  check(g4.boons[opened.kind] > 0, 'bonus applied');
}

// Commands refuse illegal moves.
check(!E.queue(g2, 'nope', 0).ok, 'queue unknown id refused');
check(!E.unqueue(g2, g2.available[0] || 'nope').ok, 'unqueue of non-queued refused');

console.log(failures ? `${failures} failure(s)` : 'smoke ok');
process.exit(failures ? 1 : 0);
