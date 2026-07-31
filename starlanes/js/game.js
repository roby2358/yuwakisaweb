// STARLANE — game state and engine. No rendering here; ui.js reads G and calls these.
'use strict';

var G = null;      // current game state
var LEGACY = null; // persists across galaxies

var SAVE_KEY = 'starlane_save_v1';
var LEGACY_KEY = 'starlane_legacy_v1';

// ---------- RNG ----------

function hashSeed(str) {
  var h = 1779033703 ^ str.length;
  for (var i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Non-seeded rolls (encounters, drift) — variety is the point, so Math.random is fine.
function roll() { return Math.random(); }
function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---------- Legacy (meta-progression) ----------

function loadLegacy() {
  try {
    LEGACY = JSON.parse(localStorage.getItem(LEGACY_KEY)) || null;
  } catch (e) { LEGACY = null; }
  if (!LEGACY) LEGACY = { points: 0, perks: {}, hall: [] };
  if (!LEGACY.perks) LEGACY.perks = {};
  if (!LEGACY.hall) LEGACY.hall = [];
}

function saveLegacy() {
  localStorage.setItem(LEGACY_KEY, JSON.stringify(LEGACY));
}

function perkRank(id) { return LEGACY.perks[id] || 0; }

function buyPerk(id) {
  var p = PERKS[id];
  if (!p || perkRank(id) >= p.max || LEGACY.points < p.cost) return false;
  LEGACY.points -= p.cost;
  LEGACY.perks[id] = perkRank(id) + 1;
  saveLegacy();
  return true;
}

// ---------- Galaxy generation ----------

function newGame(seedStr, captain) {
  var seed = (seedStr && seedStr.trim()) || String(Math.floor(Math.random() * 1e9));
  var rng = mulberry32(hashSeed(seed));

  G = {
    seed: seed,
    captain: captain || pick(rng, CAPTAIN_NAMES),
    day: 1,
    credits: 500 + perkRank('inheritance') * 1500,
    hull: 'rustbucket',
    upgrades: { cargo: 0, fuel: 0, engine: 0, weapons: 0, scanner: 0 },
    fuel: 0,
    cargo: {},        // good -> qty
    avgCost: {},      // good -> average paid per unit
    rep: { guild: 0, colonies: 0, syndicate: 0 },
    systems: [],
    cur: 0,
    contracts: [],    // offers at current system
    active: [],       // accepted contracts
    log: [],
    milestones: {},
    stats: { profit: 0, systemsFound: 1, contractsDone: 0, piratesBeaten: 0, spiceRuns: 0 }
  };
  var startRep = perkRank('contacts') * 15;
  G.rep = { guild: startRep, colonies: startRep, syndicate: startRep };

  genGalaxy(rng);
  G.fuel = shipStat('fuel');
  var here = G.systems[G.cur];
  here.visited = true;
  chartSystems();
  snapshotPrices(here);
  genContracts();
  addLog('Day 1 — Captain ' + G.captain + ' takes the helm of a ' + HULLS[G.hull].name +
    ' docked at ' + here.name + '. Galaxy seed: ' + seed);
  saveGame();
}

var WORLD_SIZE = 200;  // world units per side
var WORLD_EDGE = 6;    // stars keep off the rim
var LINK_MAX = 28;     // widest gap growth may open at 1x spacing; under a Rustbucket tank (30)

// Spacing multiplier: 1x at the right edge rising to 2x at the left. The deep
// frontier spreads out until only long-range ships can cross it.
function spaceMult(x) {
  return 2 - x / WORLD_SIZE;
}

function genGalaxy(rng) {
  var names = SYSTEM_NAMES.slice(1);
  // shuffle names
  for (var i = names.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = names[i]; names[i] = names[j]; names[j] = t;
  }
  var count = 26;
  var pts = [{ x: 164, y: 100 }]; // home, right of center — the deep frontier lies leftward
  var tries = 0;
  while (pts.length < count && tries < 8000) {
    tries++;
    // Grow from a settled star: each new one lands within LINK_MAX (scaled by
    // local spacing) of its anchor, so the jump graph stays connected by
    // construction — at worst 2x LINK_MAX on the far left.
    var anchor = pts[Math.floor(rng() * pts.length)];
    var m = spaceMult(anchor.x);
    var base = 11 + rng() * 10;
    var ang = rng() * Math.PI * 2;
    var rad = (base + rng() * (LINK_MAX - base)) * m;
    var p = { x: anchor.x + Math.cos(ang) * rad, y: anchor.y + Math.sin(ang) * rad };
    if (p.x < WORLD_EDGE || p.x > WORLD_SIZE - WORLD_EDGE) continue;
    if (p.y < WORLD_EDGE || p.y > WORLD_SIZE - WORLD_EDGE) continue;
    var need = base * spaceMult(p.x);
    var ok = true;
    for (var k = 0; k < pts.length; k++) {
      var dx = pts[k].x - p.x, dy = pts[k].y - p.y;
      if (dx * dx + dy * dy < need * need) { ok = false; break; }
    }
    if (ok) pts.push(p);
  }
  var ecoIds = Object.keys(ECONOMIES);
  for (var s = 0; s < pts.length; s++) {
    var d = dist(pts[0], pts[s]); // distance from home drives faction + wealth
    var faction = d < 32 ? 'guild' : (d < 62 ? 'colonies' : 'syndicate');
    if (s > 0 && rng() < 0.15) faction = pick(rng, ['guild', 'colonies', 'syndicate']);
    var wealth = faction === 'guild' ? randInt(rng, 2, 3) :
                 faction === 'colonies' ? randInt(rng, 1, 3) : randInt(rng, 1, 2);
    var sys = {
      id: s,
      name: s === 0 ? 'Hearth' : names.pop(),
      x: pts[s].x, y: pts[s].y,
      faction: faction,
      economy: s === 0 ? 'agri' : pick(rng, ecoIds),
      wealth: wealth,
      charted: false,
      visited: false,
      event: null,           // {type, daysLeft}
      outpost: false,
      warehouse: {},         // good -> { qty, avg paid } (only used if outpost)
      lastSeen: null,        // {day, prices:{good:price}}
      mkt: {}
    };
    for (var g = 0; g < GOOD_IDS.length; g++) {
      var gid = GOOD_IDS[g];
      var cap = stockCap(sys, gid);
      sys.mkt[gid] = {
        drift: 0.85 + rng() * 0.5,
        imp: 0,
        stock: Math.round(cap * (0.5 + rng() * 0.5))
      };
    }
    G.systems.push(sys);
  }
}

function dist(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------- Ship stats ----------

function shipStat(stat) {
  var h = HULLS[G.hull];
  if (stat === 'cargo')  return h.cargo + G.upgrades.cargo * UPGRADES.cargo.delta + perkRank('holds') * 8;
  if (stat === 'fuel')   return h.fuel + G.upgrades.fuel * UPGRADES.fuel.delta;
  if (stat === 'speed')  return h.speed + G.upgrades.engine * UPGRADES.engine.delta;
  if (stat === 'weapons') return h.cannons + G.upgrades.weapons;
  if (stat === 'scanner') return 1 + G.upgrades.scanner;
  return 0;
}

function cargoUsed() {
  var n = 0;
  for (var g in G.cargo) n += G.cargo[g];
  return n;
}

function cargoValue() {
  var v = 0;
  for (var g in G.cargo) v += G.cargo[g] * (G.avgCost[g] || GOODS[g].base);
  return v;
}

function shipValue() {
  var v = HULLS[G.hull].cost;
  for (var u in G.upgrades) {
    for (var i = 0; i < G.upgrades[u]; i++) v += UPGRADES[u].base * Math.pow(2, i) * 0.6;
  }
  return Math.round(v);
}

function outpostValue() {
  var v = 0;
  for (var i = 0; i < G.systems.length; i++) {
    var s = G.systems[i];
    if (s.outpost) {
      v += 5000 * s.wealth;
      for (var g in s.warehouse) v += s.warehouse[g].qty * GOODS[g].base * 0.8;
    }
  }
  return Math.round(v);
}

function netWorth() {
  return Math.round(G.credits + cargoValue() + shipValue() * 0.7 + outpostValue());
}

function titleFor(worth) {
  var t = TITLES[0].name;
  for (var i = 0; i < TITLES.length; i++) if (worth >= TITLES[i].min) t = TITLES[i].name;
  return t;
}

// ---------- Prices ----------

function econMod(sys, good) {
  var mods = ECONOMIES[sys.economy].mods;
  var m = mods[good] ? mods[good][0] : DEFAULT_MOD[0];
  // Spice supply/demand is faction-driven, not economy-driven.
  if (good === 'spice') m = sys.faction === 'syndicate' ? 0.5 : 1.5;
  // Wealthy systems pay extra for luxuries.
  if (good === 'lux' && m >= 1) m += (sys.wealth - 1) * 0.15;
  return m;
}

function stockCap(sys, good) {
  if (good === 'spice') return sys.faction === 'syndicate' ? 80 : 50;
  var mods = ECONOMIES[sys.economy].mods;
  return mods[good] ? mods[good][1] : DEFAULT_MOD[1];
}

function eventMult(sys, good) {
  if (!sys.event) return 1;
  var ev = EVENTS[sys.event.type];
  return ev.mult[good] || 1;
}

function priceOf(sys, good) {
  var m = sys.mkt[good];
  var wealthMod = 1 + (sys.wealth - 2) * 0.05;
  var p = GOODS[good].base * econMod(sys, good) * wealthMod * eventMult(sys, good) *
          m.drift * (1 + m.imp);
  return Math.max(1, Math.round(p));
}

function sellPriceOf(sys, good) {
  // Dealers keep a 10% spread; faction standing narrows it (never past parity —
  // combined with per-unit execution this kills same-port buy/sell money pumps).
  var bonus = 0.90 * (1 + Math.max(0, Math.min(100, G.rep[sys.faction])) * 0.001);
  return Math.max(1, Math.floor(priceOf(sys, good) * bonus));
}

function canTradeGood(sys, good) {
  // Guild customs keep spice off the open market in their space.
  return !(GOODS[good].illegal && sys.faction === 'guild');
}

function snapshotPrices(sys) {
  var prices = {};
  for (var i = 0; i < GOOD_IDS.length; i++) {
    var g = GOOD_IDS[i];
    prices[g] = { buy: priceOf(sys, g), sell: sellPriceOf(sys, g), stock: sys.mkt[g].stock };
  }
  sys.lastSeen = { day: G.day, prices: prices, event: sys.event ? sys.event.type : null };
}

function fuelPrice(sys) {
  return Math.max(2, 5 - sys.wealth);
}

// ---------- Charting / exploration ----------

function chartRange() {
  return 24 + shipStat('scanner') * 6 + perkRank('charts') * 8;
}

function chartSystems() {
  var r = chartRange();
  for (var i = 0; i < G.systems.length; i++) {
    var s = G.systems[i];
    if (s.charted) continue;
    for (var j = 0; j < G.systems.length; j++) {
      if (G.systems[j].visited && dist(s, G.systems[j]) <= r) { s.charted = true; break; }
    }
  }
}

// ---------- Trading ----------

function buyGood(good, qty) {
  var sys = G.systems[G.cur];
  if (!canTradeGood(sys, good)) return 'Not sold on the open market here.';
  var m = sys.mkt[good];
  qty = Math.min(qty, m.stock, shipStat('cargo') - cargoUsed());
  if (qty <= 0) return 'No room or no stock.';
  // Per-unit execution: each unit trades at the current marginal price, and each
  // unit bought pushes the price up before the next one. Big orders cost more.
  var cost = 0, bought = 0, cap = stockCap(sys, good);
  while (bought < qty) {
    var p = priceOf(sys, good);
    if (G.credits - cost < p) break;
    cost += p;
    bought++;
    m.stock--;
    m.imp = Math.min(0.5, m.imp + TRADE_IMPACT / cap); // you drained the market
  }
  if (bought <= 0) return 'Not enough credits.';
  G.credits -= cost;
  var had = G.cargo[good] || 0;
  G.avgCost[good] = ((G.avgCost[good] || 0) * had + cost) / (had + bought);
  G.cargo[good] = had + bought;
  snapshotPrices(sys);
  addLog('Bought ' + bought + ' ' + GOODS[good].name + ' for ' + cost + ' cr (avg ' +
    Math.round(cost / bought) + ').');
  saveGame();
  return null;
}

function sellGood(good, qty) {
  var sys = G.systems[G.cur];
  if (!canTradeGood(sys, good)) return 'No legal buyers here. (Guild space scans for spice.)';
  qty = Math.min(qty, G.cargo[good] || 0);
  if (qty <= 0) return 'Nothing to sell.';
  // Per-unit execution mirrors buying: each unit sold pushes the price down.
  var m = sys.mkt[good], cap = stockCap(sys, good);
  var revenue = 0;
  for (var u = 0; u < qty; u++) {
    m.stock++;
    m.imp = Math.max(-0.5, m.imp - TRADE_IMPACT / cap); // you flooded the market
    revenue += sellPriceOf(sys, good);         // executed at the post-impact price
  }
  var price = Math.round(revenue / qty);
  var profit = revenue - (G.avgCost[good] || 0) * qty;
  G.credits += revenue;
  G.stats.profit += profit;
  G.cargo[good] -= qty;
  if (G.cargo[good] <= 0) { delete G.cargo[good]; delete G.avgCost[good]; }
  if (good === 'spice' && sys.faction !== 'syndicate') {
    G.rep.syndicate = clampRep(G.rep.syndicate + Math.min(5, Math.ceil(qty / 5)));
    G.stats.spiceRuns++;
  }
  snapshotPrices(sys);
  addLog('Sold ' + qty + ' ' + GOODS[good].name + ' @ ' + price + ' cr (' +
    (profit >= 0 ? '+' : '') + Math.round(profit) + ' profit).');
  checkMilestones();
  saveGame();
  return null;
}

function refuel(amount) {
  var sys = G.systems[G.cur];
  var need = shipStat('fuel') - G.fuel;
  amount = Math.min(amount == null ? need : amount, need);
  var price = fuelPrice(sys);
  amount = Math.min(amount, Math.floor(G.credits / price));
  if (amount <= 0) return;
  G.credits -= amount * price;
  G.fuel += amount;
  saveGame();
}

function clampRep(v) { return Math.max(-100, Math.min(100, v)); }

// ---------- Travel ----------

function fuelCostTo(sys) {
  var d = dist(G.systems[G.cur], sys);
  return Math.max(1, Math.round(d * (1 - perkRank('drives') * 0.10)));
}

function travelDays(sys) {
  return Math.max(1, Math.ceil(dist(G.systems[G.cur], sys) / (10 * shipStat('speed'))));
}

function routeRisk(sys) {
  var a = G.systems[G.cur], b = sys;
  var danger = 1 - (FACTIONS[a.faction].security + FACTIONS[b.faction].security) / 2;
  if (a.event && EVENTS[a.event.type].danger) danger += EVENTS[a.event.type].danger;
  if (b.event && EVENTS[b.event.type].danger) danger += EVENTS[b.event.type].danger;
  var greed = 0.15 + Math.min(0.25, cargoValue() / 20000); // rich holds attract sharks
  return Math.min(0.75, danger * greed + 0.02);
}

function scanRisk(sys) {
  if (sys.faction !== 'guild' || !(G.cargo.spice > 0)) return 0;
  var r = 0.65 - shipStat('scanner') * 0.10 - perkRank('nerve') * 0.15;
  return Math.max(0.05, r);
}

// Returns {encounter} if pirates interrupt; ui shows the modal, then calls resolveEncounter.
var pendingTravel = null;

function travelTo(id) {
  var sys = G.systems[id];
  var cost = fuelCostTo(sys);
  if (cost > G.fuel) return 'Not enough fuel.';
  var risk = routeRisk(sys);
  G.fuel -= cost;
  pendingTravel = { dest: id, days: travelDays(sys) };
  addLog('Departing ' + G.systems[G.cur].name + ' for ' + sys.name + ' (' +
    pendingTravel.days + 'd, ' + cost + ' fuel).');
  var hunt = huntContractAt(id);
  if (hunt) {
    var he = makeEncounter(hunt.str);
    he.name = hunt.gang;
    he.hunt = hunt.id;
    return { encounter: he };
  }
  if (roll() < risk) {
    var tier = Math.min(4, Math.floor(netWorth() / 25000));
    var str = 1 + tier + (roll() < 0.3 ? 1 : 0);
    return { encounter: makeEncounter(str) };
  }
  finishTravel();
  return null;
}

function makeEncounter(str) {
  var e = {
    name: PIRATE_BANDS[Math.floor(roll() * PIRATE_BANDS.length)],
    str: str,
    fightOdds: shipStat('weapons') / (shipStat('weapons') + str),
    fleeOdds: Math.max(0.1, Math.min(0.9, 0.35 + 0.18 * shipStat('speed') - 0.05 * str)),
    bribe: Math.max(150, Math.round(cargoValue() * 0.25 + G.credits * 0.05))
  };
  return e;
}

function resolveEncounter(e, choice) {
  var msg;
  if (choice === 'fight') {
    if (roll() < e.fightOdds) {
      var loot = Math.round(150 * (e.str + 1) + roll() * 300);
      G.credits += loot;
      G.rep.guild = clampRep(G.rep.guild + 3);
      G.stats.piratesBeaten++;
      msg = 'Your cannons tear through ' + e.name + '. Salvage nets ' + loot +
        ' cr, and the Guild takes note (+3 rep).';
      if (e.hunt) msg += ' ' + completeHunt(e.hunt);
    } else {
      msg = loseCargo(0.5, e.name + ' outgun you and strip half your hold.');
    }
  } else if (choice === 'flee') {
    if (roll() < e.fleeOdds) {
      msg = 'You burn hard and slip ' + e.name + ' in an asteroid shadow.';
    } else {
      msg = loseCargo(0.35, 'They run you down. ' + e.name + ' take a third of your cargo as "toll."');
    }
  } else if (choice === 'bribe') {
    var pay = Math.min(e.bribe, G.credits);
    G.credits -= pay;
    G.rep.syndicate = clampRep(G.rep.syndicate + 1);
    msg = 'You transfer ' + pay + ' cr. ' + e.name + ' wave you through with mock salutes.';
    if (pay < e.bribe) msg = 'Your credits don\'t cover the toll. ' + loseCargo(0.2, 'They take the difference in cargo.');
  } else { // surrender
    msg = loseCargo(0.45, 'You cut engines. ' + e.name + ' take what they want and leave you drifting.');
  }
  addLog(msg);
  finishTravel();
  return msg;
}

function loseCargo(frac, prefix) {
  var taken = [];
  for (var g in G.cargo) {
    var n = Math.ceil(G.cargo[g] * frac);
    if (n > 0) {
      G.cargo[g] -= n;
      if (G.cargo[g] <= 0) { delete G.cargo[g]; delete G.avgCost[g]; }
      taken.push(n + ' ' + GOODS[g].name);
    }
  }
  return prefix + (taken.length ? ' Lost: ' + taken.join(', ') + '.' : ' (Your hold was empty — they leave cursing.)');
}

function finishTravel() {
  var t = pendingTravel;
  pendingTravel = null;
  if (!t) return;
  tickDays(t.days);
  G.cur = t.dest;
  var sys = G.systems[G.cur];
  var arrivalNotes = [];
  if (!sys.visited) {
    sys.visited = true;
    G.stats.systemsFound++;
    var bonus = 100 + Math.round(dist(G.systems[0], sys) * 3);
    G.credits += bonus;
    G.rep.guild = clampRep(G.rep.guild + 2);
    arrivalNotes.push('First survey of ' + sys.name + ' — the Guild pays ' + bonus + ' cr for your charts (+2 Guild rep).');
    chartSystems();
  }
  if (sys.event) {
    sys.event.known = true;
    arrivalNotes.push(EVENTS[sys.event.type].name + ' in ' + sys.name + ': ' +
      EVENTS[sys.event.type].news + ' (~' + sys.event.daysLeft + ' days left).');
  }
  snapshotPrices(sys);
  genContracts();
  for (var i = 0; i < arrivalNotes.length; i++) addLog(arrivalNotes[i]);
  addLog('Docked at ' + sys.name + ', day ' + G.day + '.');
  checkMilestones();
  saveGame();
}

// Customs scan on arrival in Guild space with spice aboard. ui calls this and shows result.
function customsScan() {
  var sys = G.systems[G.cur];
  var risk = scanRisk(sys);
  if (risk <= 0 || roll() >= risk) return null;
  var qty = G.cargo.spice;
  delete G.cargo.spice;
  delete G.avgCost.spice;
  var fine = Math.min(G.credits, 300 + qty * 40);
  G.credits -= fine;
  G.rep.guild = clampRep(G.rep.guild - 15);
  var msg = 'Customs sweep! Guild inspectors confiscate ' + qty +
    ' Void Spice and fine you ' + fine + ' cr (-15 Guild rep).';
  addLog(msg);
  saveGame();
  return msg;
}

// Distress tow — the "never stuck" guarantee.
function canReach(fuel) {
  for (var i = 0; i < G.systems.length; i++) {
    if (i !== G.cur && G.systems[i].charted && fuelCostTo(G.systems[i]) <= fuel) return true;
  }
  return false;
}

// The best tank refueling here on your own credits can buy.
function bestFuelHere() {
  var afford = Math.floor(G.credits / fuelPrice(G.systems[G.cur]));
  return Math.min(shipStat('fuel'), G.fuel + afford);
}

// Truly pinned: even a maxed-out refuel leaves every charted system out of range.
function strandedHere() {
  return !canReach(bestFuelHere());
}

function distressTow() {
  var sys = G.systems[G.cur];
  var cost = Math.min(300, G.credits);
  G.credits -= cost;
  if (cost < 300) {
    G.rep.guild = clampRep(G.rep.guild - 5);
    addLog('A Guild tug tops off your tanks on credit you don\'t have (-5 Guild rep).');
  } else {
    addLog('A Guild tug tops off your tanks for ' + cost + ' cr.');
  }
  G.fuel = shipStat('fuel');
  saveGame();
}

// ---------- Time ----------

function tickDays(n) {
  for (var d = 0; d < n; d++) {
    G.day++;
    for (var i = 0; i < G.systems.length; i++) dayTickSystem(G.systems[i]);
    // Events: ~8%/day somewhere in the galaxy.
    if (roll() < 0.08) spawnEvent();
    // Outpost income + live intel.
    for (var j = 0; j < G.systems.length; j++) {
      if (G.systems[j].outpost) {
        G.credits += G.systems[j].wealth * 18;
      }
    }
    // Contract deadlines.
    for (var c = G.active.length - 1; c >= 0; c--) {
      var ct = G.active[c];
      if (G.day > ct.deadline) {
        G.rep[ct.faction] = clampRep(G.rep[ct.faction] - 8);
        addLog('Contract FAILED: ' + contractDesc(ct) + ' (-8 ' +
          FACTIONS[ct.faction].name + ' rep).');
        G.active.splice(c, 1);
      }
    }
  }
  // Outposts stream live prices.
  for (var k = 0; k < G.systems.length; k++) {
    if (G.systems[k].outpost) snapshotPrices(G.systems[k]);
  }
}

function dayTickSystem(sys) {
  for (var g = 0; g < GOOD_IDS.length; g++) {
    var gid = GOOD_IDS[g];
    var m = sys.mkt[gid];
    m.drift += (1 - m.drift) * 0.05 + (roll() - 0.5) * 0.06;
    m.drift = Math.max(0.65, Math.min(1.5, m.drift));
    m.imp *= 0.85;
    if (Math.abs(m.imp) < 0.01) m.imp = 0;
    var cap = stockCap(sys, gid);
    m.stock += Math.round((cap - m.stock) * 0.10);
  }
  if (sys.event) {
    sys.event.daysLeft--;
    if (sys.event.daysLeft <= 0) {
      if (sys.visited || sys.outpost) addLog('The ' + EVENTS[sys.event.type].name.toLowerCase() +
        ' in ' + sys.name + ' has ended.');
      sys.event = null;
    }
  }
}

function spawnEvent() {
  var candidates = [];
  for (var i = 0; i < G.systems.length; i++) if (!G.systems[i].event) candidates.push(G.systems[i]);
  if (!candidates.length) return;
  var sys = candidates[Math.floor(roll() * candidates.length)];
  var types = Object.keys(EVENTS);
  var type = types[Math.floor(roll() * types.length)];
  var dur = EVENTS[type].dur;
  sys.event = { type: type, daysLeft: dur[0] + Math.floor(roll() * (dur[1] - dur[0] + 1)), known: false };
  if (sys.outpost || sys.id === G.cur) {
    sys.event.known = true;
    addLog((sys.outpost ? 'Outpost report — ' : 'Local news — ') + EVENTS[type].name +
      ' in ' + sys.name + ': ' + EVENTS[type].news + '.');
  }
}

// ---------- Contracts ----------

function repTierIdx(faction) {
  var r = G.rep[faction], idx = 0;
  for (var i = 0; i < REP_TIERS.length; i++) if (r >= REP_TIERS[i].min) idx = i;
  return idx;
}

function contractTier(faction) {
  var r = G.rep[faction];
  return r >= 50 ? 3 : (r >= 20 ? 2 : 1);
}

// Each contract carries a type ('haul' | 'hunt'); per-type behavior routes
// through these tables so adding a type is one entry, not a scavenger hunt.
var CONTRACT_DESC = {
  haul: function (ct) {
    return 'deliver ' + ct.qty + ' ' + GOODS[ct.good].name + ' to ' + G.systems[ct.dest].name;
  },
  hunt: function (ct) {
    return 'clear ' + ct.gang + ' out of ' + G.systems[ct.dest].name;
  }
};

function contractDesc(ct) { return CONTRACT_DESC[ct.type](ct); }

function genHaulContract(here, targets, tier, c) {
  var dest = targets[Math.floor(roll() * targets.length)];
  // Prefer a good the destination actually consumes — contracts teach the map.
  var wants = [];
  for (var g = 0; g < GOOD_IDS.length; g++) {
    if (econMod(dest, GOOD_IDS[g]) > 1 && canTradeGood(dest, GOOD_IDS[g])) wants.push(GOOD_IDS[g]);
  }
  var good = wants.length ? wants[Math.floor(roll() * wants.length)] : 'food';
  var d = dist(here, dest);
  var qty = Math.round((4 + roll() * 8) * tier);
  return {
    id: G.day + '-' + c + '-' + Math.floor(roll() * 1e6),
    type: 'haul',
    good: good, qty: qty, dest: dest.id,
    faction: here.faction,
    pay: Math.round(qty * GOODS[good].base * 1.15 + d * 15 + 150 * tier),
    deadline: G.day + Math.ceil(d / 10) + 5,
    rep: 4 + tier
  };
}

// Guild and Colonies boards post bounties: reaching the target system forces
// an encounter with the named gang at the named strength; win the fight to
// collect. Losing or slipping away leaves the bounty open.
function genHuntContract(here, targets, tier, c) {
  var dest = targets[Math.floor(roll() * targets.length)];
  var str = 1 + tier + (roll() < 0.35 ? 1 : 0);
  var d = dist(here, dest);
  return {
    id: G.day + '-h' + c + '-' + Math.floor(roll() * 1e6),
    type: 'hunt',
    gang: PIRATE_BANDS[Math.floor(roll() * PIRATE_BANDS.length)],
    str: str, dest: dest.id,
    faction: here.faction,
    pay: Math.round(500 * str + d * 12 + 250 * tier),
    deadline: G.day + Math.ceil(d / 10) + 8,
    rep: 5 + tier
  };
}

function genContracts() {
  var here = G.systems[G.cur];
  G.contracts = [];
  var targets = [];
  for (var i = 0; i < G.systems.length; i++) {
    if (i !== G.cur && G.systems[i].charted) targets.push(G.systems[i]);
  }
  if (!targets.length) return;
  var tier = contractTier(here.faction);
  var n = 2 + Math.floor(roll() * 2);
  for (var c = 0; c < n; c++) G.contracts.push(genHaulContract(here, targets, tier, c));
  if (here.faction !== 'syndicate' && roll() < 0.6) {
    G.contracts.push(genHuntContract(here, targets, tier, n));
  }
}

function huntContractAt(dest) {
  for (var i = 0; i < G.active.length; i++) {
    var ct = G.active[i];
    if (ct.type === 'hunt' && ct.dest === dest) return ct;
  }
  return null;
}

function completeHunt(id) {
  for (var i = 0; i < G.active.length; i++) {
    var ct = G.active[i];
    if (ct.id !== id) continue;
    G.credits += ct.pay;
    G.rep[ct.faction] = clampRep(G.rep[ct.faction] + ct.rep);
    G.stats.contractsDone++;
    G.active.splice(i, 1);
    checkMilestones();
    saveGame();
    return 'Bounty honored: +' + ct.pay + ' cr, +' + ct.rep + ' ' +
      FACTIONS[ct.faction].name + ' rep.';
  }
  return '';
}

function acceptContract(id) {
  if (G.active.length >= 3) return 'You can only juggle 3 contracts.';
  for (var i = 0; i < G.contracts.length; i++) {
    if (G.contracts[i].id === id) {
      G.active.push(G.contracts[i]);
      G.contracts.splice(i, 1);
      addLog('Contract accepted: ' + contractDesc(G.active[G.active.length - 1]) + '.');
      saveGame();
      return null;
    }
  }
  return 'Contract gone.';
}

function deliverContract(id) {
  for (var i = 0; i < G.active.length; i++) {
    var ct = G.active[i];
    if (ct.id === id && ct.dest === G.cur && (G.cargo[ct.good] || 0) >= ct.qty) {
      G.cargo[ct.good] -= ct.qty;
      if (G.cargo[ct.good] <= 0) { delete G.cargo[ct.good]; delete G.avgCost[ct.good]; }
      G.credits += ct.pay;
      G.rep[ct.faction] = clampRep(G.rep[ct.faction] + ct.rep);
      G.stats.contractsDone++;
      G.active.splice(i, 1);
      addLog('Contract delivered: +' + ct.pay + ' cr, +' + ct.rep + ' ' +
        FACTIONS[ct.faction].name + ' rep.');
      checkMilestones();
      saveGame();
      return null;
    }
  }
  return 'Need the full shipment in your hold, at the destination.';
}

// ---------- Cantina (rumors) ----------

function buyRumor() {
  var cost = 30;
  if (G.credits < cost) return { err: 'Rumors cost 30 cr. The barkeep shrugs.' };
  G.credits -= cost;
  // 85% accurate: report a real event; otherwise embellish nothing.
  var evSystems = [];
  for (var i = 0; i < G.systems.length; i++) {
    if (i !== G.cur && G.systems[i].event) evSystems.push(G.systems[i]);
  }
  var msg;
  if (evSystems.length && roll() < 0.85) {
    var sys = evSystems[Math.floor(roll() * evSystems.length)];
    sys.charted = true;
    sys.event.known = true;
    var ev = EVENTS[sys.event.type];
    msg = 'A dock worker leans in: "' + ev.name + ' in ' + sys.name + ' — ' + ev.news +
      '. Maybe ' + sys.event.daysLeft + ' days before it blows over."';
  } else {
    var far = [];
    for (var j = 0; j < G.systems.length; j++) {
      if (!G.systems[j].charted) far.push(G.systems[j]);
    }
    if (far.length) {
      var s2 = far[Math.floor(roll() * far.length)];
      s2.charted = true;
      msg = 'A drunk navigator sells you coordinates: a system called ' + s2.name +
        ' now marks your charts. Whether it\'s worth the burn is your problem.';
    } else {
      msg = 'An hour of chatter and nothing but tall tales. That round bought nothing.';
    }
  }
  addLog('Cantina: ' + msg);
  saveGame();
  return { msg: msg };
}

// ---------- Shipyard ----------

function upgradePrice(u) {
  return Math.round(UPGRADES[u].base * Math.pow(2, G.upgrades[u]));
}

function buyUpgrade(u) {
  var price = upgradePrice(u);
  if (G.upgrades[u] >= UPGRADES[u].max) return 'Maxed out.';
  if (G.credits < price) return 'Not enough credits.';
  G.credits -= price;
  G.upgrades[u]++;
  if (u === 'scanner') chartSystems();
  addLog('Installed ' + UPGRADES[u].name + ' (rank ' + G.upgrades[u] + ') for ' + price + ' cr.');
  saveGame();
  return null;
}

function hullTradePrice(h) {
  return Math.max(0, HULLS[h].cost - Math.round(HULLS[G.hull].cost * 0.6));
}

function buyHull(h) {
  if (h === G.hull) return 'You already fly this hull.';
  var price = hullTradePrice(h);
  if (G.credits < price) return 'Not enough credits.';
  if (cargoUsed() > HULLS[h].cargo + G.upgrades.cargo * UPGRADES.cargo.delta + perkRank('holds') * 8) {
    return 'Your cargo won\'t fit in that hull. Sell some first.';
  }
  G.credits -= price;
  G.hull = h;
  G.fuel = Math.min(G.fuel, shipStat('fuel'));
  addLog('Traded up to a ' + HULLS[h].name + ' for ' + price + ' cr. Modules transferred.');
  checkMilestones();
  saveGame();
  return null;
}

// ---------- Outposts & warehouses ----------

function outpostPrice(sys) { return 5000 * sys.wealth; }

function canBuyOutpost(sys) {
  if (sys.outpost) return 'You already own the outpost here.';
  if (!sys.visited) return 'Visit first.';
  if (G.rep[sys.faction] < 40) return 'Requires 40+ rep with ' + FACTIONS[sys.faction].name + '.';
  if (G.credits < outpostPrice(sys)) return 'Costs ' + outpostPrice(sys) + ' cr.';
  return null;
}

function buyOutpost() {
  var sys = G.systems[G.cur];
  var err = canBuyOutpost(sys);
  if (err) return err;
  G.credits -= outpostPrice(sys);
  sys.outpost = true;
  addLog('Outpost established at ' + sys.name + ': ' + (sys.wealth * 18) +
    ' cr/day, live price feed, 80-unit warehouse.');
  checkMilestones();
  saveGame();
  return null;
}

function warehouseUsed(sys) {
  var n = 0;
  for (var g in sys.warehouse) n += sys.warehouse[g].qty;
  return n;
}

// The warehouse keeps its own cost basis: deposits blend the ship's average
// in (same weighted math as buying), withdrawals blend it back into the hold.
function depositGood(good, qty) {
  var sys = G.systems[G.cur];
  if (!sys.outpost) return 'No warehouse here.';
  qty = Math.min(qty, G.cargo[good] || 0, 80 - warehouseUsed(sys));
  if (qty <= 0) return 'No space or nothing to store.';
  G.cargo[good] -= qty;
  if (G.cargo[good] <= 0) delete G.cargo[good];
  var w = sys.warehouse[good] || { qty: 0, avg: 0 };
  var unit = G.avgCost[good] || GOODS[good].base;
  w.avg = (w.avg * w.qty + unit * qty) / (w.qty + qty);
  w.qty += qty;
  sys.warehouse[good] = w;
  saveGame();
  return null;
}

function withdrawGood(good, qty) {
  var sys = G.systems[G.cur];
  var w = sys.warehouse[good];
  if (!sys.outpost || !w) return 'Nothing stored.';
  qty = Math.min(qty, w.qty, shipStat('cargo') - cargoUsed());
  if (qty <= 0) return 'No room in your hold.';
  var had = G.cargo[good] || 0;
  G.avgCost[good] = ((G.avgCost[good] || 0) * had + w.avg * qty) / (had + qty);
  w.qty -= qty;
  if (w.qty <= 0) delete sys.warehouse[good];
  G.cargo[good] = had + qty;
  saveGame();
  return null;
}

// ---------- Milestones & legacy ----------

function checkMilestones() {
  var worth = netWorth();
  for (var i = 0; i < TITLES.length; i++) {
    var t = TITLES[i];
    if (worth >= t.min && t.min > 0 && !G.milestones[t.name]) {
      G.milestones[t.name] = true;
      addLog('★ Milestone: net worth ' + t.min.toLocaleString() + ' — you are now a ' + t.name + '.');
      if (typeof uiToast === 'function') uiToast('★ ' + t.name + ' — net worth ' + t.min.toLocaleString() + ' cr');
    }
  }
}

function legacyPointsForWorth(worth) {
  return Math.floor(Math.sqrt(Math.max(0, worth) / 500));
}

function retire() {
  var worth = netWorth();
  var pts = legacyPointsForWorth(worth);
  LEGACY.points += pts;
  LEGACY.hall.unshift({
    captain: G.captain, worth: worth, days: G.day,
    title: titleFor(worth), seed: G.seed, pts: pts
  });
  if (LEGACY.hall.length > 12) LEGACY.hall.length = 12;
  saveLegacy();
  localStorage.removeItem(SAVE_KEY);
  G = null;
  return pts;
}

// ---------- Log / save ----------

function addLog(msg) {
  G.log.unshift({ day: G.day, msg: msg });
  if (G.log.length > 80) G.log.length = 80;
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {}
}

function loadGame() {
  try {
    var s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.systems && s.systems.length) { G = s; return true; }
  } catch (e) {}
  return false;
}

function abandonGame() {
  localStorage.removeItem(SAVE_KEY);
  G = null;
}
