// Core rules engine. Owns the single state struct S; every mechanic reads/writes
// only its fields. No DOM — render.js and ui.js sit on top of this API.

var Game = (function () {
  const C = Data.CONFIG;

  let S = null;
  let rng = null;

  // ---------- helpers ----------

  function randInt(n) { return Math.floor(rng() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }

  function log(text, cls) {
    S.log.push({ text, cls });
    if (S.log.length > 80) S.log.shift();
  }

  function at(c, r) {
    if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) return null;
    return S.tiles[r][c];
  }

  function byId(id) { return S.units.find(u => u.id === id); }
  function byHero(heroId) { return S.units.find(u => u.hero === heroId); }
  function partyUnits() { return S.units.filter(u => u.side === 'party'); }
  function footParty() { return S.units.filter(u => u.side === 'party' && !u.aboard); }
  function slaverUnits() { return S.units.filter(u => u.side === 'slaver'); }

  function occupant(c, r) {
    return S.units.find(u => !u.aboard && u.c === c && u.r === r) || null;
  }

  function terrainCost(c, r) {
    const tile = at(c, r);
    if (!tile) return Infinity;
    return Data.TERRAIN[tile.terrain].cost;
  }

  function footCostFn(c, r) {
    const base = terrainCost(c, r);
    if (base === Infinity) return Infinity;
    if (occupant(c, r)) return Infinity;
    if (S.raft && S.raft.c === c && S.raft.r === r) return Infinity;
    return base;
  }

  function raftCostFn(c, r) {
    const tile = at(c, r);
    if (!tile || tile.terrain !== 'water') return Infinity;
    return 1;
  }

  // ---------- setup ----------

  function makeHero(heroId, c, r) {
    const h = Data.HEROES[heroId];
    return {
      id: S.nextId++, side: 'party', hero: heroId, name: h.name, glyph: h.glyph,
      c, r, hp: h.hp, maxHp: h.hp, atk: h.atk, mp: h.mp, mpLeft: h.mp, sight: h.sight,
      acted: false, hunger: 0, aboard: false, buzz: false,
      home: null, captain: false, gang: false, targetId: null,
    };
  }

  function makeSlaver(kind, home, c, r, stretch, name) {
    const stats = {
      guard: { hp: stretch >= 3 ? 4 : 3, atk: stretch >= 4 ? 3 : 2, mp: 2, glyph: '🗡️' },
      captain: { hp: 7, atk: 3, mp: 2, glyph: '👑' },
      gang: { hp: 3, atk: 2, mp: 3, glyph: '🏹' },
    }[kind];
    return {
      id: S.nextId++, side: 'slaver', hero: null, name, glyph: stats.glyph,
      c, r, hp: stats.hp, maxHp: stats.hp, atk: stats.atk, mp: stats.mp, mpLeft: stats.mp,
      sight: C.GUARD_SIGHT, acted: false, hunger: 0, aboard: false, buzz: false,
      home, captain: kind === 'captain', gang: kind === 'gang', targetId: null,
    };
  }

  function freeNeighbors(c, r) {
    return Hex.neighbors(c, r).filter(n => footCostFn(n.c, n.r) !== Infinity);
  }

  function newGame(seed, leaderName) {
    rng = MapGen.makeRng(seed);
    const map = MapGen.generate(rng);
    S = {
      seed, turn: 1, gongIn: C.GONG_PERIOD, deaths: 0,
      tiles: map.tiles, stones: map.stones,
      units: [], nextId: 1,
      raft: null,
      inventory: { bamboo: 0, items: {} },
      lostCompanions: [], recruitPool: Data.RECRUIT_POOL.slice(),
      mealsInStretch: { 1: 0, 2: 0, 3: 0, 4: 0 },
      log: [], visible: new Set(), over: null,
    };
    const leader = makeHero('burton', map.start.c, map.start.r);
    leader.name = leaderName; // the hero id 'burton' stays — it keys the leader's mechanics
    S.units.push(leader);
    spawnSlavers();
    log('You wake naked on the riverbank, a grail in your hand. Far upriver, they say, stands a Tower.', 'gong');
    checkRecruit(byHero('burton'));
    updateFog();
    return S;
  }

  function spawnSlavers() {
    for (const st of S.stones) {
      const tile = at(st.c, st.r);
      if (!tile.stone.slaver) continue;
      const stretch = MapGen.stretchOf(st.r);
      const captain = makeSlaver('captain', { c: st.c, r: st.r }, st.c, st.r, stretch, tile.stone.captainName);
      S.units.push(captain);
      tile.stone.captainId = captain.id;
      const spots = freeNeighbors(st.c, st.r);
      const nGuards = 2 + (stretch >= 3 ? 1 : 0);
      for (let i = 0; i < nGuards && i < spots.length; i++) {
        S.units.push(makeSlaver('guard', { c: st.c, r: st.r }, spots[i].c, spots[i].r, stretch, 'Grail-slaver'));
      }
    }
  }

  // ---------- fog ----------

  function updateFog() {
    S.visible = new Set();
    const watchers = partyUnits().map(u => u.aboard ? { c: S.raft.c, r: S.raft.r, sight: u.sight } : u);
    for (const w of watchers) {
      for (let r = Math.max(0, w.r - w.sight); r <= Math.min(C.ROWS - 1, w.r + w.sight); r++) {
        for (let c = 0; c < C.COLS; c++) {
          if (Hex.distance(w.c, w.r, c, r) > w.sight) continue;
          S.tiles[r][c].seen = true;
          S.visible.add(Hex.key(c, r));
        }
      }
    }
    // Grailstones are enormous — known from far off, even through the haze.
    for (const st of S.stones) {
      const spotted = watchers.some(w => Hex.distance(w.c, w.r, st.c, st.r) <= 9);
      if (spotted) at(st.c, st.r).stoneKnown = true;
    }
  }

  // ---------- movement ----------

  function reachableFor(unit) {
    if (unit.acted && unit.mpLeft <= 0) return new Map();
    return Hex.reachable(unit.c, unit.r, unit.mpLeft, footCostFn);
  }

  function raftReachable() {
    return Hex.reachable(S.raft.c, S.raft.r, S.raft.mpLeft, raftCostFn);
  }

  function moveTo(unitId, c, r) {
    const u = byId(unitId);
    const dest = reachableFor(u).get(Hex.key(c, r));
    if (!dest) return false;
    u.mpLeft -= dest.cost;
    u.c = c; u.r = r;
    updateFog();
    checkRecruit(u);
    checkTower(u);
    return true;
  }

  function moveRaft(c, r) {
    const dest = raftReachable().get(Hex.key(c, r));
    if (!dest) return false;
    S.raft.mpLeft -= dest.cost;
    S.raft.c = c; S.raft.r = r;
    updateFog();
    return true;
  }

  function checkTower(u) {
    if (u.hero !== 'burton') return;
    if (at(u.c, u.r).terrain !== 'tower') return;
    gameOver(true, `The mists part. The Tower rises out of the polar sea —\nand its door stands open.\n\n${u.name} has reached the headwaters.\nSomewhere behind, the gong sounds for other wanderers.`);
  }

  // ---------- combat ----------

  function famished(u) {
    return u.side === 'party' && u.hunger >= C.STARVE_AT;
  }

  // Effective attack — famine and dreamgum route through one point.
  function atkOf(u) {
    const base = famished(u) ? Math.max(1, u.atk - C.FAMISH_ATK) : u.atk;
    return base + (u.buzz ? 2 : 0);
  }

  function canAttack(a, t) {
    if (a.acted || a.aboard || t.aboard) return false;
    if (a.side === t.side) return false;
    return Hex.distance(a.c, a.r, t.c, t.r) === 1;
  }

  function attack(attackerId, targetId) {
    const a = byId(attackerId);
    const t = byId(targetId);
    if (!canAttack(a, t)) return null;
    const dmg = atkOf(a);
    t.hp -= dmg;
    a.acted = true;
    const events = [{ type: 'hit', c: t.c, r: t.r, dmg }];
    log(`${a.name} strikes ${t.name} for ${dmg}.`);
    if (t.hp <= 0) {
      killSlaver(t, a);
      return events;
    }
    if (a.hero === 'cyrano') return events; // the fencer is never touched
    const counter = Math.max(1, t.atk - 1);
    a.hp -= counter;
    events.push({ type: 'hit', c: a.c, r: a.r, dmg: counter });
    log(`${t.name} strikes back for ${counter}.`, 'bad');
    if (a.hp <= 0) handlePartyDeath(a, events);
    return events;
  }

  function killSlaver(t, killer) {
    S.units = S.units.filter(u => u.id !== t.id);
    log(`${t.name} falls. The River will sort him out.`, 'good');
    if (killer.hero === 'kazz' && rng() < C.KAZZ_FLINT) {
      addItem('flint', 1);
      log('Kazz pries a fine flint edge from the ground.', 'good');
    }
    if (t.captain) freeStone(t);
  }

  function freeStone(captain) {
    const tile = at(captain.home.c, captain.home.r);
    if (!tile || !tile.stone) return;
    tile.stone.slaver = false;
    log(`${captain.name}'s state is broken — the stone is free, and it is rich.`, 'good');
    for (let i = 0; i < 3; i++) addItem(Data.pickWeighted(Data.ITEMS, rng()), 1);
    log('You take the captain\'s hoard: three grail goods.', 'good');
    if (tile.stone.captive) {
      tile.stone.captive = false;
      tile.stone.wanderer = true;
      log('A captive stumbles out of the pen, blinking at the light.', 'good');
    }
  }

  // ---------- death is downriver ----------

  function handlePartyDeath(u, events) {
    if (u.hero === 'burton') { burtonDies(events); return; }
    S.units = S.units.filter(x => x.id !== u.id);
    if (S.raft) S.raft.aboard = S.raft.aboard.filter(id => id !== u.id);
    S.lostCompanions.push(u.hero);
    events.push({ type: 'pdeath', c: u.c, r: u.r });
    log(`${u.name} dies — and wakes far downriver, alone. Perhaps the River gives back.`, 'bad');
  }

  // The River always gives Burton back — death costs goods and ground, never the run.
  function burtonDies(events) {
    S.deaths++;
    const b = byHero('burton');
    const stretch = MapGen.stretchOf(b.r);
    if (b.aboard && S.raft) { S.raft.aboard = S.raft.aboard.filter(id => id !== b.id); b.aboard = false; }
    const spot = respawnSpot(stretch);
    const base = Data.HEROES.burton;
    b.c = spot.c; b.r = spot.r;
    b.hp = base.hp; b.maxHp = base.hp; b.atk = base.atk;
    b.hunger = 0; b.mpLeft = 0; b.acted = true; b.buzz = false;
    halveInventory();
    events.push({ type: 'resurrect', c: b.c, r: b.r });
    log(`${b.name} dies — and wakes beside another stone, fresh-bodied, half the hoard left behind. (Death ${S.deaths}. The River is patient.)`, 'bad');
    updateFog();
  }

  // A random stone in the stretch with room to wake up beside — the Suicide
  // Express does not promise a comfortable arrival, only an arrival.
  function respawnSpot(stretch) {
    const near = S.stones.filter(st => MapGen.stretchOf(st.r) === stretch);
    const candidates = (near.length > 0 ? near : S.stones).slice();
    while (candidates.length > 0) {
      const st = candidates.splice(randInt(candidates.length), 1)[0];
      if (!occupant(st.c, st.r)) return st;
      const spots = freeNeighbors(st.c, st.r);
      if (spots.length > 0) return pick(spots);
    }
    return S.stones[0]; // every stone crowded — wake back where it all began
  }

  function halveInventory() {
    S.inventory.bamboo = Math.floor(S.inventory.bamboo / 2);
    for (const id of Object.keys(S.inventory.items)) {
      S.inventory.items[id] = Math.floor(S.inventory.items[id] / 2);
    }
  }

  function suicide() {
    const events = [];
    log(`${byHero('burton').name} mixes the dreamgum paste, lies back, and rides the Suicide Express.`, 'bad');
    burtonDies(events);
    return events;
  }

  // ---------- recruiting ----------

  function checkRecruit(u) {
    if (u.side !== 'party') return;
    const spots = [{ c: u.c, r: u.r }].concat(Hex.neighbors(u.c, u.r));
    for (const s of spots) {
      const tile = at(s.c, s.r);
      if (!tile || !tile.stone || !tile.stone.wanderer) continue;
      if (tile.stone.slaver) continue;
      resolveWanderer(tile, s);
    }
  }

  function resolveWanderer(tile, hex) {
    const st = tile.stone;
    if (!st.wandererId) st.wandererId = pickWandererIdentity();
    if (st.wandererId === 'stranger') {
      st.wanderer = false;
      addItem('ration', 2);
      log('A wanderer shares fish and rations, and walks on south.', 'good');
      return;
    }
    if (partyUnits().length >= C.PARTY_CAP) {
      log(`${Data.HEROES[st.wandererId].name} waits by the stone — your band is full.`);
      return;
    }
    const spots = occupant(hex.c, hex.r) ? freeNeighbors(hex.c, hex.r) : [hex];
    if (spots.length === 0) return; // no room to step out — they wait
    st.wanderer = false;
    const spot = pick(spots);
    const wasLost = S.lostCompanions.includes(st.wandererId);
    S.lostCompanions = S.lostCompanions.filter(h => h !== st.wandererId);
    const unit = makeHero(st.wandererId, spot.c, spot.r);
    S.units.push(unit);
    log(wasLost
      ? `${unit.name}! The River gives back — they walked upriver hunting for you.`
      : `${unit.name} joins your band. ${Data.HEROES[st.wandererId].role}`, 'good');
    updateFog();
  }

  function pickWandererIdentity() {
    if (S.lostCompanions.length > 0 && rng() < C.RIVER_GIVES_BACK) {
      return pick(S.lostCompanions);
    }
    if (S.recruitPool.length > 0) {
      return S.recruitPool.splice(randInt(S.recruitPool.length), 1)[0];
    }
    return 'stranger';
  }

  // ---------- actions ----------

  function canGather(u) {
    return !u.acted && !u.aboard && at(u.c, u.r).terrain === 'bamboo';
  }

  function gather(unitId) {
    const u = byId(unitId);
    if (!canGather(u)) return false;
    at(u.c, u.r).terrain = 'grass';
    S.inventory.bamboo++;
    u.acted = true;
    log(`${u.name} cuts bamboo (${S.inventory.bamboo}/${C.RAFT_BAMBOO} for a raft).`);
    return true;
  }

  function waterNeighbor(c, r) {
    return Hex.neighbors(c, r).find(n => {
      const t = at(n.c, n.r);
      return t && t.terrain === 'water' && !(S.raft && S.raft.c === n.c && S.raft.r === n.r);
    }) || null;
  }

  function canBuildRaft(u) {
    return !u.acted && !u.aboard && !S.raft
      && S.inventory.bamboo >= C.RAFT_BAMBOO && waterNeighbor(u.c, u.r) !== null;
  }

  function buildRaft(unitId) {
    const u = byId(unitId);
    if (!canBuildRaft(u)) return false;
    const w = waterNeighbor(u.c, u.r);
    S.raft = { c: w.c, r: w.r, aboard: [], mpLeft: 0 };
    S.inventory.bamboo -= C.RAFT_BAMBOO;
    u.acted = true;
    log('A bamboo raft slides into the shallows. The River is a road now.', 'good');
    return true;
  }

  function canBoard(u) {
    return S.raft && !u.aboard && Hex.distance(u.c, u.r, S.raft.c, S.raft.r) === 1;
  }

  function boardRaft(unitId) {
    const u = byId(unitId);
    if (!canBoard(u)) return false;
    u.aboard = true;
    u.mpLeft = 0;
    S.raft.aboard.push(u.id);
    log(`${u.name} climbs aboard the raft.`);
    return true;
  }

  function samAboard() {
    return S.raft && S.raft.aboard.some(id => byId(id) && byId(id).hero === 'sam');
  }

  function raftMp() { return 3 + (samAboard() ? 1 : 0); }

  function canLand() {
    if (!S.raft || S.raft.aboard.length === 0) return false;
    return landingHexes().length >= S.raft.aboard.length;
  }

  function landingHexes() {
    const out = [];
    const seen = new Set();
    let ring = [{ c: S.raft.c, r: S.raft.r }];
    for (let depth = 0; depth < 2; depth++) {
      const next = [];
      for (const h of ring) {
        for (const n of Hex.neighbors(h.c, h.r)) {
          const k = Hex.key(n.c, n.r);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(n);
          if (footCostFn(n.c, n.r) !== Infinity) out.push(n);
        }
      }
      ring = next;
    }
    return out;
  }

  function landRaft() {
    if (!canLand()) return false;
    const spots = landingHexes();
    for (const id of S.raft.aboard.slice()) {
      const u = byId(id);
      const spot = spots.shift();
      u.aboard = false;
      u.c = spot.c; u.r = spot.r;
      u.mpLeft = 0;
    }
    S.raft.aboard = [];
    log('The band wades ashore.');
    updateFog();
    for (const u of footParty()) { checkRecruit(u); checkTower(u); }
    return true;
  }

  // ---------- items ----------

  function addItem(id, n) {
    S.inventory.items[id] = (S.inventory.items[id] || 0) + n;
  }

  function adjacentGuards(u) {
    return slaverUnits().filter(s => !s.captain && Hex.distance(u.c, u.r, s.c, s.r) === 1);
  }

  // One dispatch point per item — each returns a log line, or null to refuse.
  const ITEM_EFFECTS = {
    ration(u) { u.hunger = 0; return `${u.name} eats a ration. The hunger quiets.`; },
    whiskey(u) { u.hp = Math.min(u.maxHp, u.hp + 2); return `${u.name} drinks: +2 HP.`; },
    dreamgum(u) { u.buzz = true; return `${u.name} chews dreamgum — eyes wide, fists like hammers. (+2 attack this turn)`; },
    flint(u) { u.atk += 1; return `${u.name} binds a flint edge: +1 attack, forever.`; },
    cloth(u) { u.maxHp += 2; u.hp += 2; return `${u.name} wraps woven cloth: +2 max HP.`; },
    cigars(u) {
      const marks = adjacentGuards(u).slice(0, 2);
      if (marks.length === 0) return null;
      S.units = S.units.filter(x => !marks.includes(x));
      return `${u.name} trades cigars — ${marks.length} guard${marks.length > 1 ? 's' : ''} shrug and desert.`;
    },
  };

  function useItem(itemId, unitId) {
    const u = byId(unitId);
    if (!u || u.side !== 'party') return false;
    if ((S.inventory.items[itemId] || 0) <= 0) return false;
    const line = ITEM_EFFECTS[itemId](u);
    if (line === null) return false;
    S.inventory.items[itemId]--;
    log(line, 'good');
    return true;
  }

  // ---------- enemy phase & clock ----------

  function endTurn() {
    const events = [];
    staggerDreamgum(events);
    enemyPhase(events);
    driftRaft(events);
    clockTick(events);
    resetForNewTurn();
    updateFog();
    return events;
  }

  function staggerDreamgum(events) {
    for (const u of footParty()) {
      if (!u.buzz) continue;
      const spots = freeNeighbors(u.c, u.r);
      if (spots.length === 0) continue;
      const spot = pick(spots);
      events.push({ type: 'emove', id: u.id, from: { c: u.c, r: u.r }, path: [{ c: spot.c, r: spot.r }] });
      u.c = spot.c; u.r = spot.r;
      log(`${u.name} staggers, giggling at the colors.`);
    }
  }

  function nearJoe(s) {
    const joe = byHero('joe');
    return joe && !joe.aboard && Hex.distance(s.c, s.r, joe.c, joe.r) === 1;
  }

  function enemyPhase(events) {
    for (const s of slaverUnits().slice()) {
      if (byId(s.id) === undefined) continue; // died to a counter earlier this phase
      if (S.over) return;
      s.mpLeft = s.mp;
      if (nearJoe(s) && rng() < C.JOE_DREAD) {
        events.push({ type: 'dread', c: s.c, r: s.r });
        log(`${s.name} freezes — Joe Miller is very large and very close.`);
        continue;
      }
      slaverAct(s, events);
    }
  }

  function pickTarget(s) {
    const foes = footParty();
    if (foes.length === 0) return null;
    const nearest = foes.reduce((best, f) =>
      Hex.distance(s.c, s.r, f.c, f.r) < Hex.distance(s.c, s.r, best.c, best.r) ? f : best);
    if (s.gang) return nearest; // press-gangs hunt: they followed your smoke
    if (Hex.distance(s.c, s.r, nearest.c, nearest.r) > s.sight) return null;
    if (s.home && Hex.distance(s.c, s.r, s.home.c, s.home.r) > C.GUARD_LEASH) return null;
    return nearest;
  }

  function slaverAct(s, events) {
    const target = pickTarget(s);
    if (!target) { returnHome(s, events); return; }
    if (Hex.distance(s.c, s.r, target.c, target.r) === 1) { slaverAttack(s, target, events); return; }
    walkToward(s, target, t => Hex.distance(t.c, t.r, target.c, target.r) === 1, events);
    const alive = byId(target.id);
    if (alive && Hex.distance(s.c, s.r, alive.c, alive.r) === 1) slaverAttack(s, alive, events);
  }

  function returnHome(s, events) {
    if (!s.home || (s.c === s.home.c && s.r === s.home.r)) return;
    walkToward(s, s.home, t => t.c === s.home.c && t.r === s.home.r, events);
  }

  function walkToward(s, target, doneFn, events) {
    const path = Hex.findPath(s.c, s.r, target,
      (c, r) => doneFn({ c, r }),
      (c, r) => footCostFn(c, r));
    if (!path) return;
    const from = { c: s.c, r: s.r };
    const walked = [];
    for (const step of path) {
      const cost = terrainCost(step.c, step.r);
      if (cost > s.mpLeft) break;
      s.mpLeft -= cost;
      s.c = step.c; s.r = step.r;
      walked.push(step);
    }
    if (walked.length > 0) events.push({ type: 'emove', id: s.id, from, path: walked });
  }

  function slaverAttack(s, t, events) {
    t.hp -= s.atk;
    events.push({ type: 'hit', c: t.c, r: t.r, dmg: s.atk });
    log(`${s.name} strikes ${t.name} for ${s.atk}.`, 'bad');
    if (t.hp <= 0) { handlePartyDeath(t, events); return; }
    const counter = Math.max(1, atkOf(t) - 1);
    s.hp -= counter;
    events.push({ type: 'hit', c: s.c, r: s.r, dmg: counter });
    if (s.hp <= 0) killSlaver(s, t);
  }

  function driftRaft(events) {
    if (!S.raft || samAboard()) return;
    const below = Hex.neighbors(S.raft.c, S.raft.r)
      .filter(n => n.r === S.raft.r + 1 && raftCostFn(n.c, n.r) !== Infinity)
      .sort((a, b) => Math.abs(a.c - S.raft.c) - Math.abs(b.c - S.raft.c))[0];
    if (!below) return;
    S.raft.c = below.c; S.raft.r = below.r;
    events.push({ type: 'drift' });
    if (S.raft.aboard.length > 0) log('The current drags the raft a league downriver.', 'bad');
    updateFog();
  }

  function clockTick(events) {
    if (S.over) return;
    S.turn++;
    S.gongIn--;
    for (const u of partyUnits()) u.hunger++;
    if (S.gongIn <= 0) { fireGong(events); S.gongIn = C.GONG_PERIOD; }
    // Famine weakens — it never kills. HP drains to a floor of 1; the real price
    // is fighting at -1 attack and crawling at -1 MP until the next meal.
    for (const u of partyUnits()) {
      if (!famished(u)) continue;
      if (u.hunger === C.STARVE_AT) log(`${u.name} is famished — weak and slow until fed.`, 'bad');
      if (u.hp <= 1) continue;
      u.hp--;
      events.push({ type: 'hit', c: u.c, r: u.r, dmg: 1 });
    }
  }

  function fireGong(events) {
    events.push({ type: 'gong' });
    const fed = new Map(); // unit id -> stone tile
    for (const st of S.stones) {
      for (const u of footParty()) {
        if (Hex.distance(u.c, u.r, st.c, st.r) <= 1) fed.set(u.id, at(st.c, st.r));
      }
    }
    const alice = byHero('alice');
    if (alice && fed.has(alice.id)) {
      for (const u of footParty()) {
        if (!fed.has(u.id) && Hex.distance(u.c, u.r, alice.c, alice.r) <= 2) {
          fed.set(u.id, fed.get(alice.id));
          log(`${u.name} eats from Alice's grail — grace at the gong.`, 'good');
        }
      }
    }
    if (fed.size === 0) {
      log('The gong rolls down the valley. Every stone flames — and your grails are nowhere near one.', 'gong');
      return;
    }
    const got = [];
    let stoneUsed = null;
    for (const [id, tile] of fed) {
      const u = byId(id);
      u.hunger = 0;
      stoneUsed = tile;
      const n = tile.stone.rich ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const itemId = Data.pickWeighted(Data.ITEMS, rng());
        addItem(itemId, 1);
        got.push(Data.ITEMS[itemId].name);
      }
    }
    log(`GONG. ${fed.size} fed. The grails yield: ${got.join(', ')}.`, 'gong');
    const stretch = MapGen.stretchOf(S.stones.find(st => at(st.c, st.r) === stoneUsed).r);
    S.mealsInStretch[stretch]++;
    if (S.mealsInStretch[stretch] > C.FREE_MEALS) spawnGang(stretch, events);
  }

  function spawnGang(stretch, events) {
    const dens = S.stones.filter(st => {
      const d = at(st.c, st.r).stone;
      return d.slaver && byId(d.captainId);
    });
    if (dens.length === 0) {
      log('Drums in the hills — but no state remains to answer them.', 'gong');
      return;
    }
    const b = byHero('burton');
    const den = dens.reduce((best, st) =>
      Hex.distance(b.c, b.r, st.c, st.r) < Hex.distance(b.c, b.r, best.c, best.r) ? st : best);
    const spots = freeNeighbors(den.c, den.r);
    const n = Math.min(2 + (stretch >= 3 ? 1 : 0), spots.length);
    for (let i = 0; i < n; i++) {
      S.units.push(makeSlaver('gang', null, spots[i].c, spots[i].r, stretch, 'Press-gang hunter'));
    }
    if (n > 0) {
      events.push({ type: 'gang', c: den.c, r: den.r });
      log(`The local state has noticed all that eating. A press-gang of ${n} sets out from ${at(den.c, den.r).stone.captainName}'s stone.`, 'bad');
    }
  }

  function resetForNewTurn() {
    for (const u of partyUnits()) {
      u.mpLeft = famished(u) ? Math.max(1, u.mp - C.FAMISH_MP) : u.mp;
      u.acted = false;
      u.buzz = false;
    }
    if (S.raft) S.raft.mpLeft = raftMp();
  }

  function gameOver(win, text) {
    S.over = { win, text };
  }

  // ---------- persistence: the River waits ----------

  function serialize() {
    const copy = Object.assign({}, S, {
      visible: undefined,                          // recomputed from fog on load
      rngSeed: Math.floor(rng() * 0xffffffff),     // fresh stream each save
    });
    return JSON.stringify(copy);
  }

  function load(json) {
    const data = JSON.parse(json);
    rng = MapGen.makeRng((data.rngSeed || 1) >>> 0);
    delete data.rngSeed;
    delete data.visible;
    delete data.lives;                             // pre-revision saves
    if (data.deaths === undefined) data.deaths = 0;
    S = data;
    S.visible = new Set();
    updateFog();
    log('The River kept your place. The pilgrimage continues.', 'gong');
    return S;
  }

  function state() { return S; }

  return {
    newGame, state, byId, byHero, at, occupant, partyUnits, footParty, slaverUnits,
    reachableFor, raftReachable, moveTo, moveRaft,
    canAttack, attack, canGather, gather,
    canBuildRaft, buildRaft, canBoard, boardRaft, canLand, landRaft, samAboard,
    useItem, adjacentGuards, suicide, endTurn, updateFog,
    famished, atkOf, serialize, load,
  };
})();
