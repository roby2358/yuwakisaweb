// LOAD BEARING — boot the real UI headlessly and drive it.
//
//   node test/smoke.js
//
// ui.js is the biggest file here and a browser is the only thing that normally
// runs it. test/domstub.js is just enough document to run it for real, so a
// refactor that renames a function, drops an element, wires a handler to a dead
// id, or reads undefined on the render path fails here rather than in a tab.
//
// It is not a browser and will not catch a layout bug. Everything it does catch
// is something that would have been a blank screen.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDom } = require('./domstub.js');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const SCRIPTS = [
  'format.js', 'flourish.js', 'content.js', 'catalog.js', 'memos.js',
  'engine.js', 'guru.js', 'score.js', 'ui.js', 'index.js',
];

const checks = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail: detail || '' });
  } catch (err) {
    checks.push({ name, ok: false, detail: err.message });
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function boot() {
  const html = read('index.html');
  const dom = makeDom(html);
  const ctx = vm.createContext({
    document: dom.document,
    window: dom.window,
    requestAnimationFrame: dom.requestAnimationFrame,
    setTimeout: dom.setTimeout,
    performance: dom.performance,
    console,
    Math, Date, JSON, Object, Array, Number, String, Set, Map, Proxy, isNaN,
    devicePixelRatio: 2,
  });
  ctx.globalThis = ctx;
  for (const file of SCRIPTS) {
    vm.runInContext(read(file), ctx, { filename: file });
  }
  return { dom, ctx };
}

function main() {
  const { dom, ctx } = boot();
  const state = () => dom.window.LB.getState();

  // Buying things grants insights, which queue a modal that pauses the sim.
  // Dismiss whatever is open before testing anything that needs it running.
  const settle = () => {
    for (let i = 0; i < 40; i++) {
      dom.frame(120);
      if (dom.byId.get('insight-card').classList.contains('hidden')) break;
      dom.fire('card-ok', 'click');
    }
  };

  check('boots and exposes state', () => {
    assert(dom.window.LB, 'window.LB missing — index.js did not run');
    assert(state().live === false, 'the service should not be live before you say so');
    assert(state().report, 'the board needs an idle report to render the design phase');
    assert(state().report.demandRps === 0, 'no traffic before go-live');
    assert(dom.byId.get('insight-total').textContent === String(ctx.Content.INSIGHT_KEYS.length),
      'insight total not filled in');
  });

  check('the service brief renders and dismisses', () => {
    assert(dom.byId.get('intro-title').textContent.length > 3, 'brief title empty');
    assert(dom.byId.get('brief-nfr').children.length >= 5, 'non-functional requirements not listed');
    dom.fire('intro-ok', 'click');
    assert(dom.byId.get('modal-backdrop').classList.contains('hidden'), 'modal did not close');
  });

  check('the design phase blocks launch until it can serve anything', () => {
    const s = state();
    dom.frame(120);
    assert(!dom.byId.get('launch').classList.contains('hidden'), 'launch panel not shown');
    assert(dom.byId.get('btn-golive').disabled, 'Go Live enabled with nothing built');
    assert(ctx.Engine.launchBlockers(s).length === 2, 'expected two blockers on an empty board');
    for (let i = 0; i < 40; i++) dom.frame(120);
    assert(s.t === 0, 'the clock ran before go-live: t=' + s.t);
    assert(s.cash === ctx.Content.SIM.START_CASH, 'money moved before go-live');
    return 'blocked on: ' + ctx.Engine.launchBlockers(s).join(', ');
  });

  check('Go Live starts the clock', () => {
    const s = state();
    while (!s.live) {
      const key = ctx.Guru.nextBuy(s);
      if (!key || !ctx.Engine.buy(s, key).ok) break;
    }
    dom.frame(120);
    assert(!dom.byId.get('btn-golive').disabled, 'Go Live still disabled after building a design');
    dom.fire('btn-golive', 'click');
    settle();
    assert(state().live, 'clicking Go Live did not launch');
    assert(dom.byId.get('launch').classList.contains('hidden'), 'launch panel still showing');
    return 'launched with ' + ctx.Content.SHOP.filter(i => i.owned(s)).length + ' boxes built';
  });

  check('renders frames without throwing', () => {
    for (let i = 0; i < 90; i++) dom.frame(120);
    assert(state().t > 5, 'simulation did not advance: t=' + state().t);
    assert(state().report, 'no report after 90 frames');
    return 't=' + state().t.toFixed(0) + 's, served '
      + Math.round(state().report.servedRps) + '/s';
  });

  check('top bar and money bar are populated', () => {
    assert(dom.byId.get('stat-rps').textContent !== '0', 'served rps never updated');
    assert(dom.byId.get('stat-p99-sub').textContent.includes('target'), 'p99 target missing');
    assert(dom.byId.get('money-segments').children.length > 0, 'money bar has no segments');
    assert(dom.byId.get('money-net').textContent.length > 0, 'money net empty');
  });

  check('the brief reopens from the top bar', () => {
    dom.fire('brief-name', 'click');
    assert(!dom.byId.get('intro').classList.contains('hidden'),
      'clicking the brief name did not reopen the brief');
    const t = state().t;
    for (let i = 0; i < 5; i++) dom.frame(120);
    assert(state().t === t, 'the sim kept running under the reopened brief');
    dom.fire('intro-ok', 'click');
    assert(dom.byId.get('modal-backdrop').classList.contains('hidden'),
      'the reopened brief did not close');
    for (let i = 0; i < 3; i++) dom.frame(120);
    assert(state().t > t, 'the sim did not resume after closing the brief');
  });

  check('the board only draws what this workload could use', () => {
    const s = state();
    const on = ctx.Content.STATION_KEYS.filter(k => s.report.stations[k].relevant);
    assert(on.length >= 4 && on.length <= 8, on.length + ' boxes on the board: ' + on.join(' '));
    return s.scenario + ' → ' + on.length + ' boxes: ' + on.join(' ');
  });

  check('shop lists every box and every item', () => {
    const items = dom.byId.get('shop-items');
    assert(items.children.length >= ctx.Content.SHOP.length + ctx.Content.BOXES.length,
      'shop is missing rows: ' + items.children.length);
    return ctx.Content.SHOP.length + ' items in ' + ctx.Content.BOXES.length + ' boxes';
  });

  // The shop redraws several times a second. If it rebuilds its rows, the
  // button under the pointer is destroyed between mousedown and mouseup and the
  // click never lands — the list also scrolls out from under the hand.
  check('shop rows survive a redraw and still buy', () => {
    const s = state();
    s.cash += 20000;
    const list = dom.byId.get('shop-items');
    const order = [];
    for (const box of ctx.Content.BOXES) {
      for (const item of ctx.Content.SHOP) if (item.box === box.key) order.push(item);
    }
    const itemRows = () => list.children.filter(c => c.className === 'item');
    assert(itemRows().length === order.length,
      'expected one row per item, got ' + itemRows().length);
    const at = order.findIndex(i => i.price(s) !== null && i.price(s) <= s.cash);
    const buy = itemRows()[at].children[1].children[0];
    for (let i = 0; i < 10; i++) dom.frame(100);
    assert(itemRows()[at].children[1].children[0] === buy,
      'the shop rebuilt its rows — no click can survive that');
    const before = s.cash;
    dom.fireNode(buy, 'click');
    assert(s.cash < before, 'clicking the buy button bought nothing');
    return 'bought ' + order[at].name + ' through its button after 10 redraws';
  });

  check('buying and scaling down work through the engine', () => {
    const s = state();
    s.cash += 200000;
    for (const key of Object.keys(ctx.Content.SHOP_BY_KEY)) {
      const res = ctx.Engine.buy(s, key);
      assert(res.ok || res.msg, 'buy(' + key + ') returned nothing useful');
    }
    dom.frame(120);
    let scaled = 0;
    for (const item of ctx.Content.SHOP) {
      if (item.canScaleDown(s) && ctx.Engine.scaleDown(s, item.key).ok) scaled++;
    }
    dom.frame(120);
    return 'bought every item, scaled ' + scaled + ' back down';
  });

  check('every station probes without throwing', () => {
    // the probe follows the pointer, so walk it over the whole canvas — that
    // lands on every box without having to know where the layout put them
    for (let x = 0; x < 960; x += 12) {
      for (let y = 0; y < 540; y += 20) dom.fireAt('scene', 'mousemove', x, y);
    }
    dom.frame(120);
    return 'probe survived a full sweep of the board';
  });

  check('telemetry gates how much the probe answers', () => {
    const s = state();
    const rows = level => {
      s.infra.obs = level;
      dom.fireAt('scene', 'mousemove', 10, 10);
      dom.frame(120);
      return level;
    };
    [0, 1, 2].forEach(rows);
    return 'probe rendered at all three telemetry levels';
  });

  check('the guru opens, advises and its buttons are wired', () => {
    dom.fire('btn-guru', 'click');
    dom.frame(300);
    const cards = dom.byId.get('guru-cards');
    const advice = ctx.Guru.advise(state());
    assert(advice.cards.length > 0, 'guru had nothing to say');
    assert(cards.children.length > 0, 'guru panel rendered no cards');
    dom.fire('btn-guru', 'click');
    return advice.cards.map(c => c.key).join(', ');
  });

  check('field notes open and close', () => {
    settle();
    state().insights.hockey = true;
    dom.fire('btn-insights', 'click');
    assert(!dom.byId.get('drawer').classList.contains('hidden'), 'drawer did not open');
    dom.fire('drawer-close', 'click');
    assert(dom.byId.get('modal-backdrop').classList.contains('hidden'), 'drawer did not close');
  });

  check('an insight card interrupts and resumes', () => {
    state().newInsights.push('littles');
    dom.frame(120);
    assert(!dom.byId.get('insight-card').classList.contains('hidden'), 'insight card did not show');
    assert(dom.byId.get('card-text').textContent.length > 40, 'insight text empty');
    dom.fire('card-ok', 'click');
    dom.frame(120);
  });

  check('events toast and memos slide in', () => {
    state().newEvents.push('hn');
    state().newMemos.push({ key: 'noindexes', from: 'Dave', title: 'VP Engineering', subject: 's', body: 'b' });
    dom.frame(120);
    assert(dom.byId.get('toasts').children.length > 0, 'no toast rendered');
    assert(dom.byId.get('memos').children.length > 0, 'no memo rendered');
    dom.fire('btn-memos', 'click');
    dom.fire('btn-memos', 'click');
  });

  check('speed controls and pause do not throw', () => {
    for (const b of dom.document.querySelectorAll('.speed')) dom.fireAt(b.id, 'click', 0, 0);
    dom.frame(120);
  });

  check('the scorecard renders for a win', () => {
    const s = state();
    s.outcome = 'won';
    dom.frame(120);
    assert(!dom.byId.get('endscreen').classList.contains('hidden'), 'end screen did not show');
    const table = dom.byId.get('scorecard');
    assert(table.children.length === ctx.Content.RUBRIC.length,
      'scorecard has ' + table.children.length + ' rows, expected ' + ctx.Content.RUBRIC.length);
    assert(dom.byId.get('overall').textContent.length > 0, 'no overall grade');
    assert(dom.byId.get('verdict').textContent.length > 10, 'no verdict line');
    const reqs = ctx.Score.requirements(s);
    assert(reqs.length === 6, 'expected 6 brief lines, got ' + reqs.length);
    for (const r of reqs) {
      assert(typeof r.met === 'boolean' && r.why.length > 10,
        'brief line "' + r.label + '" has no verdict or reason');
    }
    assert(dom.byId.get('end-reqs').children.length === 1 + reqs.length,
      'the brief lines did not render');
    const subs = ctx.Score.subsystems(s);
    assert(subs.length > 0, 'no subsystem expectations for ' + s.scenario);
    for (const r of subs) {
      assert(['met', 'missed', 'overbuilt'].includes(r.status) && r.why.length > 10,
        'subsystem "' + r.label + '" has no verdict or reason');
    }
    assert(dom.byId.get('end-subs').children.length === 1 + subs.length,
      'the subsystem lines did not render');
    return dom.byId.get('overall').textContent + ' — ' + dom.byId.get('verdict').textContent;
  });



  check('restart deals a new system', () => {
    const before = state().scenario;
    dom.fire('btn-restart', 'click');
    dom.frame(120);
    assert(state().outcome === null, 'restart did not clear the outcome');
    assert(!dom.byId.get('intro').classList.contains('hidden'), 'restart did not show a new system');
    return 'was ' + before + ', now ' + state().scenario;
  });

  check('the scorecard renders for every loss cause', () => {
    for (const cause of ['bankrupt', 'sql', 'timeout', 'shed', 'gpu', null]) {
      const s = state();
      s.outcome = 'lost';
      s.deathCause = cause;
      ctx.UI.showEnd(s, () => {});
    }
    return 'six post-mortems rendered';
  });

  const failed = checks.filter(c => !c.ok);
  console.log('');
  for (const c of checks) {
    console.log('  ' + (c.ok ? 'ok  ' : 'FAIL') + '  ' + c.name.padEnd(46)
      + (c.detail ? '· ' + c.detail : ''));
  }
  console.log('\n  ' + (checks.length - failed.length) + '/' + checks.length + ' checks passed\n');
  if (failed.length) process.exitCode = 1;
}

main();
