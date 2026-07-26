// Browser-order smoke test: loads content.js + engine.js as classic scripts in
// one shared context (catches global name collisions that Node require hides),
// runs the engine, and exercises every shop item.
// ui.js / index.js are syntax-checked only (they need a real DOM).
// Run: node test/smoke.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures++; console.log('  FAIL ' + msg); }
}

// 1. classic-script load order, shared global scope like a browser
const ctxObj = {};
const ctx = vm.createContext(ctxObj);
for (const f of ['flourish.js', 'content.js', 'memos.js', 'engine.js', 'guru.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
assert(typeof ctxObj.Content === 'object' || vm.runInContext('typeof Content', ctx) === 'object',
  'content.js defines Content as a shared global');
assert(vm.runInContext('typeof Engine', ctx) === 'object', 'engine.js defines Engine');

// 2. engine runs and every shop item is buyable without throwing
const result = vm.runInContext(`
  (() => {
    const s = Engine.createState(42);
    for (let i = 0; i < 600; i++) Engine.tick(s);
    s.cash = 1e9;
    const bought = [];
    for (const item of Content.SHOP) {
      const res = Engine.buy(s, item.key);
      bought.push(item.key + ':' + res.ok);
    }
    for (let i = 0; i < 600; i++) Engine.tick(s);
    return { t: s.t, served: s.report.servedRps, bought: bought.join(' '), outcome: s.outcome };
  })()
`, ctx);
console.log('  after 120s + full build-out: served=' + result.served.toFixed(0) + ' rps, ' + result.bought);
assert(result.t > 119, 'engine advances time');
assert(result.served > 0, 'requests are served');
assert(!result.bought.includes('false'), 'every shop item purchasable once affordable');

// 3. the mix bar's display classes must exactly partition demand (they are
// drawn as proportional widths, so any drift shows up as a wrong-looking bar)
const mixCheck = vm.runInContext(`
  (() => {
    const s = Engine.createState(3);
    for (let i = 0; i < 50; i++) Engine.tick(s);
    const r = s.report;
    const live = {};
    for (const k of Content.TYPE_KEYS) live[k] = r.perType[k].demand / r.demandRps;
    const total = Content.MIX_CLASSES.reduce((a, c) => a + c.share(s, live), 0);
    return { total, n: Content.MIX_CLASSES.length };
  })()
`, ctx);
assert(Math.abs(mixCheck.total - 1) < 1e-9,
  `mix classes partition 100% of demand (${mixCheck.n} classes, sum=${mixCheck.total.toFixed(6)})`);

// 4. every statically-referenced DOM id must exist in index.html
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const js = fs.readFileSync(path.join(root, 'ui.js'), 'utf8') +
  fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const dynamicIds = new Set(['legend-scale']); // created by buildLegend innerHTML
const refs = new Set([...js.matchAll(/(?:\$\(|getElementById\()'([a-z0-9-]+)'\)/gi)].map(m => m[1]));
const missing = [...refs].filter(id => !htmlIds.has(id) && !dynamicIds.has(id));
assert(missing.length === 0, 'all referenced DOM ids exist in index.html' +
  (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));

// 5. every subsystem's costs are reachable and scale-down restores them
const costCheck = vm.runInContext(`
  (() => {
    const s = Engine.createState(4);
    for (let i = 0; i < 30; i++) Engine.tick(s);
    s.cash = 1e9;
    for (const item of Content.SHOP) Engine.buy(s, item.key);
    Engine.tick(s);
    const full = Engine.costTotals(s);
    const restored = [];
    for (const item of Content.SHOP) {
      if (!item.canScaleDown(s)) continue;
      const before = Engine.expenses(s);
      Engine.scaleDown(s, item.key);
      restored.push({ key: item.key, saved: before - Engine.expenses(s) });
    }
    return {
      fixed: full.fixed, marginal: full.marginal, parts: full.parts.length,
      restored, negative: restored.filter(x => x.saved <= 0).map(x => x.key),
    };
  })()
`, ctx);
assert(costCheck.fixed > 0 && costCheck.marginal > 0,
  `run-rate splits into fixed ($${costCheck.fixed.toFixed(1)}/s) and marginal ($${costCheck.marginal.toFixed(1)}/s)`);
assert(costCheck.parts === 9, 'money bar has one segment per shop item');
assert(costCheck.negative.length === 0,
  'every scale-down lowers the run-rate' +
  (costCheck.negative.length ? ' (failed: ' + costCheck.negative.join(', ') + ')' : ''));

// 6. management memos: decks are deep enough, and Flourish exhausts every
// variant before repeating any (the joke dies on an immediate repeat)
const memoCheck = vm.runInContext(`
  (() => {
    const keys = Content.MEMO_KEYS;
    const thin = keys.filter(k => Content.MEMOS[k].barbs.length < 5);
    let combos = 0;
    for (const k of keys) {
      const m = Content.MEMOS[k];
      combos += m.barbs.length * m.subjects.length * Content.MEMO_SENDERS.length;
    }
    // draw a full cycle out of one deck and check for duplicates
    const deck = new Flourish(Content.MEMOS[keys[0]].barbs);
    const n = deck.size();
    const seen = new Set();
    for (let i = 0; i < n; i++) seen.add(deck.draw((i * 7919 % 1000) / 1000));
    return { keys: keys.length, thin, combos, cycle: n, unique: seen.size };
  })()
`, ctx);
assert(memoCheck.thin.length === 0,
  `every memo has a deep enough deck (${memoCheck.keys} memos, ~${memoCheck.combos} distinct panels)` +
  (memoCheck.thin.length ? ' — thin: ' + memoCheck.thin.join(', ') : ''));
assert(memoCheck.unique === memoCheck.cycle,
  `Flourish draws all ${memoCheck.cycle} variants before repeating any`);

// memo checks must survive being called against a live report
const memoRun = vm.runInContext(`
  (() => {
    const s = Engine.createState(21);
    const fired = {};
    for (let i = 0; i < 4000; i++) {
      Engine.tick(s);
      if (i === 300) { s.cash = 1e6; Engine.buy(s, 'tier'); }
      while (s.newMemos.length) fired[s.newMemos.shift().key] = true;
    }
    return Object.keys(fired);
  })()
`, ctx);
assert(memoRun.length > 0, 'memos fire during a real run (' + memoRun.join(', ') + ')');

// 7. the guru must always answer, and no rule may throw on any board state
const guruCheck = vm.runInContext(`
  (() => {
    const seen = new Set();
    let advisedEvery = true, thrown = null, blank = 0;
    // sweep a spread of situations: fresh, built-out, broke, idle, on fire
    const setups = [
      s => {},
      s => { s.cash = 1e6; for (const i of Content.SHOP) Engine.buy(s, i.key); },
      s => { s.cash = -100; },
      s => { s.cash = 1e6; Engine.buy(s, 'indexes'); Engine.buy(s, 'pooler');
             for (let i = 0; i < 5; i++) Engine.buy(s, 'tier'); },
      s => { s.cash = 1e6; Engine.buy(s, 'kv'); Engine.buy(s, 'cache'); Engine.buy(s, 'cache'); },
    ];
    for (let si = 0; si < setups.length; si++) {
      for (const profile of Content.PROFILE_KEYS) {
        const s = Engine.createState(100 + si);
        Engine.applyProfile(s, profile);
        Engine.tick(s);
        setups[si](s);
        for (let i = 0; i < 900; i++) {
          Engine.tick(s);
          if (i % 150 !== 0) continue;
          try {
            const out = Guru.advise(s, s.report);
            if (out.length === 0) { advisedEvery = false; blank++; }
            for (const a of out) {
              seen.add(a.key);
              if (!a.headline || !a.body || !a.action) blank++;
            }
          } catch (e) { thrown = e.message; }
        }
      }
    }
    return { seen: [...seen], advisedEvery, thrown, blank, rules: Guru.RULES.length };
  })()
`, ctx);
assert(guruCheck.thrown === null, 'no guru rule throws on any board state' +
  (guruCheck.thrown ? ' (' + guruCheck.thrown + ')' : ''));
assert(guruCheck.advisedEvery && guruCheck.blank === 0,
  'the guru always returns complete advice (never blank)');
assert(guruCheck.seen.length >= 8,
  `guru rules fire across situations (${guruCheck.seen.length}/${guruCheck.rules}: ${guruCheck.seen.join(', ')})`);

// 8. syntax check the DOM-dependent files
for (const f of ['ui.js', 'index.js', 'content.js', 'engine.js', 'flourish.js', 'memos.js', 'guru.js']) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, f)]);
    console.log('  PASS ' + f + ' parses');
  } catch (e) {
    failures++;
    console.log('  FAIL ' + f + ' parse error: ' + e.message);
  }
}

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
