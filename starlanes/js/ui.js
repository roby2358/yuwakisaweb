// STARLANE — rendering and interaction. Reads G, calls engine functions, re-renders.
'use strict';

var UI = {
  selected: null,   // selected system id on the map
  tab: 'market',
  encounter: null,
  starfield: null,
  view: { zoom: 2, cx: 50, cy: 50 },  // view width in ship-ranges + world coords at canvas center
  lens: null,       // good id whose relative price colors the map, or null
  dragMoved: false
};

var ZOOM_LEVELS = [1, 2, 5, 10];

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n) { return Math.round(n).toLocaleString(); }

// ---------- Toasts ----------

function uiToast(msg) {
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(function () { t.classList.add('show'); }, 20);
  setTimeout(function () {
    t.classList.remove('show');
    setTimeout(function () { t.remove(); }, 400);
  }, 3600);
}

// ---------- Modal ----------

function showModal(title, bodyHtml, choices, opts) {
  UI.modalLock = opts && opts.lock;
  $('modal-title').innerHTML = title;
  $('modal-body').innerHTML = bodyHtml;
  var ch = $('modal-choices');
  ch.innerHTML = '';
  (choices || [{ label: 'Continue' }]).forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'btn ' + (c.cls || '');
    b.innerHTML = c.label + (c.sub ? '<span class="btn-sub">' + c.sub + '</span>' : '');
    b.onclick = function () {
      if (!c.keepOpen) hideModal();
      if (c.fn) c.fn();
    };
    ch.appendChild(b);
  });
  $('modal-back').classList.add('open');
}

function hideModal() {
  UI.modalLock = false;
  $('modal-back').classList.remove('open');
}

// ---------- Render root ----------

function renderAll() {
  if (!G) return;
  renderHeader();
  renderMap();
  renderSystemPanel();
  renderTabs();
  renderLog();
}

function renderHeader() {
  var worth = netWorth();
  $('hd-captain').textContent = G.captain + ' · ' + titleFor(worth);
  $('hd-day').textContent = 'Day ' + G.day;
  $('hd-credits').textContent = fmt(G.credits) + ' cr';
  $('hd-worth').textContent = 'Net ' + fmt(worth);
  $('hd-fuel').textContent = 'Fuel ' + Math.round(G.fuel) + '/' + shipStat('fuel');
  $('hd-cargo').textContent = 'Hold ' + cargoUsed() + '/' + shipStat('cargo');
  $('hd-legacy').textContent = '☆ ' + LEGACY.points;
  $('hd-legacy').title = 'Legacy points (spend on perks when starting a new galaxy)';
}

// ---------- Map ----------

var MAP_SIZE = 640;

// Distance the ship covers on a full tank, in world units (fuel cost ≈ distance).
function shipRangeWorld() {
  return shipStat('fuel') / fuelPerDist();
}

// Pixels per world unit. The view is ship-centered and the display square
// circumscribes a circle of N ship-ranges: at 1R a full-tank fuel ring exactly
// touches the display edges. Scale adapts as tanks, hulls, and perks extend reach.
function mapScale() {
  return MAP_SIZE / (shipRangeWorld() * 2 * UI.view.zoom);
}

function mapXY(sys) {
  var s = mapScale();
  return {
    x: MAP_SIZE / 2 + (sys.x - UI.view.cx) * s,
    y: MAP_SIZE / 2 + (sys.y - UI.view.cy) * s
  };
}

function renderMap() {
  var cv = $('map');
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);

  // Static starfield per seed.
  if (!UI.starfield || UI.starfield.seed !== G.seed) {
    var rng = mulberry32(hashSeed('stars' + G.seed));
    var stars = [];
    for (var i = 0; i < 130; i++) {
      stars.push({ x: rng() * MAP_SIZE, y: rng() * MAP_SIZE, r: rng() * 1.2 + 0.2, a: 0.2 + rng() * 0.5 });
    }
    UI.starfield = { seed: G.seed, stars: stars };
  }
  UI.starfield.stars.forEach(function (st) {
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,215,255,' + st.a + ')';
    ctx.fill();
  });

  var here = G.systems[G.cur];
  var hp = mapXY(here);

  // Full-tank range circle — the zoom anchor: at 1R it exactly touches the display edges.
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, shipRangeWorld() * mapScale(), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(120,160,255,0.12)';
  ctx.setLineDash([2, 7]);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Current fuel ring — the map answers "where can I go right now." (fuel cost ≈ distance)
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, (G.fuel / fuelPerDist()) * mapScale(), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(120,160,255,0.25)';
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Route preview to selection.
  if (UI.selected != null && UI.selected !== G.cur) {
    var sp = mapXY(G.systems[UI.selected]);
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(sp.x, sp.y);
    ctx.strokeStyle = 'rgba(255,215,130,0.5)';
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  var lens = UI.lens ? lensStats(UI.lens) : null;
  renderLensLegend(lens);
  var showText = UI.view.zoom < 5;  // wide views show just the dots

  for (var s = 0; s < G.systems.length; s++) {
    var sys = G.systems[s];
    if (!sys.charted) { drawUncharted(ctx, mapXY(sys)); continue; }
    var p = mapXY(sys);
    var col = FACTIONS[sys.faction].color;
    var r = 3 + sys.wealth * 1.6;
    var lensP = lens ? lens.prices[sys.id] : undefined;

    if (s === G.cur) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd882';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (s === UI.selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (lens) {
      ctx.fillStyle = lensP != null ? lensColor(lensP, lens.min, lens.max) : 'rgba(140,150,170,0.45)';
    } else {
      ctx.fillStyle = sys.visited ? col : 'rgba(140,150,170,0.9)';
    }
    ctx.fill();
    if (!showText) continue;
    if (!sys.visited) {
      ctx.fillStyle = '#0b0e1a';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', p.x, p.y + 3);
    }
    if (sys.outpost) {
      ctx.fillStyle = '#ffd882';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲', p.x, p.y - r - 4);
    }
    if (eventKnown(sys)) {
      ctx.fillStyle = '#ff9d5c';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x + r + 5, p.y + 4);
    }
    ctx.fillStyle = 'rgba(220,228,245,0.85)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sys.name, p.x, p.y + r + 12);
    if (lensP != null) {
      ctx.fillStyle = lensColor(lensP, lens.min, lens.max);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(lensP + ' cr', p.x, p.y + r + 23);
    }
  }
}

// Uncharted stars show as white crosses — something is out there, go find out what.
function drawUncharted(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p.x - 4, p.y);
  ctx.lineTo(p.x + 4, p.y);
  ctx.moveTo(p.x, p.y - 4);
  ctx.lineTo(p.x, p.y + 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------- Price lens ----------

// Best price intel the player has for a good: live at the docked system and
// outposts, last-seen snapshot elsewhere, nothing for unsurveyed markets.
function lensPrice(sys, good) {
  if (!canTradeGood(sys, good)) return null;
  if (sys.id === G.cur || sys.outpost) return priceOf(sys, good);
  if (sys.lastSeen) return sys.lastSeen.prices[good].buy;
  return null;
}

function lensStats(good) {
  var prices = {}, min = Infinity, max = -Infinity;
  G.systems.forEach(function (sys) {
    if (!sys.charted) return;
    var p = lensPrice(sys, good);
    if (p == null) return;
    prices[sys.id] = p;
    if (p < min) min = p;
    if (p > max) max = p;
  });
  return { prices: prices, min: min, max: max };
}

// Blue (cheapest known) through the rainbow to red (dearest known).
function lensColor(p, min, max) {
  var t = max > min ? (p - min) / (max - min) : 0.5;
  return 'hsl(' + Math.round(240 * (1 - t)) + ', 85%, 55%)';
}

function renderLensLegend(lens) {
  var lg = $('lens-legend');
  if (!lens || lens.max === -Infinity) { lg.style.display = 'none'; return; }
  lg.style.display = 'flex';
  $('lens-min').textContent = lens.min;
  $('lens-max').textContent = lens.max;
}

// The player knows about an event if they docked during it, heard a rumor, or own the outpost.
function eventKnown(sys) {
  return !!(sys.event && (sys.event.known || sys.outpost || sys.id === G.cur));
}

function mapClick(ev) {
  if (UI.dragMoved) { UI.dragMoved = false; return; }
  var cv = $('map');
  var rect = cv.getBoundingClientRect();
  var x = (ev.clientX - rect.left) * (cv.width / rect.width);
  var y = (ev.clientY - rect.top) * (cv.height / rect.height);
  var best = null, bestD = 18 * 18;
  for (var s = 0; s < G.systems.length; s++) {
    if (!G.systems[s].charted) continue;
    var p = mapXY(G.systems[s]);
    var dx = p.x - x, dy = p.y - y;
    if (dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; best = s; }
  }
  if (best != null) { UI.selected = best; renderAll(); }
}

// Drag to pan away from the ship for a peek; zooming or traveling recenters.
function bindMapPan(cv) {
  var drag = null;
  cv.addEventListener('mousedown', function (ev) {
    drag = { x: ev.clientX, y: ev.clientY };
    UI.dragMoved = false;
  });
  window.addEventListener('mousemove', function (ev) {
    if (!drag || !G) return;
    var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!UI.dragMoved && dx * dx + dy * dy < 16) return;
    UI.dragMoved = true;
    var rect = cv.getBoundingClientRect();
    var k = (cv.width / rect.width) / mapScale();
    UI.view.cx -= dx * k;
    UI.view.cy -= dy * k;
    drag = { x: ev.clientX, y: ev.clientY };
    renderMap();
  });
  window.addEventListener('mouseup', function () { drag = null; });
}

// ---------- Map toolbar (zoom + price lens) ----------

UI.setZoom = function (z) {
  if (!G) return;
  UI.view.zoom = z;
  centerOn(G.systems[G.cur]);
  updateZoomBtns();
  renderMap();
};

function centerOn(sys) {
  UI.view.cx = sys.x;
  UI.view.cy = sys.y;
}

function updateZoomBtns() {
  var btns = $('zoom-btns').children;
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', Number(btns[i].dataset.zoom) === UI.view.zoom);
  }
}

function buildMapTools() {
  var zb = $('zoom-btns');
  ZOOM_LEVELS.forEach(function (z) {
    var b = document.createElement('button');
    b.className = 'btn tiny zoom-btn';
    b.textContent = z + 'R';
    b.title = 'View spans ' + z + '× your full-tank range';
    b.dataset.zoom = z;
    b.onclick = function () { UI.setZoom(z); };
    zb.appendChild(b);
  });
  updateZoomBtns();

  var sel = $('good-lens');
  var off = document.createElement('option');
  off.value = '';
  off.textContent = 'Price lens: off';
  sel.appendChild(off);
  GOOD_IDS.forEach(function (g) {
    var o = document.createElement('option');
    o.value = g;
    o.textContent = GOODS[g].name;
    sel.appendChild(o);
  });
  sel.onchange = function () {
    UI.lens = sel.value || null;
    if (G) renderMap();
  };
}

// ---------- System panel (selection + travel) ----------

// One-line freshness note for a remote system's market intel.
function intelNote(sys) {
  if (!sys.visited) {
    return '<div class="sys-note">Never visited — no market intel. First docking earns a Guild survey bonus.</div>';
  }
  if (sys.outpost) return '<div class="sys-note live">Live price feed from your outpost.</div>';
  if (sys.lastSeen) {
    return '<div class="sys-note">Market intel from day ' + sys.lastSeen.day +
      (G.day - sys.lastSeen.day > 6 ? ' <span class="stale">(stale)</span>' : '') + '</div>';
  }
  return '';
}

// Last-seen buy/sell table for a remote system; empty when there is no intel.
function intelTable(sys) {
  if (!sys.lastSeen) return '';
  var h = '<table class="mini-prices"><tr><th>Good</th><th>Buy</th><th>Sell</th></tr>';
  GOOD_IDS.forEach(function (g) {
    if (!canTradeGood(sys, g)) return;
    var p = sys.lastSeen.prices[g];
    h += '<tr><td>' + GOODS[g].name + '</td><td>' + p.buy + '</td><td>' + p.sell + '</td></tr>';
  });
  return h + '</table>';
}

function renderSystemPanel() {
  var el = $('system-panel');
  var id = UI.selected != null ? UI.selected : G.cur;
  var sys = G.systems[id];
  var f = FACTIONS[sys.faction];
  var h = '<div class="sys-name" style="color:' + f.color + '">' + esc(sys.name) +
    (id === G.cur ? ' <span class="tag">docked</span>' : '') +
    (sys.outpost ? ' <span class="tag gold">outpost</span>' : '') + '</div>';
  h += '<div class="sys-sub">' + f.name + ' · ' + ECONOMIES[sys.economy].name +
    ' · Wealth ' + '★'.repeat(sys.wealth) + '</div>';

  if (eventKnown(sys)) {
    h += '<div class="sys-event">⚠ ' + EVENTS[sys.event.type].name + ' — ' +
      EVENTS[sys.event.type].news + ' (~' + sys.event.daysLeft + 'd)</div>';
  }

  if (id !== G.cur) h += intelNote(sys);

  if (id !== G.cur) {
    var cost = fuelCostTo(sys);
    var days = travelDays(sys);
    var risk = Math.round(routeRisk(sys) * 100);
    var scan = Math.round(scanRisk(sys) * 100);
    h += '<div class="travel-box">';
    h += '<div class="travel-stats">Fuel <b>' + cost + '</b> · Days <b>' + days +
      '</b> · Pirate risk <b class="' + (risk >= 20 ? 'risk-hi' : 'risk-lo') + '">' + risk + '%</b>';
    if (scan > 0) h += ' · Customs scan <b class="risk-hi">' + scan + '%</b> (spice aboard!)';
    h += '</div>';
    var need = shipStat('fuel') - G.fuel;
    var fp = fuelPrice(G.systems[G.cur]);
    var fillCost = Math.min(Math.floor(need), Math.floor(G.credits / fp)) * fp;
    h += '<div class="travel-row">';
    h += towButton();
    if (need >= 1 && fillCost > 0) {
      h += '<button class="btn" onclick="UI.refuel()">Refuel (' + fmt(fillCost) + ' cr)</button>';
    }
    if (cost <= G.fuel) {
      h += '<button class="btn primary" onclick="UI.travel(' + id + ')">Travel to ' + esc(sys.name) + '</button>';
    } else {
      h += '<span class="sys-note stale">Not enough fuel (' + Math.round(G.fuel) + '/' + cost + ').</span>';
    }
    h += '</div>';
    h += '</div>';
  } else {
    h += towButton();
  }

  el.innerHTML = h;
}

// Guild tow offer — rendered wherever the player could be pinned.
function towButton() {
  if (!strandedHere() || G.fuel >= shipStat('fuel')) return '';
  return '<button class="btn warn" onclick="UI.tow()">☎ Distress tow (300 cr)</button>';
}

// ---------- Tabs ----------

var TABS = [
  ['market', 'Market'], ['shipyard', 'Shipyard'], ['contracts', 'Contracts'],
  ['cantina', 'Cantina'], ['assets', 'Assets'], ['factions', 'Factions']
];

function renderTabs() {
  var bar = $('tab-bar');
  bar.innerHTML = '';
  TABS.forEach(function (t) {
    var b = document.createElement('button');
    b.className = 'tab-btn' + (UI.tab === t[0] ? ' active' : '');
    b.textContent = t[1];
    if (t[0] === 'contracts' && G.active.length) b.textContent += ' (' + G.active.length + ')';
    b.onclick = function () { UI.tab = t[0]; renderTabs(); };
    bar.appendChild(b);
  });
  var el = $('tab-body');
  if (UI.tab === 'market') el.innerHTML = htmlMarket();
  else if (UI.tab === 'shipyard') el.innerHTML = htmlShipyard();
  else if (UI.tab === 'contracts') el.innerHTML = htmlContracts();
  else if (UI.tab === 'cantina') el.innerHTML = htmlCantina();
  else if (UI.tab === 'assets') el.innerHTML = htmlAssets();
  else if (UI.tab === 'factions') el.innerHTML = htmlFactions();
}

function htmlMarket() {
  var sys = G.systems[G.cur];
  var h = '<h3>' + esc(sys.name) + ' Exchange</h3>';
  if (sys.event) {
    h += '<div class="sys-event">⚠ ' + EVENTS[sys.event.type].name + ' is moving prices (~' +
      sys.event.daysLeft + 'd left)</div>';
  }
  h += '<table class="market"><tr><th>Good</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Hold</th><th></th><th></th></tr>';
  GOOD_IDS.forEach(function (g) {
    var legal = canTradeGood(sys, g);
    var buy = priceOf(sys, g), sell = sellPriceOf(sys, g);
    var have = G.cargo[g] || 0;
    var avg = G.avgCost[g];
    var evUp = eventMult(sys, g) > 1;
    h += '<tr class="' + (legal ? '' : 'illegal') + '">';
    h += '<td>' + priceDot(sys, g) + GOODS[g].name + (GOODS[g].illegal ? ' <span class="tag red">illegal in Guild space</span>' : '') +
      (evUp ? ' <span class="tag orange">event ▲</span>' : '') + '</td>';
    if (legal) {
      var profitCls = (have && sell > avg) ? 'profit' : (have && sell < avg ? 'loss' : '');
      h += '<td>' + buy + '</td><td class="' + profitCls + '">' + sell + '</td>';
      h += '<td>' + sys.mkt[g].stock + '</td>';
      h += '<td class="hold">' + (have ? have + ' <span class="dim">@' + Math.round(avg) + '</span>' : '—') + '</td>';
      h += '<td class="acts">' + qtyBtns('buy', g) + '</td>';
      h += '<td class="acts">' + (have ? qtyBtns('sell', g) :
        '<span class="ghost">' + qtyBtns('sell', g) + '</span>') + '</td>';
    } else {
      h += '<td colspan="5" class="dim">Guild customs — no open trade. ' +
        (have ? 'You are carrying ' + have + '!' : '') + '</td>';
    }
    h += '</tr>';
  });
  h += '</table>';

  if (UI.selected != null && UI.selected !== G.cur) {
    var sel = G.systems[UI.selected];
    h += '<h4>Known prices — <span style="color:' + FACTIONS[sel.faction].color + '">' +
      esc(sel.name) + '</span></h4>';
    h += intelNote(sel);
    h += intelTable(sel);
  } else if (G.active.length) {
    h += '<h4>Active contracts <span class="dim">(' + G.active.length + '/3)</span></h4>';
    G.active.forEach(function (ct) { h += activeContractCard(ct); });
  }

  h += '<div class="hint">Prices react to your trades unit by unit: big buys cost more per unit, big sells earn less (markets recover ~15%/day). Dealers keep a 10% buy/sell spread — faction rep narrows it in their space (up to +10% on sells at 100 rep).</div>';
  return h;
}

// ROYGBIV dot for a market row: the local buy price against every known price
// for that good — the table twin of the map's price lens (blue cheap, red dear).
function priceDot(sys, g) {
  if (!canTradeGood(sys, g)) return '';
  var stats = lensStats(g);
  var col = lensColor(priceOf(sys, g), stats.min, stats.max);
  return '<span class="price-dot" style="background:' + col + '"></span>';
}

function qtyBtns(act, g) {
  var lbl = act === 'buy' ? 'Buy' : 'Sell';
  return '<button class="btn tiny" onclick="UI.' + act + '(\'' + g + '\',1)">' + lbl + ' 1</button>' +
    '<button class="btn tiny" onclick="UI.' + act + '(\'' + g + '\',5)">5</button>' +
    '<button class="btn tiny" onclick="UI.' + act + '(\'' + g + '\',9999)">Max</button>';
}

function htmlShipyard() {
  var sys = G.systems[G.cur];
  var h = '<h3>Shipyard & Dock Services</h3>';
  var fp = fuelPrice(sys);
  var need = shipStat('fuel') - G.fuel;
  h += '<div class="card"><b>Refuel</b> — ' + fp + ' cr/unit here. ';
  if (need > 0.5) {
    h += '<button class="btn small" onclick="UI.refuel()">Fill tank (' +
      fmt(Math.min(need, Math.floor(G.credits / fp)) * fp) + ' cr)</button>';
  } else {
    h += '<span class="dim">Tank full.</span>';
  }
  h += '</div>';

  h += '<h4>Modules <span class="dim">(transfer between hulls)</span></h4>';
  for (var u in UPGRADES) {
    var up = UPGRADES[u];
    var rank = G.upgrades[u];
    h += '<div class="card"><b>' + up.name + '</b> <span class="dim">' + up.desc +
      '</span> — rank ' + rank + '/' + up.max + ' ';
    if (rank < up.max) {
      h += '<button class="btn small" onclick="UI.upgrade(\'' + u + '\')">Install — ' +
        fmt(upgradePrice(u)) + ' cr</button>';
    } else {
      h += '<span class="tag gold">maxed</span>';
    }
    h += '</div>';
  }

  h += '<h4>Hulls <span class="dim">(trade-in credit applied)</span></h4>';
  for (var hd in HULLS) {
    var hull = HULLS[hd];
    h += '<div class="card"><b>' + hull.name + '</b> <span class="dim">cargo ' + hull.cargo +
      ' · fuel ' + hull.fuel + ' · speed ' + hull.speed + ' · cannons ' + hull.cannons + '</span> ';
    if (hd === G.hull) {
      h += '<span class="tag gold">your ship</span>';
    } else {
      h += '<button class="btn small" onclick="UI.hull(\'' + hd + '\')">Trade up — ' +
        fmt(hullTradePrice(hd)) + ' cr</button>';
    }
    h += '</div>';
  }
  return h;
}

// Contract cards dispatch on ct.type — active cards are shared by the
// Contracts and Market tabs; offer cards by the Contracts tab. Each type
// writes only its lead; pay/rep/deadline formatting is shared.
function skullsHtml(n) {
  return '<span class="risk-hi">' + '☠'.repeat(n) + '</span>';
}

function payRepHtml(ct) {
  return 'pays <b>' + fmt(ct.pay) + ' cr</b> +' + ct.rep + ' ' + FACTIONS[ct.faction].name + ' rep';
}

function deadlineHtml(ct) {
  var left = ct.deadline - G.day;
  return '<span class="' + (left <= 2 ? 'risk-hi' : '') + '">' + left + 'd left</span>';
}

function offerTailHtml(ct, here) {
  return ' <span class="dim">(' + Math.round(dist(here, G.systems[ct.dest])) +
    ' ly)</span> · pays <b>' + fmt(ct.pay) + ' cr</b> · due day ' + ct.deadline +
    ' <button class="btn small" onclick="UI.accept(\'' + ct.id + '\')">Accept</button></div>';
}

function activeHaulCard(ct) {
  var here = ct.dest === G.cur;
  var enough = (G.cargo[ct.good] || 0) >= ct.qty;
  var h = '<div class="card"><b>' + ct.qty + ' ' + GOODS[ct.good].name + '</b> → ' +
    esc(G.systems[ct.dest].name) + ' · ' + payRepHtml(ct) + ' · ' + deadlineHtml(ct) + ' ';
  if (here && enough) {
    h += '<button class="btn small primary" onclick="UI.deliver(\'' + ct.id + '\')">Deliver</button>';
  } else if (here) {
    h += '<span class="dim">need ' + (ct.qty - (G.cargo[ct.good] || 0)) + ' more in hold</span>';
  }
  return h + '</div>';
}

function activeHuntCard(ct) {
  var h = '<div class="card"><b>Hunt ' + esc(ct.gang) + '</b> ' + skullsHtml(ct.str) + ' → ' +
    esc(G.systems[ct.dest].name) + ' · ' + payRepHtml(ct) + ' · ' + deadlineHtml(ct) + ' ';
  h += ct.dest === G.cur ?
    '<span class="dim">they slipped you — leave and return to re-engage</span>' :
    '<span class="dim">fly there; they\'ll find you</span>';
  return h + '</div>';
}

var ACTIVE_CARD = { haul: activeHaulCard, hunt: activeHuntCard };

function activeContractCard(ct) { return ACTIVE_CARD[ct.type](ct); }

function offerHaulCard(ct, here) {
  return '<div class="card"><b>' + ct.qty + ' ' + GOODS[ct.good].name + '</b> → ' +
    esc(G.systems[ct.dest].name) + offerTailHtml(ct, here);
}

function offerHuntCard(ct, here) {
  return '<div class="card"><b>Bounty: ' + esc(ct.gang) + '</b> ' + skullsHtml(ct.str) +
    ' at ' + esc(G.systems[ct.dest].name) + offerTailHtml(ct, here);
}

var OFFER_CARD = { haul: offerHaulCard, hunt: offerHuntCard };

function htmlContracts() {
  var h = '<h3>Active Contracts <span class="dim">(' + G.active.length + '/3)</span></h3>';
  if (!G.active.length) h += '<div class="dim">None. Accept offers below — deadlines are real.</div>';
  G.active.forEach(function (ct) { h += activeContractCard(ct); });

  var here = G.systems[G.cur];
  h += '<h3>Offers at ' + esc(here.name) + ' <span class="dim">(tier ' +
    contractTier(here.faction) + ' — rep with ' + FACTIONS[here.faction].name + ' unlocks bigger jobs)</span></h3>';
  var offers = localOffers();
  if (!offers.length) h += '<div class="dim">The board is empty today.</div>';
  offers.forEach(function (ct) { h += OFFER_CARD[ct.type](ct, here); });
  return h;
}

function htmlCantina() {
  var h = '<h3>The Cantina</h3>';
  h += '<div class="card">Dock workers, drunk navigators, spice runners. Somebody always knows something.<br><br>' +
    '<button class="btn primary" onclick="UI.rumor()">Buy a round & listen — 30 cr</button>' +
    '<div class="hint">~85% of rumors are good: they reveal an event somewhere (famines, plagues, booms) and chart the system. The rest chart somewhere new at best.</div></div>';
  h += '<div class="card"><b>Known events</b><br>';
  var any = false;
  G.systems.forEach(function (sys) {
    if (!eventKnown(sys)) return;
    any = true;
    h += '⚠ <b>' + esc(sys.name) + '</b>: ' + EVENTS[sys.event.type].name + ' (~' +
      sys.event.daysLeft + 'd left) <button class="btn tiny" onclick="UI.select(' + sys.id +
      ')">map</button><br>';
  });
  if (!any) h += '<span class="dim">Nothing on the wire. Buy a rumor or fly and find out.</span>';
  h += '</div>';
  return h;
}

function htmlAssets() {
  var sys = G.systems[G.cur];
  var h = '<h3>Your Ship — ' + HULLS[G.hull].name + '</h3>';
  h += '<div class="card">Cargo ' + cargoUsed() + '/' + shipStat('cargo') +
    ' · Fuel ' + Math.round(G.fuel) + '/' + shipStat('fuel') +
    ' · Speed ' + shipStat('speed') + ' · Weapons ' + shipStat('weapons') +
    ' · Scanner ' + shipStat('scanner') + '<br>Ship value ~' + fmt(shipValue()) + ' cr</div>';

  h += '<h3>Outposts <span class="dim">(' + G.systems.filter(function (s) { return s.outpost; }).length + ')</span></h3>';
  var err = canBuyOutpost(sys);
  h += '<div class="card">Outpost at <b>' + esc(sys.name) + '</b>: ' + fmt(outpostPrice(sys)) +
    ' cr → ' + (sys.wealth * 18) + ' cr/day, live prices, 80-unit warehouse.<br>';
  if (err) h += '<span class="dim">' + err + '</span>';
  else h += '<button class="btn primary small" onclick="UI.outpost()">Establish outpost</button>';
  h += '</div>';

  G.systems.forEach(function (s) {
    if (!s.outpost) return;
    h += '<div class="card"><b>▲ ' + esc(s.name) + '</b> — ' + (s.wealth * 18) +
      ' cr/day · warehouse ' + warehouseUsed(s) + '/80 ' +
      '<button class="btn tiny" onclick="UI.select(' + s.id + ')">map</button>';
    if (s.id === G.cur) {
      h += '<table class="market"><tr><th>Good</th><th>Stored</th><th></th><th></th></tr>';
      GOOD_IDS.forEach(function (g) {
        var w = s.warehouse[g];
        var stored = w ? w.qty : 0;
        var have = G.cargo[g] || 0;
        if (!stored && !have) return;
        h += '<tr><td>' + GOODS[g].name + '</td><td>' +
          (stored ? stored + ' <span class="dim">@' + Math.round(w.avg) + '</span>' : '—') + '</td>' +
          '<td class="acts">' + (have ? '<button class="btn tiny" onclick="UI.deposit(\'' + g +
            '\')">Store all</button>' : '') + '</td>' +
          '<td class="acts">' + (stored ? '<button class="btn tiny" onclick="UI.withdraw(\'' + g +
            '\')">Load all</button>' : '') + '</td></tr>';
      });
      h += '</table>';
    } else {
      var wh = [];
      for (var g in s.warehouse) {
        wh.push(s.warehouse[g].qty + ' ' + GOODS[g].name + ' @' + Math.round(s.warehouse[g].avg));
      }
      if (wh.length) h += '<div class="dim">Stored: ' + wh.join(', ') + '</div>';
    }
    h += '</div>';
  });

  h += '<h3>Career</h3>';
  h += '<div class="card">Total trading profit ' + fmt(G.stats.profit) + ' cr · Systems surveyed ' +
    G.stats.systemsFound + ' · Contracts done ' + G.stats.contractsDone +
    ' · Pirates beaten ' + G.stats.piratesBeaten + ' · Spice runs ' + G.stats.spiceRuns + '</div>';
  var pts = legacyPointsForWorth(netWorth());
  h += '<div class="card"><b>Retire</b> — convert net worth (' + fmt(netWorth()) + ' cr) into <b>' +
    pts + ' legacy points</b> for permanent perks in every future galaxy. ' +
    '<button class="btn warn small" onclick="UI.retire()">Retire captain</button></div>';
  return h;
}

function htmlFactions() {
  var h = '<h3>Standing</h3>';
  for (var f in FACTIONS) {
    var rep = G.rep[f];
    var tier = REP_TIERS[repTierIdx(f)].name;
    var pct = Math.round((rep + 100) / 2);
    h += '<div class="card"><b style="color:' + FACTIONS[f].color + '">' + FACTIONS[f].name +
      '</b> — ' + tier + ' (' + rep + ')' +
      '<div class="rep-bar"><div class="rep-fill" style="width:' + pct + '%;background:' +
      FACTIONS[f].color + '"></div></div>';
    if (f === 'guild') h += '<span class="dim">Core worlds, high security, thin margins. Rep from contracts, surveys, fighting pirates. They scan for spice.</span>';
    if (f === 'colonies') h += '<span class="dim">Mid-rim settlers. Tolerant, hungry for goods. Rep from contracts.</span>';
    if (f === 'syndicate') h += '<span class="dim">Fringe operators. Cheap spice, dangerous lanes. Rep from spice runs and bribes.</span>';
    h += '</div>';
  }
  h += '<div class="hint">Rep raises your sell prices in that faction\'s space (+1% per 10 rep), unlocks contract tiers at 20 and 50, and outposts at 40.</div>';
  return h;
}

// ---------- Log ----------

function renderLog() {
  var el = $('log');
  var h = '';
  G.log.slice(0, 40).forEach(function (l) {
    h += '<div class="log-line"><span class="log-day">d' + l.day + '</span> ' + esc(l.msg) + '</div>';
  });
  el.innerHTML = h;
}

// ---------- Actions (called from generated HTML) ----------

UI.select = function (id) { UI.selected = id; centerOn(G.systems[id]); renderAll(); };

UI.buy = function (g, q) {
  var err = buyGood(g, q);
  if (err) uiToast(err);
  renderAll();
};

UI.sell = function (g, q) {
  var err = sellGood(g, q);
  if (err) uiToast(err);
  renderAll();
};

UI.refuel = function () { refuel(); renderAll(); };

UI.upgrade = function (u) {
  var err = buyUpgrade(u);
  if (err) uiToast(err);
  renderAll();
};

UI.hull = function (h) {
  var err = buyHull(h);
  if (err) uiToast(err);
  renderAll();
};

UI.accept = function (id) {
  var err = acceptContract(id);
  if (err) uiToast(err);
  renderAll();
};

UI.deliver = function (id) {
  var err = deliverContract(id);
  if (err) uiToast(err);
  renderAll();
};

UI.rumor = function () {
  var r = buyRumor();
  if (r.err) uiToast(r.err);
  if (r.msg) showModal('Cantina', '<p>' + esc(r.msg) + '</p>');
  renderAll();
};

UI.outpost = function () {
  var err = buyOutpost();
  if (err) uiToast(err);
  renderAll();
};

UI.deposit = function (g) { depositGood(g, 9999); renderAll(); };
UI.withdraw = function (g) { withdrawGood(g, 9999); renderAll(); };

UI.tow = function () { distressTow(); renderAll(); };

UI.travel = function (id) {
  var res = travelTo(id);
  if (typeof res === 'string') { uiToast(res); renderAll(); return; }
  if (res && res.encounter) {
    var e = res.encounter;
    UI.encounter = e;
    var skulls = '☠'.repeat(e.str);
    showModal(
      'Pirates! ' + esc(e.name) + ' <span class="dim">' + skulls + '</span>',
      '<p>Warning klaxons. ' + esc(e.name) + ' drop out of the dark on an intercept course. ' +
      'Your hold carries ~' + fmt(cargoValue()) + ' cr of goods.</p>',
      [
        { label: 'Fight', sub: Math.round(e.fightOdds * 100) + '% win', fn: function () { UI.resolve('fight'); } },
        { label: 'Flee', sub: Math.round(e.fleeOdds * 100) + '% escape', fn: function () { UI.resolve('flee'); } },
        { label: 'Bribe', sub: fmt(e.bribe) + ' cr', fn: function () { UI.resolve('bribe'); } },
        { label: 'Surrender', sub: 'lose ~45% cargo', cls: 'warn', fn: function () { UI.resolve('surrender'); } }
      ],
      { lock: true }
    );
    return;
  }
  afterArrival();
};

UI.resolve = function (choice) {
  var msg = resolveEncounter(UI.encounter, choice);
  UI.encounter = null;
  showModal('Aftermath', '<p>' + esc(msg) + '</p>', [{ label: 'Continue', fn: afterArrival }]);
};

function afterArrival() {
  var caught = customsScan();
  UI.selected = G.cur;
  centerOn(G.systems[G.cur]);
  renderAll();
  if (caught) showModal('Customs', '<p>' + esc(caught) + '</p>');
}

UI.retire = function () {
  var worth = netWorth();
  var pts = legacyPointsForWorth(worth);
  showModal('Retire?',
    '<p>Captain ' + esc(G.captain) + ' steps down with a net worth of <b>' + fmt(worth) +
    ' cr</b> after ' + G.day + ' days — earning <b>' + pts + ' legacy points</b>.</p>' +
    '<p class="dim">Legacy points buy permanent perks for every future captain. This galaxy will be gone for good.</p>',
    [
      { label: 'Retire — claim ' + pts + ' ☆', cls: 'warn', fn: function () { retire(); showNewGame(false); } },
      { label: 'Keep flying' }
    ]);
};

// ---------- New game / legacy shop ----------

function showNewGame(firstEver) {
  var h = '';
  if (firstEver) {
    h += '<p><b>STARLANE</b> — buy low, fly far, sell high. Chart the frontier, run contracts, ' +
      'build outposts, and retire rich enough that your next captain starts richer.</p>';
  }
  if (LEGACY.hall.length) {
    h += '<div class="card"><b>Hall of Fame</b><br>';
    LEGACY.hall.slice(0, 5).forEach(function (r) {
      h += '<span class="dim">' + esc(r.captain) + ' — ' + esc(r.title) + ', ' + fmt(r.worth) +
        ' cr in ' + r.days + ' days (+' + r.pts + ' ☆)</span><br>';
    });
    h += '</div>';
  }
  h += '<div class="card"><b>Legacy perks</b> — points: <b id="perk-pts">' + LEGACY.points + '</b> ☆<div id="perk-list">';
  h += perkListHtml();
  h += '</div></div>';
  h += '<div class="field"><label>Captain name</label><input id="ng-name" value="' +
    esc(CAPTAIN_NAMES[Math.floor(Math.random() * CAPTAIN_NAMES.length)]) + '"></div>';
  h += '<div class="field"><label>Galaxy seed <span class="dim">(blank = random; same seed = same galaxy)</span></label>' +
    '<input id="ng-seed" placeholder="random"></div>';

  showModal(firstEver ? 'Welcome to STARLANE' : 'A new captain rises', h,
    [{ label: 'Launch', cls: 'primary', keepOpen: true, fn: function () {
      var name = $('ng-name').value.trim() || 'Captain';
      var seed = $('ng-seed').value;
      hideModal();
      newGame(seed, name);
      UI.selected = G.cur;
      UI.tab = 'market';
      centerOn(G.systems[G.cur]);
      renderAll();
      if (firstEver) showHelp();
    } }],
    { lock: true });
}

function perkListHtml() {
  var h = '';
  for (var p in PERKS) {
    var pk = PERKS[p];
    var rank = perkRank(p);
    h += '<div class="perk-row"><b>' + pk.name + '</b> <span class="dim">' + pk.desc +
      '</span> — ' + rank + '/' + pk.max + ' ';
    if (rank < pk.max) {
      h += '<button class="btn tiny" onclick="UI.perk(\'' + p + '\')">Buy — ' + pk.cost + ' ☆</button>';
    } else {
      h += '<span class="tag gold">max</span>';
    }
    h += '</div>';
  }
  return h;
}

UI.perk = function (p) {
  if (buyPerk(p)) {
    $('perk-pts').textContent = LEGACY.points;
    $('perk-list').innerHTML = perkListHtml();
  } else {
    uiToast('Not enough legacy points (or maxed).');
  }
};

// ---------- Help ----------

function showHelp() {
  showModal('How to thrive',
    '<p><b>Trade:</b> every system produces some goods cheap and craves others. Click a system on the map to see its last-known prices — intel goes stale, so what you know is worth money. Your own trades move prices, so spread your business around.</p>' +
    '<p><b>Explore:</b> the fuel ring shows your reach. First dockings pay survey bonuses, and the frontier has the fattest spreads — and the worst pirates. Scanners chart further.</p>' +
    '<p><b>Reputation:</b> contracts, surveys, and pirate kills build faction rep. Rep means better sell prices, bigger contracts (tiers at 20/50), and outpost rights (40).</p>' +
    '<p><b>Build:</b> outposts pay daily income, stream live prices, and hold 80 units of warehouse stock — stockpile cheap, wait for a famine, sell the spike.</p>' +
    '<p><b>Watch for:</b> events (⚠) that spike prices, Void Spice (huge margins, illegal in Guild space), and pirates who scale with your net worth — wealth attracts sharks.</p>' +
    '<p><b>Retire</b> whenever you like: net worth becomes legacy points → permanent perks for every future run. Chase the Hall of Fame.</p>');
}

// ---------- Menu / boot ----------

UI.menu = function () {
  showModal('Menu',
    '<p class="dim">Galaxy seed: <b>' + esc(G.seed) + '</b> · Day ' + G.day + '</p>',
    [
      { label: 'How to play', fn: showHelp },
      { label: 'Abandon galaxy (no legacy)', cls: 'warn', fn: function () {
        showModal('Abandon?', '<p>Scuttle this run with <b>no</b> legacy points? (Retiring from the Assets tab pays out.)</p>', [
          { label: 'Abandon', cls: 'warn', fn: function () { abandonGame(); showNewGame(false); } },
          { label: 'Cancel' }
        ]);
      } },
      { label: 'Close' }
    ]);
};

window.addEventListener('DOMContentLoaded', function () {
  loadLegacy();
  buildMapTools();
  $('map').addEventListener('click', mapClick);
  bindMapPan($('map'));
  $('hd-help').onclick = function () { showHelp(); };
  $('hd-menu').onclick = function () { UI.menu(); };
  $('modal-back').addEventListener('click', function (ev) {
    if (ev.target === $('modal-back') && !UI.modalLock) hideModal();
  });
  if (loadGame()) {
    UI.selected = G.cur;
    centerOn(G.systems[G.cur]);
    renderAll();
  } else {
    showNewGame(true);
  }
});
