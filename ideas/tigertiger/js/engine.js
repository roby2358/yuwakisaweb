'use strict';

// TIGER! TIGER! — rules engine. No DOM access.
// Every player action mutates state and returns an ordered event list;
// the UI replays events as animation. When AP runs out the enemy phase
// resolves inside the same call, so one action can return a whole turn.

var GameEngine = (function () {
  var T = GameArtifacts.TUNING;
  var TERRAIN = GameArtifacts.TERRAIN;
  var S = GameState;

  function logLine(state, text, cls) {
    state.log.push({ turn: state.turn, text: text, cls: cls });
  }

  function foyleWalkable(state, x, y) {
    if (!S.inBounds(x, y)) return false;
    return TERRAIN[S.tileAt(state, x, y).t].foyleWalk;
  }

  function hunterWalkable(state, x, y) {
    if (!S.inBounds(x, y)) return false;
    return TERRAIN[S.tileAt(state, x, y).t].hunterWalk;
  }

  function inTiger(state) { return state.tigerTurns > 0; }

  function raiseRage(state, amount) {
    state.rage = Math.min(T.RAGE_MAX, state.rage + amount);
    state.ragedThisTurn = true;
  }

  function alertHuntersNear(state, x, y, radius, events) {
    var count = 0;
    state.hunters.forEach(function (h) {
      if (S.chebyshev(h.x, h.y, x, y) > radius) return;
      h.alert = { x: x, y: y };
      count += 1;
    });
    if (count === 0) return;
    events.push({ type: 'ping', x: x, y: y });
    logLine(state, count + ' hunter(s) turn toward the jaunte-shock.', 'bad');
  }

  // --- Arrival side effects ----------------------------------------------

  function checkInformant(state, events) {
    var here = state.informants.find(function (n) {
      return !n.used && n.x === state.foyle.x && n.y === state.foyle.y;
    });
    if (!here) return;
    here.used = true;
    var crew = state.crew[here.crewIndex];
    events.push({ type: 'informant', x: here.x, y: here.y });
    if (crew.confronted || crew.revealed) {
      logLine(state, 'The informant has nothing new. "Word travels, Mr. Foyle."', 'dim');
      return;
    }
    crew.revealed = true;
    events.push({ type: 'reveal', crewName: crew.name });
    logLine(state, 'Informant: "' + crew.name + '. ' + crew.city + '. You did not hear it from me, is all."', 'info');
  }

  function checkPyre(state, events) {
    var p = state.pyre;
    if (p.found || p.x !== state.foyle.x || p.y !== state.foyle.y) return;
    p.found = true;
    events.push({ type: 'pickupPyre' });
    logLine(state, 'You lift a slug of dull metal: PyrE. It waits for Will and Idea. Detonable only while the tiger burns.', 'gold');
  }

  function revealCitadel(state, events) {
    state.citadel.revealed = true;
    events.push({ type: 'revealCitadel', x: state.citadel.x, y: state.citadel.y });
    logLine(state, 'Olivia Presteign. The citadel is marked on your map. Go, tiger.', 'gold');
  }

  function checkCrew(state, events) {
    var here = state.crew.find(function (c) {
      return !c.confronted && c.x === state.foyle.x && c.y === state.foyle.y;
    });
    if (!here) return;
    here.confronted = true;
    here.revealed = true;
    state.manhunt += 1;
    raiseRage(state, T.RAGE_CONFESSION);
    events.push({ type: 'confront', crewName: here.name });
    logLine(state, 'You corner ' + here.name + '. ' + here.confession, 'gold');
    logLine(state, 'The manhunt tightens. Manhunt level ' + state.manhunt + '.', 'bad');
    alertHuntersNear(state, state.foyle.x, state.foyle.y, T.CONFRONT_PING, events);
    var remaining = state.crew.filter(function (c) { return !c.confronted; }).length;
    if (remaining === 0) revealCitadel(state, events);
  }

  function checkCitadel(state, events) {
    var c = state.citadel;
    if (!c.revealed || c.x !== state.foyle.x || c.y !== state.foyle.y) return;
    state.over = true;
    state.ending = 'choice';
    events.push({ type: 'citadel' });
    logLine(state, 'You stand before Olivia Presteign — ice, snow, and blind ruby eyes.', 'gold');
  }

  function arrive(state, x, y, events) {
    state.foyle.x = x;
    state.foyle.y = y;
    S.tileAt(state, x, y).visited = true;
    var revealed = S.updateSight(state);
    revealed.forEach(function (c) {
      events.push({ type: 'reveal', crewName: c.name });
      logLine(state, 'You spot ' + c.name + ' skulking nearby. Vorga crew, him.', 'info');
    });
    checkInformant(state, events);
    checkPyre(state, events);
    checkCrew(state, events);
    checkCitadel(state, events);
  }

  // --- Hunter pathfinding -------------------------------------------------

  function astarStep(state, hunter, tx, ty) {
    // Full A* to the target, return the first step. Global vision: hunters
    // plan whole detours, they do not get stuck on coastlines.
    var start = S.idx(hunter.x, hunter.y);
    var goal = S.idx(tx, ty);
    if (start === goal) return null;
    var open = [{ i: start, g: 0, f: 0 }];
    var cameFrom = {};
    var gScore = {};
    gScore[start] = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var closed = {};

    while (open.length > 0) {
      var best = 0;
      for (var k = 1; k < open.length; k++) if (open[k].f < open[best].f) best = k;
      var cur = open.splice(best, 1)[0];
      if (cur.i === goal) return firstStepOf(cameFrom, start, goal);
      if (closed[cur.i]) continue;
      closed[cur.i] = true;
      var cx = cur.i % T.GRID_W, cy = Math.floor(cur.i / T.GRID_W);
      for (var d = 0; d < 4; d++) {
        var nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        var ni = S.idx(nx, ny);
        var enterable = hunterWalkable(state, nx, ny) || ni === goal;
        if (!enterable) continue;
        var g = gScore[cur.i] + 1;
        if (gScore[ni] !== undefined && g >= gScore[ni]) continue;
        gScore[ni] = g;
        cameFrom[ni] = cur.i;
        var h = Math.abs(nx - tx) + Math.abs(ny - ty);
        open.push({ i: ni, g: g, f: g + h });
      }
    }
    return null;
  }

  function firstStepOf(cameFrom, start, goal) {
    var node = goal;
    while (cameFrom[node] !== start) node = cameFrom[node];
    return { x: node % T.GRID_W, y: Math.floor(node / T.GRID_W) };
  }

  function patrolStep(state, hunter) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var options = dirs
      .map(function (d) { return { x: hunter.x + d[0], y: hunter.y + d[1] }; })
      .filter(function (p) { return hunterWalkable(state, p.x, p.y); });
    if (options.length === 0) return null;
    return options[S.pickInt(state.rng, options.length)];
  }

  // --- Enemy phase ----------------------------------------------------------

  function hunterAttack(state, hunter, events) {
    hunter.attackedThisTurn = true;
    state.hp -= 1;
    raiseRage(state, T.RAGE_WOUND);
    events.push({ type: 'attack', id: hunter.id, x: state.foyle.x, y: state.foyle.y });
    logLine(state, hunter.name + ' guns you down the street. Vitality ' + state.hp + '.', 'bad');
  }

  function updateHunterAlert(state, hunter) {
    if (inTiger(state)) {
      hunter.alert = { x: state.foyle.x, y: state.foyle.y };
      return;
    }
    var sees = S.chebyshev(hunter.x, hunter.y, state.foyle.x, state.foyle.y) <= hunter.sight;
    if (sees) {
      hunter.alert = { x: state.foyle.x, y: state.foyle.y };
      return;
    }
    if (hunter.alert && hunter.alert.x === hunter.x && hunter.alert.y === hunter.y) {
      hunter.alert = null; // reached last known position, trail is cold
    }
  }

  function moveHunter(state, hunter, events) {
    hunter.attackedThisTurn = false;
    for (var step = 0; step < hunter.speed; step++) {
      updateHunterAlert(state, hunter);
      if (hunter.attackedThisTurn) return;
      if (S.chebyshev(hunter.x, hunter.y, state.foyle.x, state.foyle.y) <= 1) {
        hunterAttack(state, hunter, events);
        return;
      }
      var next = hunter.alert
        ? astarStep(state, hunter, hunter.alert.x, hunter.alert.y)
        : patrolStep(state, hunter);
      if (!next) return;
      hunter.x = next.x;
      hunter.y = next.y;
      events.push({ type: 'hstep', id: hunter.id, x: next.x, y: next.y });
    }
    updateHunterAlert(state, hunter);
    if (!hunter.attackedThisTurn && S.chebyshev(hunter.x, hunter.y, state.foyle.x, state.foyle.y) <= 1) {
      hunterAttack(state, hunter, events);
    }
  }

  function checkDeath(state, events) {
    if (state.hp > 0) return false;
    state.over = true;
    state.ending = 'captured';
    events.push({ type: 'death' });
    logLine(state, 'Darkness. You wake in Gouffre Martel, the lightless hospital-cavern. The hunt is over.', 'bad');
    return true;
  }

  function terrainEndOfTurn(state, events) {
    var t = S.tileAt(state, state.foyle.x, state.foyle.y).t;
    if (t === 'RAD') {
      state.hp -= 1;
      raiseRage(state, T.RAGE_WOUND);
      events.push({ type: 'burn', x: state.foyle.x, y: state.foyle.y });
      logLine(state, 'The radiation sears you — the Burning Man. Vitality ' + state.hp + ', rage rising.', 'bad');
      return;
    }
    if (t === 'WRECK' && state.hp < T.HP_MAX) {
      state.hp += 1;
      events.push({ type: 'heal' });
      logLine(state, 'You patch yourself in the Nomad\'s tool locker. Vitality ' + state.hp + '.', 'info');
    }
  }

  function rageEndOfTurn(state, events) {
    var hunterVisible = state.hunters.some(function (h) {
      return S.chebyshev(h.x, h.y, state.foyle.x, state.foyle.y) <= T.SIGHT;
    });
    if (hunterVisible) raiseRage(state, T.RAGE_HUNTED);

    if (!inTiger(state) && state.rage >= T.RAGE_MAX) {
      state.tigerTurns = T.TIGER_TURNS;
      events.push({ type: 'tigerOn' });
      logLine(state, 'The stigmata blazes blood-red: TIGER! TIGER! Every hunter feels you. Nothing can stop you.', 'tiger');
      return;
    }
    if (!state.ragedThisTurn && !inTiger(state) && state.rage > 0) state.rage -= 1;
    if (inTiger(state)) {
      state.tigerTurns -= 1;
      if (state.tigerTurns === 0) {
        state.rage = T.RAGE_AFTER_TIGER;
        events.push({ type: 'tigerOff' });
        logLine(state, 'The mask fades under your skin. You are only a man again.', 'dim');
      }
    }
  }

  function spawnEndOfTurn(state, events) {
    state.spawnCooldown -= 1;
    if (state.spawnCooldown > 0) return;
    state.spawnCooldown = Math.max(T.SPAWN_MIN, T.SPAWN_BASE - state.manhunt);
    var cap = T.HUNTER_CAP_BASE + state.manhunt;
    if (state.hunters.length >= cap) return;
    var elite = state.manhunt >= T.ELITE_MANHUNT && state.rng() < 0.5;
    var hunter = GameState.makeHunter(state, elite);
    state.hunters.push(hunter);
    events.push({ type: 'spawn', id: hunter.id, x: hunter.x, y: hunter.y });
    logLine(state, hunter.name + ' jauntes in at a public stage.', 'bad');
  }

  function mutterMaybe(state) {
    if (state.rng() >= 0.15) return;
    var lines = GameArtifacts.FOYLE_MUTTERS;
    logLine(state, lines[S.pickInt(state.rng, lines.length)], 'dim');
  }

  function endTurn(state, events) {
    state.hunters.forEach(function (h) {
      if (state.over) return;
      moveHunter(state, h, events);
    });
    if (checkDeath(state, events)) return;
    terrainEndOfTurn(state, events);
    if (checkDeath(state, events)) return;
    rageEndOfTurn(state, events);
    spawnEndOfTurn(state, events);
    mutterMaybe(state);
    state.turn += 1;
    state.ap = inTiger(state) ? T.AP_TIGER : T.AP_NORMAL;
    state.ragedThisTurn = false;
    S.updateSight(state);
    events.push({ type: 'turn', turn: state.turn });
  }

  function spendAp(state, events) {
    state.ap -= 1;
    if (state.ap <= 0 && !state.over) endTurn(state, events);
  }

  // --- Player actions -------------------------------------------------------

  function tryStep(state, dx, dy) {
    if (state.over || state.ap <= 0) return null;
    var nx = state.foyle.x + dx, ny = state.foyle.y + dy;
    if (!foyleWalkable(state, nx, ny)) return null;
    var events = [{ type: 'step', x: nx, y: ny }];
    arrive(state, nx, ny, events);
    if (!state.over) spendAp(state, events);
    return events;
  }

  function canJaunte(state, x, y) {
    if (!S.inBounds(x, y)) return false;
    if (!foyleWalkable(state, x, y)) return false;
    if (x === state.foyle.x && y === state.foyle.y) return false;
    var tile = S.tileAt(state, x, y);
    if (tile.visited) return true;
    return inTiger(state) && tile.seen;
  }

  function tryJaunte(state, x, y) {
    if (state.over || state.ap <= 0) return null;
    if (!canJaunte(state, x, y)) return null;
    var events = [{ type: 'jaunte', fx: state.foyle.x, fy: state.foyle.y, x: x, y: y }];
    logLine(state, 'You jaunte.', 'dim');
    state.foyle.x = x;
    state.foyle.y = y;
    alertHuntersNear(state, x, y, T.PING_RADIUS, events);
    arrive(state, x, y, events);
    if (!state.over) spendAp(state, events);
    return events;
  }

  function wait(state) {
    if (state.over) return null;
    var events = [];
    endTurn(state, events);
    return events;
  }

  function canDetonate(state) {
    return state.pyre.found && !state.pyre.used && inTiger(state) && state.ap > 0 && !state.over;
  }

  function detonatePyre(state) {
    if (!canDetonate(state)) return null;
    state.pyre.used = true;
    var fx = state.foyle.x, fy = state.foyle.y;
    var events = [{ type: 'detonate', x: fx, y: fy }];
    var before = state.hunters.length;
    state.hunters = state.hunters.filter(function (h) {
      return S.chebyshev(h.x, h.y, fx, fy) > T.PYRE_RADIUS;
    });
    var killed = before - state.hunters.length;
    var leveled = 0;
    state.grid.forEach(function (tile, i) {
      if (tile.t !== 'RUIN') return;
      var x = i % T.GRID_W, y = Math.floor(i / T.GRID_W);
      if (S.chebyshev(x, y, fx, fy) > T.PYRE_RADIUS) return;
      tile.t = 'OPEN';
      leveled += 1;
    });
    logLine(state, 'Will and Idea. PyrE detonates — ' + killed + ' hunter(s) vaporized, ' + leveled + ' ruins leveled.', 'tiger');
    spendAp(state, events);
    return events;
  }

  function chooseEnding(state, kind) {
    if (state.ending !== 'choice') return null;
    if (kind !== 'vengeance' && kind !== 'stars') return null;
    state.ending = kind;
    if (kind === 'vengeance') {
      logLine(state, '"Vorga, I kill you filthy." The tiger takes its due.', 'tiger');
      return kind;
    }
    logLine(state, 'You let the rage go — and jaunte where no man has jaunted: into the naked stars.', 'gold');
    return kind;
  }

  return {
    tryStep: tryStep,
    tryJaunte: tryJaunte,
    canJaunte: canJaunte,
    wait: wait,
    detonatePyre: detonatePyre,
    canDetonate: canDetonate,
    chooseEnding: chooseEnding,
    logLine: logLine
  };
})();
