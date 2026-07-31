// STARLANE smoke test — boots data/game/ui headlessly with DOM stubs, starts a
// game, and exercises the map view transform, zoom levels, and the price lens.
// Run: node test/smoke.js
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ---------- DOM stubs ----------

function makeClassList() {
  var set = {};
  return {
    add: function (c) { set[c] = true; },
    remove: function (c) { delete set[c]; },
    toggle: function (c, on) { if (on) set[c] = true; else delete set[c]; },
    contains: function (c) { return !!set[c]; }
  };
}

function makeEl(id) {
  var el = {
    id: id || '',
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    value: '',
    title: '',
    children: [],
    classList: makeClassList(),
    appendChild: function (c) { el.children.push(c); return c; },
    remove: function () {},
    addEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 640 }; }
  };
  return el;
}

function makeCtx() {
  var noop = function () {};
  var ctx = {
    fillTextCount: 0,
    clearRect: noop, beginPath: noop, arc: noop, fill: noop, stroke: noop,
    moveTo: noop, lineTo: noop, setLineDash: noop,
    fillText: function () { ctx.fillTextCount++; }
  };
  return ctx;
}

var els = {};
function getEl(id) {
  if (!els[id]) els[id] = makeEl(id);
  return els[id];
}

var mapEl = getEl('map');
mapEl.width = 640;
mapEl.height = 640;
var mapCtx = makeCtx();
mapEl.getContext = function () { return mapCtx; };

var sandbox = {
  console: console,
  Math: Math,
  JSON: JSON,
  Date: Date,
  setTimeout: function () {},
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  document: {
    getElementById: getEl,
    createElement: function (tag) { return makeEl(''); },
    addEventListener: function () {}
  }
};
sandbox.window = sandbox;
sandbox.window.addEventListener = function () {};
vm.createContext(sandbox);

['js/data.js', 'js/game.js', 'js/ui.js'].forEach(function (f) {
  var src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
});

// ---------- Assertions ----------

var failures = 0;
function check(name, ok) {
  if (!ok) failures++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name);
}

vm.runInContext('loadLegacy(); buildMapTools(); newGame("smoketest", "Tester"); UI.selected = G.cur;', sandbox);

var out = vm.runInContext(
  '(function () {' +
  '  var r = {};' +
  '  var home = G.systems[G.cur];' +
  // Every zoom level centers the ship and circumscribes a circle of N ship-ranges:
  // the visible world width must be exactly 2·N·range, ship dead center.
  '  r.levels = ZOOM_LEVELS.join(",");' +
  '  r.circumscribed = ZOOM_LEVELS.every(function (z) {' +
  '    UI.setZoom(z);' +
  '    var span = 640 / mapScale();' +
  '    return Math.abs(span - 2 * z * shipRangeWorld()) < 1e-9 &&' +
  '           UI.view.cx === home.x && UI.view.cy === home.y;' +
  '  });' +
  // At 1R the ship sits at canvas center and a full-tank ring touches the edges.
  '  UI.setZoom(1);' +
  '  var pc = mapXY(home);' +
  '  r.shipCentered = pc.x === 320 && pc.y === 320;' +
  '  r.ringFills = Math.abs(shipRangeWorld() * mapScale() - 320) < 1e-9;' +
  // Range grows with fuel upgrades, so the same zoom level shows a wider view.
  '  var scaleBefore = mapScale();' +
  '  G.upgrades.fuel += 1;' +
  '  r.rangeAdapts = mapScale() < scaleBefore;' +
  '  G.upgrades.fuel -= 1;' +
  // Each level is wider than the last.
  '  UI.setZoom(2);' +
  '  var scale2 = mapScale();' +
  '  UI.setZoom(5);' +
  '  var scale5 = mapScale();' +
  '  UI.setZoom(10);' +
  '  r.spanOrder = scale2 > scale5 && scale5 > mapScale();' +
  // Panning drifts the view; zooming snaps it back to the ship.
  '  UI.view.cx = -500; UI.view.cy = 500;' +
  '  UI.setZoom(1);' +
  '  r.zoomRecenters = UI.view.cx === home.x && UI.view.cy === home.y;' +
  // Price lens: docked system has live intel; unvisited systems have none.
  '  var stats = lensStats("food");' +
  '  r.lensHasHome = stats.prices[G.cur] === priceOf(home, "food");' +
  '  var unvisited = G.systems.filter(function (s) { return !s.visited; });' +
  '  r.lensSkipsUnknown = unvisited.every(function (s) { return stats.prices[s.id] === undefined; });' +
  '  r.lensBounds = stats.min <= stats.prices[G.cur] && stats.prices[G.cur] <= stats.max;' +
  // Color endpoints: max price = red (hue 0), min price = blue (hue 240),
  // and a flat market (min === max) sits at the midpoint instead of dividing by 0.
  '  r.colorHigh = lensColor(100, 50, 100);' +
  '  r.colorLow = lensColor(50, 50, 100);' +
  '  r.colorFlat = lensColor(80, 80, 80);' +
  // Spice is untradeable in guild space, so guild systems never get a spice price.
  '  var spice = lensStats("spice");' +
  '  r.spiceGuildNull = G.systems.every(function (s) {' +
  '    return s.faction !== "guild" || spice.prices[s.id] === undefined; });' +
  // Full render with the lens active must not throw.
  '  UI.lens = "food"; UI.setZoom(5); renderAll();' +
  '  r.rendered = true;' +
  '  return r;' +
  '})()', sandbox);

check('zoom levels are 1,2,5,10 ship-ranges', out.levels === '1,2,5,10');
check('every level circumscribes an N-range circle, ship-centered', out.circumscribed);
check('ship renders at canvas center', out.shipCentered);
check('at 1R a full-tank fuel ring exactly touches the display edges', out.ringFills);
check('fuel upgrades widen the view at the same zoom level', out.rangeAdapts);
check('each level is wider than the last', out.spanOrder);
check('zooming recenters a panned view on the ship', out.zoomRecenters);
check('lens has live price for the docked system', out.lensHasHome);
check('lens ignores unvisited systems', out.lensSkipsUnknown);
check('lens min/max bracket known prices', out.lensBounds);
check('max price renders red', out.colorHigh === 'hsl(0, 85%, 55%)');
check('min price renders blue', out.colorLow === 'hsl(240, 85%, 55%)');
check('flat market renders midpoint green', out.colorFlat === 'hsl(120, 85%, 55%)');
check('spice lens skips guild systems', out.spiceGuildNull);
check('renderAll with lens + 5x zoom does not throw', out.rendered);

// Text culling: narrow spans label systems; 5R/10R draw just the dots.
mapCtx.fillTextCount = 0;
vm.runInContext('UI.lens = "food"; UI.setZoom(2);', sandbox);
check('names and prices drawn at 2R', mapCtx.fillTextCount > 0);
mapCtx.fillTextCount = 0;
vm.runInContext('UI.setZoom(5);', sandbox);
var textAt5 = mapCtx.fillTextCount;
vm.runInContext('UI.setZoom(10);', sandbox);
check('wide views draw just the dots (no text at 5R/10R)', textAt5 === 0 && mapCtx.fillTextCount === textAt5);

console.log(failures ? failures + ' FAILURE(S)' : 'all checks passed');
process.exit(failures ? 1 : 0);
