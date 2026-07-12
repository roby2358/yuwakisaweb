'use strict';

// TIGER! TIGER! — engine unit tests.
// Runs in the browser via tests.html and in Node via run-node.js.
// Tests build a real game from a fixed seed, then arrange the struct directly.

var GameTests = (function () {
  var SEED = 12345;
  var T = GameArtifacts.TUNING;
  var results = [];

  function assert(cond, label) {
    results.push({ ok: !!cond, label: label });
  }

  function quietState() {
    // A real generated game, arranged for isolation: no hunters, no spawns.
    var state = GameState.newGame(SEED);
    state.hunters = [];
    state.spawnCooldown = 999;
    return state;
  }

  function walkableNeighborOf(state, x, y) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var found = null;
    dirs.forEach(function (d) {
      if (found) return;
      var nx = x + d[0], ny = y + d[1];
      if (!GameState.inBounds(nx, ny)) return;
      if (!GameArtifacts.TERRAIN[GameState.tileAt(state, nx, ny).t].foyleWalk) return;
      found = { x: nx, y: ny };
    });
    return found;
  }

  function stepOnto(state, x, y) {
    var from = walkableNeighborOf(state, x, y);
    state.foyle.x = from.x;
    state.foyle.y = from.y;
    state.ap = 5; // headroom so the enemy phase never fires mid-test
    return GameEngine.tryStep(state, x - from.x, y - from.y);
  }

  function testMapGeneration() {
    var state = GameState.newGame(SEED);
    assert(state.crew.length === 5, 'five Vorga crew are placed');
    assert(state.hunters.length === T.START_HUNTERS, 'starting hunters are placed');
    var reachable = GameState.openTilesReachableFrom(state.grid, state.wreck.x, state.wreck.y);
    var pois = state.crew.concat(state.informants, [state.pyre, state.citadel]);
    var allReachable = pois.every(function (p) { return reachable[GameState.idx(p.x, p.y)]; });
    assert(allReachable, 'every point of interest is reachable from the wreck');
    assert(GameState.tileAt(state, state.foyle.x, state.foyle.y).visited, 'start tile is memorized');
  }

  function testJaunteRequiresMemory() {
    var state = quietState();
    var far = state.crew[0];
    assert(GameEngine.tryJaunte(state, far.x, far.y) === null, 'jaunting blind to an unvisited tile fails');

    state.ap = 5;
    var neighbor = walkableNeighborOf(state, state.foyle.x, state.foyle.y);
    GameEngine.tryStep(state, neighbor.x - state.foyle.x, neighbor.y - state.foyle.y);
    var events = GameEngine.tryJaunte(state, state.wreck.x, state.wreck.y);
    assert(events !== null, 'jaunting to a memorized tile succeeds');
    assert(state.foyle.x === state.wreck.x && state.foyle.y === state.wreck.y, 'jaunte moved Foyle');
  }

  function testJauntePingAlertsHunters() {
    var state = quietState();
    state.ap = 5;
    var hunter = GameState.makeHunter(state, false);
    hunter.x = Math.min(T.GRID_W - 1, state.wreck.x + T.PING_RADIUS - 1);
    hunter.y = state.wreck.y;
    hunter.alert = null;
    state.hunters = [hunter];

    var neighbor = walkableNeighborOf(state, state.foyle.x, state.foyle.y);
    GameEngine.tryStep(state, neighbor.x - state.foyle.x, neighbor.y - state.foyle.y);
    var events = GameEngine.tryJaunte(state, state.wreck.x, state.wreck.y);
    var pinged = events.some(function (e) { return e.type === 'ping'; });
    assert(pinged, 'jaunte emits a ping event when hunters are in range');
    assert(hunter.alert !== null, 'hunter in ping radius is alerted to the arrival tile');
    assert(hunter.alert.x === state.wreck.x && hunter.alert.y === state.wreck.y, 'alert points at the jaunte arrival');
  }

  function testRageTriggersTiger() {
    var state = quietState();
    state.rage = T.RAGE_MAX;
    var events = GameEngine.wait(state);
    assert(events.some(function (e) { return e.type === 'tigerOn'; }), 'full rage triggers TIGER mode at end of turn');
    assert(state.tigerTurns === T.TIGER_TURNS, 'TIGER mode lasts the tuned duration');
    assert(state.ap === T.AP_TIGER, 'TIGER mode grants extra actions');
  }

  function testTigerExpires() {
    var state = quietState();
    state.tigerTurns = 1;
    var events = GameEngine.wait(state);
    assert(events.some(function (e) { return e.type === 'tigerOff'; }), 'TIGER mode ends when the countdown expires');
    assert(state.rage === T.RAGE_AFTER_TIGER, 'rage resets after TIGER mode');
  }

  function testRadiationBurns() {
    var state = quietState();
    var radIndex = state.grid.findIndex(function (tile) { return tile.t === 'RAD'; });
    assert(radIndex >= 0, 'map contains radiation terrain');
    state.foyle.x = radIndex % T.GRID_W;
    state.foyle.y = Math.floor(radIndex / T.GRID_W);
    var hpBefore = state.hp;
    var rageBefore = state.rage;
    GameEngine.wait(state);
    assert(state.hp === hpBefore - 1, 'ending a turn in radiation costs 1 vitality');
    assert(state.rage > rageBefore, 'radiation burn raises rage');
  }

  function testWreckHeals() {
    var state = quietState();
    state.hp = 2;
    GameEngine.wait(state); // Foyle starts on the wreck
    assert(state.hp === 3, 'ending a turn on the wreck heals 1 vitality');
  }

  function testHunterAttackAndCapture() {
    var state = quietState();
    var hunter = GameState.makeHunter(state, false);
    hunter.x = state.foyle.x + 1;
    hunter.y = state.foyle.y;
    state.hunters = [hunter];
    state.hp = 2; // wreck heal after the attack: 2 - 1 + 1 = 2
    GameEngine.wait(state);
    assert(state.hp === 2 && state.rage >= T.RAGE_WOUND, 'adjacent hunter wounds Foyle and stokes rage');

    state.hp = 1;
    var events = GameEngine.wait(state);
    assert(state.over && state.ending === 'captured', 'losing all vitality means capture');
    assert(events.some(function (e) { return e.type === 'death'; }), 'capture emits a death event');
  }

  function testConfrontationsRevealCitadel() {
    var state = quietState();
    var manhuntBefore = state.manhunt;
    state.crew.forEach(function (c) { stepOnto(state, c.x, c.y); });
    assert(state.crew.every(function (c) { return c.confronted; }), 'all five crew can be confronted');
    assert(state.manhunt === manhuntBefore + 5, 'each confrontation raises the manhunt level');
    assert(state.citadel.revealed, 'final confession reveals the citadel');

    var events = stepOnto(state, state.citadel.x, state.citadel.y);
    assert(state.over && state.ending === 'choice', 'reaching the citadel ends the hunt with a choice');
    assert(events.some(function (e) { return e.type === 'citadel'; }), 'citadel arrival emits its event');
    assert(GameEngine.chooseEnding(state, 'stars') === 'stars', 'the transcendent ending can be chosen');
    assert(state.ending === 'stars', 'chosen ending is recorded');
  }

  function testPyreDetonation() {
    var state = quietState();
    state.pyre.found = true;
    assert(GameEngine.detonatePyre(state) === null, 'PyrE will not detonate without TIGER mode');

    state.tigerTurns = 3;
    state.ap = 5;
    var near = GameState.makeHunter(state, false);
    near.x = state.foyle.x + 2; near.y = state.foyle.y;
    var far = GameState.makeHunter(state, false);
    far.x = state.foyle.x + T.PYRE_RADIUS + 3;
    far.y = Math.max(0, state.foyle.y - T.PYRE_RADIUS - 3);
    state.hunters = [near, far];
    var events = GameEngine.detonatePyre(state);
    assert(events.some(function (e) { return e.type === 'detonate'; }), 'PyrE detonates in TIGER mode');
    assert(state.hunters.length === 1 && state.hunters[0].id === far.id, 'blast kills hunters in radius, spares the far one');
    assert(state.pyre.used, 'PyrE is one use only');
    assert(GameEngine.detonatePyre(state) === null, 'spent PyrE cannot detonate again');
  }

  function testInformantRevealsCrew() {
    var state = quietState();
    var informant = state.informants[0];
    var crew = state.crew[informant.crewIndex];
    crew.revealed = false;
    stepOnto(state, informant.x, informant.y);
    assert(informant.used, 'informant is spent on visit');
    assert(crew.revealed, 'informant reveals a crew location');
  }

  function run() {
    var suites = [
      testMapGeneration, testJaunteRequiresMemory, testJauntePingAlertsHunters,
      testRageTriggersTiger, testTigerExpires, testRadiationBurns, testWreckHeals,
      testHunterAttackAndCapture, testConfrontationsRevealCitadel,
      testPyreDetonation, testInformantRevealsCrew
    ];
    suites.forEach(function (suite) {
      try {
        suite();
      } catch (err) {
        results.push({ ok: false, label: suite.name + ' threw: ' + err.message });
      }
    });
    return results;
  }

  return { run: run };
})();
