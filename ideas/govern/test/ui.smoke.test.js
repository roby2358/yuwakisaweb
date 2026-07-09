// CHARTER — UI smoke test. Run: node test/ui.smoke.test.js
// Loads ui.js against a minimal DOM stub and drives the delegated click
// dispatcher through a whole regency: petitions, drafting, seasons, endgame.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------- DOM stub
function makeNode(tag) {
  return {
    tag: tag, children: [], className: '', dataset: {}, disabled: false,
    title: '', textContent: '', scrollTop: 0, scrollHeight: 100,
    _innerHTML: '',
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },
    get innerHTML() { return this._innerHTML; },
    appendChild: function (c) { this.children.push(c); return c; },
  };
}

const byId = {};
['hud-season', 'hud-ap', 'hud-treasury', 'hud-legitimacy', 'realm', 'chronicle',
  'status', 'endgame', 'end-title', 'end-body', 'end-score'].forEach(function (id) {
  byId[id] = makeNode('div');
});

let clickHandler = null;
global.document = {
  createElement: makeNode,
  getElementById: function (id) {
    assert.ok(byId[id], 'ui.js asked for unknown element #' + id);
    return byId[id];
  },
  body: {
    addEventListener: function (type, fn) {
      assert.strictEqual(type, 'click');
      clickHandler = fn;
    },
  },
};

global.CharterData = require('../js/data.js');
global.CharterEngine = require('../js/engine.js');

const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
vm.runInThisContext(src + '\n;globalThis.__UI = CharterUI;');
const UI = global.__UI;

function click(actionStr) {
  const btn = { dataset: { action: actionStr }, disabled: false };
  clickHandler({ target: { closest: function () { return btn; } } });
}

function collectButtons(node, out) {
  if (node.tag === 'button' && node.dataset.action) out.push(node);
  node.children.forEach(function (c) { collectButtons(c, out); });
  return out;
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log('  ok — ' + name); }

test('bind and start render every pane without crashing', function () {
  UI.bind();
  assert.ok(clickHandler, 'a click handler should be bound');
  UI.start(1234);
  assert.ok(byId['hud-season'].textContent.indexOf('Spring, Year 1') >= 0);
  assert.ok(byId['realm'].children.length >= 4, 'realm should render its panels');
  assert.ok(byId['chronicle'].children.length >= 2, 'chronicle should have entries');
  assert.strictEqual(byId['endgame'].className, 'hidden');
});

test('a petition rendered in the chronicle can be answered by click', function () {
  const respond = collectButtons(byId['chronicle'], []).find(function (b) {
    return b.dataset.action.indexOf('respond:') === 0;
  });
  assert.ok(respond, 'an open petition should render option buttons');
  const before = byId['hud-ap'].innerHTML;
  click(respond.dataset.action);
  assert.notStrictEqual(byId['hud-ap'].innerHTML, before, 'answering should spend AP');
});

test('the drafting table opens, previews, and enacts an edict', function () {
  click('toggleDraft');
  click('draftTemplate:subsidy');
  click('draftPreview:grain');
  const realmText = JSON.stringify(byId['realm'], function (k, v) { return k === 'children' ? v : v; });
  assert.ok(realmText.indexOf('Grain Subsidy') >= 0, 'the preview should name the edict');
  click('draft');
  const lawText = JSON.stringify(byId['realm']);
  assert.ok(lawText.indexOf('Enacted') >= 0 || JSON.stringify(byId['chronicle']).indexOf('Enacted') >= 0,
    'the enactment should be chronicled');
});

test('invalid actions surface a status message instead of crashing', function () {
  click('endorse:garrison'); // cold and priceless this early
  assert.ok(byId['status'].textContent.length > 0, 'the refusal should be explained');
});

test('seasons advance to the end of the regency and the overlay appears', function () {
  let guard = 0;
  while (byId['endgame'].className === 'hidden' && guard < 40) {
    guard += 1;
    click('endSeason');
  }
  assert.ok(byId['endgame'].className.indexOf('visible') >= 0, 'the regency should end on screen');
  assert.ok(byId['end-title'].textContent.length > 0);
});

test('a new regency can begin from the endgame card', function () {
  click('newGame');
  assert.strictEqual(byId['endgame'].className, 'hidden');
  assert.ok(byId['hud-season'].textContent.indexOf('Year 1') >= 0);
});

console.log('\n' + passed + ' tests passed.');
