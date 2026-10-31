// The headless game: state, rules, agents, commands, events. Never touches the DOM,
// Date.now() or Math.random(); wall time enters only through load/serialize/away.
(function (ID) {
  const N = ID.N, CELL = N.CELL, T = N.TICK, M = ID.Map;
  const CLASSES = ['warrior', 'archer', 'mage', 'priest'];

  // ---------- helpers ----------

  function stat(g, name) {
    let v = N.BASE[name];
    const ups = ID.STAT_UPGRADES[name];
    if (ups) for (const def of ups) v = ID.EFFECTS[def.effect](v, g.upgrades[def.id].level);
    const kind = ID.BONUS_BY_STAT[name];
    if (kind) v = ID.EFFECTS[ID.BONUSES[kind].effect](v, g.boons[kind], N.BONUS_MULT);
    return v;
  }

  // Anything that can sit in a list: a catalog upgrade, or a one-time bonus found in a chest.
  function item(g, id) {
    if (ID.CATALOG_BY_ID[id]) return ID.CATALOG_BY_ID[id];
    const b = g.bonuses[id];
    return b && { id, label: ID.BONUSES[b.kind].label, owner: 'bonus', kind: b.kind, amount: b.amount,
      stat: null, foeMult: 1, action: null, buy: 'bonus' };
  }

  // What the next purchase of an item costs.
  const COST = {
    upgrade: (g, def) => def.baseCost * Math.pow(def.costMult, g.upgrades[def.id].level),
    bonus: (g, def) => g.bonuses[def.id].cost,
  };
  function cost(g, id) { const def = item(g, id); return COST[def.buy](g, def); }

  function emit(g, type, fields) { g.events.push(Object.assign({ type }, fields)); }
  function drain(g) { const e = g.events; g.events = []; return e; }
  function ok(g, extra) { return Object.assign({ ok: true, events: drain(g) }, extra); }
  const FAIL = { ok: false, events: [] };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const leader = g => g.heroes.find(h => h.alive) || g.heroes[0];
  const depthScale = g => Math.pow(N.DEPTH_MULT, g.depth - 1);
  // Upgrades with a foeMult (XP per kill) toughen every monster, at every depth.
  const foeScale = g => ID.CATALOG.reduce((k, d) => k * Math.pow(d.foeMult, g.upgrades[d.id].level), 1);
  // XP for killing an average roster monster right now.
  const avgKillXp = g => N.MONSTER_XP * g.roster.reduce((s, sp) => s + sp.xpMult, 0) / g.roster.length *
    depthScale(g) * stat(g, 'party.xpKill');

  function pickWeighted(rng, odds) {
    let r = rng.next() * Object.values(odds).reduce((a, b) => a + b, 0);
    for (const k in odds) if ((r -= odds[k]) < 0) return k;
    return Object.keys(odds)[0];
  }

  function gainXp(g, amount) { g.xp += amount; g.earned += amount; }

  function moveToward(g, u, tx, ty, speed, r) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const step = Math.min(d, speed * T);
    M.moveBy(g.level, u, dx / d * step, dy / d * step, r);
    if (d > N.FACING_MIN) u.facing = Math.atan2(dy, dx);   // tiny nudges don't flip the sprite
  }

  // Direct if visible, else follow a flow field; falls back to direct when the field has nothing.
  function navigate(g, u, goal, field, speed, r) {
    let p = goal;
    if (field && !M.losWide(g.level, u.x, u.y, goal.x, goal.y, r + 1)) p = M.descend(g.level, field, u.x, u.y) || goal;
    moveToward(g, u, p.x, p.y, speed, r);
  }

  function nearest(list, from, maxD, pred) {
    let best = null, bd = maxD;
    for (const o of list) {
      if (!pred(o)) continue;
      const d = dist(o, from);
      if (d <= bd) { bd = d; best = o; }
    }
    return best;
  }

  const canSee = (g, a, b) => M.los(g.level, a.x, a.y, b.x, b.y);
  const liveMonster = m => !m.dead;
  const monsterById = (g, id) => g.level.monsters.find(m => m.id === id && !m.dead) || null;
  const meleeReach = m => N.HERO_R + m.size + N.MELEE_PAD;

  // How far each class can strike a given monster from.
  const REACH = {
    warrior: (g, m) => meleeReach(m),
    archer: g => stat(g, 'archer.range') * CELL,
    mage: g => stat(g, 'mage.range') * CELL,
    priest: g => stat(g, 'priest.range') * CELL,
  };

  // ---------- game lifecycle ----------

  function makeHero(cls) {
    return { cls, x: 0, y: 0, hp: 0, maxHp: 1, alive: true, cooldown: 0, reviveCooldown: 0,
      targetId: null, facing: 0, flash: 0, corpseField: null, corpseFor: null };
  }

  function newGame(seed) {
    const g = {
      seed: seed >>> 0, rng: null, time: 0, ticks: 0, acc: 0, xp: 0, earned: 0, depth: 1, best: 1,
      upgrades: {}, available: [], purchase: N.START_QUEUE.slice(),
      bonuses: {}, nextBonus: 1, boons: { damage: 0, hp: 0, armor: 0, speed: 0 },
      roster: ID.makeRoster(seed >>> 0), level: null, heroes: CLASSES.map(makeHero),
      wipeTimer: null, events: [], nextId: 1, fieldCell: -1, kills: 0, wipes: 0,
    };
    for (const def of ID.CATALOG) g.upgrades[def.id] = { level: 0 };
    g.available = ID.CATALOG.map(d => d.id).filter(id => !g.purchase.includes(id));
    enterLevel(g, 1, 'start');
    return g;
  }

  const FORMATION = { warrior: [0, 0], archer: [-1, -1], mage: [-1, 1], priest: [-1.7, 0] };

  function enterLevel(g, d, reason) {
    g.depth = d;
    g.best = Math.max(g.best, d);
    const L = g.level = M.generateLevel(g.seed, d);
    g.rng = new ID.Rng(ID.hash(g.seed, 'level', d, g.ticks));
    L.monsters = [];
    L.projectiles = [];
    L.respawnTimer = N.RESPAWN_INTERVAL;
    L.visited = new Float64Array(L.rooms.length).fill(-1e9);
    L.goalRoom = -1;
    L.goalField = null;
    L.goalBest = Infinity;
    L.goalSince = 0;
    L.flow = null;
    g.fieldCell = -1;
    for (const h of g.heroes) {
      const [fx, fy] = FORMATION[h.cls];
      Object.assign(h, { x: L.entrance.x + fx * N.FORMATION_DIST * CELL * 0.6, y: L.entrance.y + fy * N.FORMATION_DIST * CELL * 0.6,
        alive: true, cooldown: 0, reviveCooldown: 0, targetId: null, facing: 0, flash: 0, corpseField: null, corpseFor: null });
      h.maxHp = stat(g, h.cls + '.hp');
      h.hp = h.maxHp;
    }
    while (L.monsters.length < N.MONSTER_CAP && spawnMonster(g, true));
    L.chests = [];
    L.chestTimers = [];
    const rooms = L.rooms.map((_, i) => i).slice(1);
    for (let n = Math.round(N.CHEST_FRAC * L.rooms.length); n > 0 && rooms.length; n--)
      placeChest(g, rooms.splice(g.rng.int(0, rooms.length - 1), 1)[0]);
    rememberPositions(g);
    g.wipeTimer = null;
    emit(g, 'levelEntered', { depth: d, reason });
  }

  function spawnMonster(g, initial) {
    const L = g.level, lead = leader(g);
    const rooms = [];
    for (let i = 0; i < L.rooms.length; i++) {
      if (initial && i === 0) continue;
      if (dist(M.roomCenter(L, i), lead) >= N.SPAWN_MIN_DIST * CELL) rooms.push(i);
    }
    if (!rooms.length) return false;
    const room = g.rng.pick(rooms);
    const p = M.randomPointInRoom(L, g.rng, room);
    addMonster(g, p.x, p.y, room, false);
    return true;
  }

  function addMonster(g, x, y, room, aggro) {
    const spIdx = g.rng.int(0, g.roster.length - 1), sp = g.roster[spIdx];
    const k = depthScale(g) * foeScale(g);
    const maxHp = N.MONSTER_HP * sp.hpMult * k;
    const m = {
      id: g.nextId++, sp: spIdx, x, y, px: x, py: y, size: sp.size, hp: maxHp, maxHp,
      damage: N.MONSTER_DMG * sp.dmgMult * k, speed: N.MONSTER_SPEED * sp.speedMult,
      cooldown: g.rng.range(0, N.MONSTER_INTERVAL), homeRoom: room, aggro,
      wanderTo: null, pause: g.rng.range(0, 2), flash: 0, dead: false, facing: 0,
    };
    g.level.monsters.push(m);
    return m;
  }

  // ---------- chests ----------

  // A bonus's size: one step of its effect, or for armor a flat share of a base monster hit here.
  const BONUS_AMOUNT = {
    damage: () => 1, hp: () => 1, speed: () => 1,
    armor: g => N.BONUS_ARMOR_FRAC * N.MONSTER_DMG * depthScale(g) * foeScale(g),
  };

  // Spots on a circle around the opener, pulled inward until they land in the chest's room.
  function ambushSpots(g, c, at, n) {
    const L = g.level, spots = [], a0 = g.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = a0 + i * Math.PI * 2 / n;
      for (let r = N.AMBUSH_RADIUS; r >= 1.5; r -= 0.5) {
        const x = at.x + Math.cos(a) * r * CELL, y = at.y + Math.sin(a) * r * CELL;
        if (L.roomOf[M.cellIndex(L, x, y)] === c.room && !M.circleHits(L, x, y, 6)) { spots.push({ x, y }); break; }
      }
    }
    return spots;
  }

  const CHEST = {
    xp(g, c) {
      const xp = g.rng.int(N.CHEST_XP_MIN, N.CHEST_XP_MAX) * avgKillXp(g);
      gainXp(g, xp);
      return { xp };
    },
    ambush(g, c, opener) {
      const spots = ambushSpots(g, c, opener, g.rng.int(N.AMBUSH_MIN, N.AMBUSH_MAX));
      for (const p of spots) addMonster(g, p.x, p.y, c.room, true);
      return { spots };
    },
    bonus(g) {
      const kind = g.rng.pick(Object.keys(ID.BONUSES)), id = 'bonus.' + g.nextBonus++;
      g.bonuses[id] = { kind, amount: BONUS_AMOUNT[kind](g), cost: N.BONUS_COST_KILLS * avgKillXp(g) };
      g.purchase.splice(Math.min(1, g.purchase.length), 0, id);
      return { id, kind };
    },
  };

  // A chest sits on the centre cell of its room.
  function placeChest(g, room) {
    const c = M.roomCenter(g.level, room);
    g.level.chests.push({ room, x: (Math.floor(c.x / CELL) + 0.5) * CELL, y: (Math.floor(c.y / CELL) + 0.5) * CELL });
  }

  function openChest(g, c, opener) {
    const L = g.level;
    L.chests = L.chests.filter(o => o !== c);
    L.chestTimers.push(g.rng.range(N.CHEST_RESPAWN_MIN, N.CHEST_RESPAWN_MAX));
    const outcome = pickWeighted(g.rng, N.CHEST_ODDS);
    emit(g, 'chestOpened', Object.assign({ outcome, x: c.x, y: c.y }, CHEST[outcome](g, c, opener)));
  }

  // Each opened chest's replacement appears, after its jitter, in a random room without a chest
  // and away from the party.
  function updateChests(g) {
    const L = g.level, lead = leader(g), leadRoom = L.roomOf[M.cellIndex(L, lead.x, lead.y)];
    for (const c of L.chests.slice()) {
      const opener = g.heroes.find(h => h.alive && dist(h, c) <= N.HERO_R + N.CHEST_R);
      if (opener) openChest(g, c, opener);
    }
    L.chestTimers = L.chestTimers.map(t => t - T).filter(t => {
      if (t > 0) return true;
      const free = L.rooms.map((_, i) => i).filter(i => i !== leadRoom && !L.chests.some(c => c.room === i));
      if (!free.length) return true;
      placeChest(g, g.rng.pick(free));
      return false;
    });
  }

  // The nearest chest the leader can see within CHEST_SIGHT.
  const chestInSight = (g, h) => nearest(g.level.chests, h, N.CHEST_SIGHT * CELL,
    c => M.losWide(g.level, h.x, h.y, c.x, c.y, N.HERO_R + 1));

  // ---------- damage ----------

  function damageMonster(g, m, dmg) {
    if (m.dead) return;
    m.hp -= dmg;
    m.flash = 0.12;
    m.aggro = true;
    if (m.hp > 0) return;
    m.dead = true;
    const sp = g.roster[m.sp];
    const xp = N.MONSTER_XP * sp.xpMult * depthScale(g) * stat(g, 'party.xpKill');
    gainXp(g, xp);
    g.kills++;
    emit(g, 'killed', { monsterId: m.id, name: sp.name, xp, x: m.x, y: m.y });
  }

  function damageHero(g, h, dmg, m) {
    if (!h.alive) return;
    h.hp -= Math.max(1, dmg - stat(g, h.cls + '.armor'));
    h.flash = 0.12;
    if (h.hp > 0) return;
    h.hp = 0;
    h.alive = false;
    emit(g, 'heroDied', { cls: h.cls, by: g.roster[m.sp].name, x: h.x, y: h.y });
  }

  function refreshHeroes(g) {
    for (const h of g.heroes) {
      const max = stat(g, h.cls + '.hp');
      if (h.alive) h.hp *= max / h.maxHp;
      h.maxHp = max;
    }
  }

  // ---------- attacks and projectiles ----------

  const ATTACKS = {
    warrior(g, h, t) {
      damageMonster(g, t, stat(g, 'warrior.damage'));
      emit(g, 'swing', { x: t.x, y: t.y });
    },
    archer(g, h, t) {
      const d = dist(h, t) || 1, v = N.ARROW_SPEED;
      g.level.projectiles.push({ kind: 'arrow', x: h.x, y: h.y, vx: (t.x - h.x) / d * v, vy: (t.y - h.y) / d * v,
        damage: stat(g, 'archer.damage'), pierceLeft: Math.floor(stat(g, 'archer.pierce')), hitIds: [],
        life: stat(g, 'archer.range') * CELL * 1.4 / v, dead: false });
    },
    mage(g, h, t) {
      const d = dist(h, t) || 1, v = N.BOLT_SPEED;
      g.level.projectiles.push({ kind: 'bolt', x: h.x, y: h.y, vx: (t.x - h.x) / d * v, vy: (t.y - h.y) / d * v,
        damage: stat(g, 'mage.damage'), radius: stat(g, 'mage.radius') * CELL, life: d / v + 0.05, dead: false });
    },
    priest(g, h, ally) {
      g.level.projectiles.push({ kind: 'heal', x: h.x, y: h.y - 12, vx: 0, vy: 0, target: g.heroes.indexOf(ally),
        amount: stat(g, 'priest.heal'), life: 3, dead: false });
    },
  };

  function explode(g, p) {
    p.dead = true;
    for (const m of g.level.monsters) if (!m.dead && dist(m, p) <= p.radius + m.size * 0.5) damageMonster(g, m, p.damage);
    emit(g, 'blast', { x: p.x, y: p.y, r: p.radius });
  }

  const PROJECTILES = {
    arrow(g, p) {
      if (p.life <= 0 || M.isWallAt(g.level, p.x, p.y)) { p.dead = true; return; }
      for (const m of g.level.monsters) {
        if (m.dead || p.hitIds.includes(m.id) || dist(m, p) > m.size + 3) continue;
        damageMonster(g, m, p.damage);
        p.hitIds.push(m.id);
        if (p.pierceLeft-- <= 0) { p.dead = true; return; }
      }
    },
    bolt(g, p) {
      if (p.life <= 0 || M.isWallAt(g.level, p.x, p.y) || g.level.monsters.some(m => !m.dead && dist(m, p) <= m.size + 4)) explode(g, p);
    },
    heal(g, p) {
      const ally = g.heroes[p.target];
      if (!ally.alive || p.life <= 0) { p.dead = true; return; }
      const d = dist(ally, p);
      if (d < N.HERO_R + 3) { ally.hp = Math.min(ally.maxHp, ally.hp + p.amount); p.dead = true; return; }
      p.vx = (ally.x - p.x) / d * N.HEAL_SPEED;
      p.vy = (ally.y - p.y) / d * N.HEAL_SPEED;
    },
  };

  // Fire as many times as the cooldown allows this tick (very fast attackers can exceed one per tick).
  function strike(g, h, target, interval, fire) {
    if (!target) { h.cooldown = Math.max(h.cooldown, 0); return; }
    for (let shots = 0; h.cooldown <= 0 && shots < 8; shots++) {
      fire(g, h, target);
      h.cooldown += interval;
    }
    if (h.cooldown < 0) h.cooldown = 0;
  }

  // ---------- party AI ----------

  function wander(g, h) {
    const L = g.level, speed = stat(g, 'party.move');
    const room = L.roomOf[M.cellIndex(L, h.x, h.y)];
    if (room >= 0) L.visited[room] = g.time;
    const chest = chestInSight(g, h);
    if (chest) { L.goalSince = g.time; moveToward(g, h, chest.x, chest.y, speed, N.HERO_R); return; }
    const goal = L.goalRoom >= 0 ? M.roomCenter(L, L.goalRoom) : null;
    // Safety valve: no progress toward the goal for STUCK_TIME means pick another.
    const d = goal ? dist(h, goal) : 0;
    if (goal && d < L.goalBest - 4) { L.goalBest = d; L.goalSince = g.time; }
    const stuck = goal && g.time - L.goalSince > N.STUCK_TIME;
    if (!goal || stuck || (room === L.goalRoom && d < 2 * CELL)) {
      const others = L.rooms.map((_, i) => i).filter(i => i !== room).sort((a, b) => L.visited[a] - L.visited[b]);
      L.goalRoom = others[g.rng.int(0, Math.min(2, others.length - 1))];
      const c = M.roomCenter(L, L.goalRoom);
      L.goalField = M.bfs(L, M.cellIndex(L, c.x, c.y));
      L.goalBest = Infinity;
      L.goalSince = g.time;
    }
    navigate(g, h, M.roomCenter(L, L.goalRoom), L.goalField, speed, N.HERO_R);
  }

  // How far into its reach a leader closes before stopping (ranged leaders keep a margin).
  const LEAD_CLOSE = { warrior: 1, archer: 0.8, mage: 0.8, priest: 0.8 };

  function leadMove(g, h, t) {
    if (!t) { wander(g, h); return; }
    const want = REACH[h.cls](g, t) * LEAD_CLOSE[h.cls] - 2;
    if (dist(h, t) > want) navigate(g, h, t, g.level.flow, stat(g, 'party.move'), N.HERO_R);
    else h.facing = Math.atan2(t.y - h.y, t.x - h.x);
  }

  function followMove(g, h, lead) {
    const L = g.level, speed = stat(g, 'party.move');
    const threat = nearest(L.monsters, h, N.KITE_DIST * CELL, liveMonster);
    if (threat) {
      const d = dist(h, threat) || 1;
      moveToward(g, h, h.x + (h.x - threat.x) / d * CELL, h.y + (h.y - threat.y) / d * CELL, speed, N.HERO_R);
      h.facing = Math.atan2(threat.y - h.y, threat.x - h.x);
      return;
    }
    const c = Math.cos(lead.facing), s = Math.sin(lead.facing), k = N.FORMATION_DIST * CELL;
    const spot = ([fx, fy]) => ({ x: lead.x + (fx * c - fy * s) * k, y: lead.y + (fx * s + fy * c) * k });
    // Formation spot, else straight behind the leader, else just keep within a couple of spacings.
    const fp = [FORMATION[h.cls], [-1, 0]].map(spot).find(p => !M.circleHits(L, p.x, p.y, N.HERO_R));
    if (fp) { if (dist(h, fp) > 6) navigate(g, h, fp, L.flow, speed, N.HERO_R); }
    else if (dist(h, lead) > 2 * k) navigate(g, h, lead, L.flow, speed, N.HERO_R);
  }

  function pickTarget(g, h, isLead, lead) {
    const L = g.level;
    if (isLead) return nearest(L.monsters, h, N.TANK_AGGRO * CELL, m => !m.dead && canSee(g, h, m));
    const range = REACH[h.cls](g);
    const lt = monsterById(g, lead.targetId);
    if (lt && dist(h, lt) <= range && canSee(g, h, lt)) return lt;
    return nearest(L.monsters, h, range, m => !m.dead && canSee(g, h, m));
  }

  function fighterBrain(g, h, isLead, lead) {
    const t = pickTarget(g, h, isLead, lead);
    h.targetId = t ? t.id : null;
    if (isLead) leadMove(g, h, t); else followMove(g, h, lead);
    const inReach = t && dist(h, t) <= REACH[h.cls](g, t);
    if (inReach) h.facing = Math.atan2(t.y - h.y, t.x - h.x);
    strike(g, h, inReach ? t : null, stat(g, h.cls + '.interval'), ATTACKS[h.cls]);
  }

  function priestBrain(g, h, isLead, lead) {
    const L = g.level;
    h.reviveCooldown -= T;
    const corpse = h.reviveCooldown <= 0 ? nearest(g.heroes, h, Infinity, o => !o.alive) : null;
    if (corpse) {
      if (dist(h, corpse) <= N.REVIVE_RANGE * CELL) {
        corpse.alive = true;
        corpse.hp = corpse.maxHp * N.REVIVE_HP_FRAC;
        corpse.cooldown = 0;
        h.reviveCooldown = stat(g, 'priest.revive');
        h.corpseField = null;
        emit(g, 'revived', { cls: corpse.cls, x: corpse.x, y: corpse.y });
      } else {
        if (h.corpseFor !== corpse) { h.corpseFor = corpse; h.corpseField = M.bfs(L, M.cellIndex(L, corpse.x, corpse.y)); }
        navigate(g, h, corpse, h.corpseField, stat(g, 'party.move'), N.HERO_R);
      }
      return;
    }
    h.corpseFor = null;
    const range = REACH.priest(g);
    let ally = null, worst = 1;
    for (const o of g.heroes) {
      const f = o.hp / o.maxHp;
      if (o.alive && f < worst && dist(o, h) <= range && canSee(g, h, o)) { worst = f; ally = o; }
    }
    if (isLead) wander(g, h); else followMove(g, h, lead);
    strike(g, h, ally, stat(g, 'priest.interval'), ATTACKS.priest);
  }

  const BRAINS = { warrior: fighterBrain, archer: fighterBrain, mage: fighterBrain, priest: priestBrain };

  // ---------- monster AI ----------

  function monsterTarget(g, m) {
    const w = g.heroes[0];
    if (w.alive && dist(m, w) <= stat(g, 'warrior.taunt') * CELL) return w;
    const range = N.MONSTER_AGGRO * CELL * (m.aggro ? 1.5 : 1);
    return nearest(g.heroes, m, range, h => h.alive && canSee(g, m, h));
  }

  function monsterBrain(g, m) {
    const L = g.level;
    m.cooldown -= T;
    const t = monsterTarget(g, m);
    if (!t) {
      m.aggro = false;
      m.cooldown = Math.max(m.cooldown, 0);
      if (m.pause > 0) { m.pause -= T; return; }
      if (!m.wanderTo) m.wanderTo = M.randomPointInRoom(L, g.rng, m.homeRoom);
      moveToward(g, m, m.wanderTo.x, m.wanderTo.y, m.speed * 0.4, m.size);
      if (dist(m, m.wanderTo) < 4) { m.wanderTo = null; m.pause = g.rng.range(0.5, 2.5); }
      return;
    }
    m.aggro = true;
    const reach = meleeReach(m), d = dist(m, t);
    if (d > reach - 2) navigate(g, m, t, L.flow, m.speed, m.size);
    if (d <= reach) {
      for (let n = 0; m.cooldown <= 0 && n < 8; n++) { damageHero(g, t, m.damage, m); m.cooldown += N.MONSTER_INTERVAL; }
    }
  }

  // ---------- the tick ----------

  const ACTIONS = { descend: g => enterLevel(g, g.depth + 1, 'descend') };

  // Buying the head: an upgrade levels up and rejoins the end of the queue; a bonus is spent and gone.
  const BUY = {
    upgrade(g, def, c) {
      g.upgrades[def.id].level++;
      g.purchase.push(def.id);
      emit(g, 'purchased', { id: def.id, level: g.upgrades[def.id].level, cost: c });
    },
    bonus(g, def, c) {
      g.boons[def.kind] += def.amount;
      delete g.bonuses[def.id];
      emit(g, 'bonusBought', { id: def.id, kind: def.kind, amount: def.amount, cost: c });
    },
  };

  function autoPurchase(g) {
    for (let guard = 0; g.purchase.length && guard < 1000; guard++) {
      const def = item(g, g.purchase[0]), c = cost(g, def.id);
      if (g.xp < c) break;
      g.xp -= c;
      g.purchase.shift();
      BUY[def.buy](g, def, c);
      refreshHeroes(g);
      if (def.action) ACTIONS[def.action](g);
    }
  }

  function separate(g) {
    const units = [];
    for (const h of g.heroes) if (h.alive) units.push([h, N.HERO_R]);
    for (const m of g.level.monsters) if (!m.dead) units.push([m, m.size]);
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const [a, ra] = units[i], [b, rb] = units[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const min = (ra + rb) * 0.85;
        if (d >= min) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (min - d) / 2;
        M.moveBy(g.level, a, -dx / d * push, -dy / d * push, ra);
        M.moveBy(g.level, b, dx / d * push, dy / d * push, rb);
      }
    }
  }

  // Display-only: where each unit was at the start of the tick, so the renderer can interpolate.
  function rememberPositions(g) {
    for (const u of g.heroes) { u.px = u.x; u.py = u.y; }
    for (const u of g.level.monsters) { u.px = u.x; u.py = u.y; }
    for (const u of g.level.projectiles) { u.px = u.x; u.py = u.y; }
  }

  function step(g) {
    rememberPositions(g);
    g.time += T;
    g.ticks++;
    gainXp(g, stat(g, 'party.xpRate') * T);
    autoPurchase(g);
    if (g.wipeTimer !== null) {
      g.wipeTimer -= T;
      if (g.wipeTimer <= 0) enterLevel(g, g.depth, 'wipe');
      return;
    }
    const L = g.level, lead = leader(g);
    const c = M.cellIndex(L, lead.x, lead.y);
    if (c !== g.fieldCell) { L.flow = M.bfs(L, c); g.fieldCell = c; }

    for (const h of g.heroes) {
      h.flash = Math.max(0, h.flash - T);
      if (!h.alive) continue;
      h.cooldown -= T;
      BRAINS[h.cls](g, h, h === lead, lead);
    }
    for (const m of L.monsters) {
      m.flash = Math.max(0, m.flash - T);
      if (!m.dead) monsterBrain(g, m);
    }
    for (const p of L.projectiles) {
      p.x += p.vx * T;
      p.y += p.vy * T;
      p.life -= T;
      PROJECTILES[p.kind](g, p);
    }
    separate(g);
    updateChests(g);
    L.monsters = L.monsters.filter(liveMonster);
    L.projectiles = L.projectiles.filter(p => !p.dead);

    L.respawnTimer -= T;
    if (L.respawnTimer <= 0) {
      if (L.monsters.length < N.MONSTER_CAP) spawnMonster(g, false);
      L.respawnTimer = N.RESPAWN_INTERVAL;
    }
    if (!g.heroes.some(h => h.alive)) {
      g.wipeTimer = N.WIPE_DELAY;
      g.wipes++;
      emit(g, 'wiped', { depth: g.depth });
    }
  }

  // ---------- commands ----------

  function tick(g, dt) {
    if (!(dt > 0)) return FAIL;
    g.acc += dt;
    for (let n = 0; g.acc >= T && n < N.MAX_STEPS_PER_FRAME; n++) { step(g); g.acc -= T; }
    if (g.acc > T * N.MAX_STEPS_PER_FRAME) g.acc = 0;
    return ok(g);
  }

  function credit(g, seconds) {
    const xp = stat(g, 'party.xpRate') * seconds;
    gainXp(g, xp);
    emit(g, 'offline', { seconds, xp });
    autoPurchase(g);
  }

  function away(g, seconds) {
    if (!(seconds > 0)) return FAIL;
    credit(g, seconds);
    return ok(g);
  }

  // Catalog order first, then bonuses in the order they were found.
  function sortAvailable(g) {
    const set = new Set(g.available);
    const found = Object.keys(g.bonuses).sort((a, b) => a.split('.')[1] - b.split('.')[1]);
    g.available = ID.CATALOG.map(d => d.id).concat(found).filter(id => set.has(id));
  }

  function queue(g, id, index) {
    if (!g.available.includes(id) || !(index >= 0 && index <= g.purchase.length)) return FAIL;
    g.available = g.available.filter(x => x !== id);
    g.purchase.splice(index, 0, id);
    return ok(g);
  }

  function reorder(g, id, index) {
    const i = g.purchase.indexOf(id);
    if (i < 0 || !(index >= 0 && index < g.purchase.length)) return FAIL;
    g.purchase.splice(i, 1);
    g.purchase.splice(index, 0, id);
    return ok(g);
  }

  function unqueue(g, id) {
    if (!g.purchase.includes(id)) return FAIL;
    g.purchase = g.purchase.filter(x => x !== id);
    g.available.push(id);
    sortAvailable(g);
    return ok(g);
  }

  function serialize(g, now) {
    const levels = {};
    for (const id in g.upgrades) levels[id] = g.upgrades[id].level;
    return { seed: g.seed, xp: g.xp, earned: g.earned, depth: g.depth, best: g.best, kills: g.kills, wipes: g.wipes,
      time: g.time, levels, available: g.available.slice(), purchase: g.purchase.slice(),
      bonuses: JSON.parse(JSON.stringify(g.bonuses)), nextBonus: g.nextBonus, boons: Object.assign({}, g.boons), savedAt: now };
  }

  // Rebuild from a save; returns { ok, game, events }. A save that doesn't fit the catalog is refused.
  function load(save, now) {
    const catalog = ID.CATALOG.map(d => d.id), bonuses = save.bonuses || {};
    const ids = catalog.concat(Object.keys(bonuses));
    const listed = (save.available || []).concat(save.purchase || []);
    if (listed.length !== ids.length || !ids.every(id => listed.includes(id))) return FAIL;
    const g = newGame(save.seed);
    for (const id of catalog) g.upgrades[id].level = (save.levels && save.levels[id]) | 0;
    Object.assign(g, { xp: save.xp, earned: save.earned || 0, best: save.best || 1, kills: save.kills || 0,
      wipes: save.wipes || 0, time: save.time || 0, available: save.available.slice(), purchase: save.purchase.slice(),
      bonuses: JSON.parse(JSON.stringify(bonuses)), nextBonus: save.nextBonus || 1, boons: Object.assign(g.boons, save.boons) });
    g.events = [];
    enterLevel(g, save.depth, 'load');
    const gone = (now - save.savedAt) / 1000;
    if (gone > 1) credit(g, gone);
    return Object.assign(ok(g), { game: g });
  }

  ID.Engine = {
    newGame, tick, away, queue, reorder, unqueue, serialize, load,
    stat, cost, item, leader, step, foeScale,
  };
})(this.ID = this.ID || {});
