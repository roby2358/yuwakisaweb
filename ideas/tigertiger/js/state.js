'use strict';

// TIGER! TIGER! — game state construction and pure helpers.
// State is a plain struct; every mechanic has a named field here.

var GameState = (function () {
  var T = GameArtifacts.TUNING;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function idx(x, y) { return y * T.GRID_W + x; }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < T.GRID_W && y < T.GRID_H; }
  function chebyshev(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function tileAt(state, x, y) { return state.grid[idx(x, y)]; }

  function pickInt(rng, n) { return Math.floor(rng() * n); }

  function shuffled(rng, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = pickInt(rng, i + 1);
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  // --- Map generation ---------------------------------------------------

  function blankGrid() {
    var grid = [];
    for (var i = 0; i < T.GRID_W * T.GRID_H; i++) {
      grid.push({ t: 'OPEN', seen: false, visited: false });
    }
    return grid;
  }

  function scatterTerrain(rng, grid, kind, density) {
    for (var i = 0; i < grid.length; i++) {
      if (rng() < density) grid[i].t = kind;
    }
  }

  function placeStages(rng, grid) {
    // One stage per map quadrant so hunters arrive from all directions.
    var halfW = Math.floor(T.GRID_W / 2);
    var halfH = Math.floor(T.GRID_H / 2);
    var quads = [[0, 0], [halfW, 0], [0, halfH], [halfW, halfH]];
    var stages = [];
    for (var q = 0; q < T.STAGE_COUNT; q++) {
      var qx = quads[q % 4][0], qy = quads[q % 4][1];
      var x = qx + 1 + pickInt(rng, halfW - 2);
      var y = qy + 1 + pickInt(rng, halfH - 2);
      grid[idx(x, y)].t = 'STAGE';
      stages.push({ x: x, y: y });
    }
    return stages;
  }

  function openTilesReachableFrom(grid, sx, sy) {
    // BFS over Foyle-walkable terrain; returns Set of reachable indexes.
    var seen = {};
    var queue = [[sx, sy]];
    seen[idx(sx, sy)] = true;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length > 0) {
      var cur = queue.shift();
      for (var d = 0; d < 4; d++) {
        var nx = cur[0] + dirs[d][0], ny = cur[1] + dirs[d][1];
        if (!inBounds(nx, ny)) continue;
        var key = idx(nx, ny);
        if (seen[key]) continue;
        if (!GameArtifacts.TERRAIN[grid[key].t].foyleWalk) continue;
        seen[key] = true;
        queue.push([nx, ny]);
      }
    }
    return seen;
  }

  function farOpenSpots(rng, grid, reachable, fromX, fromY, minDist, count, taken) {
    var candidates = [];
    for (var y = 0; y < T.GRID_H; y++) {
      for (var x = 0; x < T.GRID_W; x++) {
        var key = idx(x, y);
        if (grid[key].t !== 'OPEN') continue;
        if (!reachable[key]) continue;
        if (taken[key]) continue;
        if (chebyshev(x, y, fromX, fromY) < minDist) continue;
        candidates.push({ x: x, y: y });
      }
    }
    var picked = shuffled(rng, candidates).slice(0, count);
    for (var i = 0; i < picked.length; i++) taken[idx(picked[i].x, picked[i].y)] = true;
    return picked;
  }

  function generateMap(rng) {
    // Retry until every point of interest is reachable from the wreck.
    for (var attempt = 0; attempt < 60; attempt++) {
      var grid = blankGrid();
      scatterTerrain(rng, grid, 'RUIN', T.RUIN_DENSITY);
      scatterTerrain(rng, grid, 'RAD', T.RAD_DENSITY);
      var stages = placeStages(rng, grid);
      var wreck = { x: 1, y: T.GRID_H - 2 };
      grid[idx(wreck.x, wreck.y)].t = 'WRECK';

      var reachable = openTilesReachableFrom(grid, wreck.x, wreck.y);
      var stagesOk = stages.every(function (s) { return reachable[idx(s.x, s.y)]; });
      if (!stagesOk) continue;

      var taken = {};
      var crewSpots = farOpenSpots(rng, grid, reachable, wreck.x, wreck.y, T.MIN_CREW_DIST, GameArtifacts.CREW.length, taken);
      var informantSpots = farOpenSpots(rng, grid, reachable, wreck.x, wreck.y, 3, GameArtifacts.CREW.length, taken);
      var pyreSpots = farOpenSpots(rng, grid, reachable, wreck.x, wreck.y, T.MIN_CREW_DIST, 1, taken);
      var citadelSpots = farOpenSpots(rng, grid, reachable, wreck.x, wreck.y, T.MIN_CREW_DIST + 2, 1, taken);
      var enough = crewSpots.length === GameArtifacts.CREW.length &&
        informantSpots.length === GameArtifacts.CREW.length &&
        pyreSpots.length === 1 && citadelSpots.length === 1;
      if (!enough) continue;

      return {
        grid: grid, stages: stages, wreck: wreck,
        crewSpots: crewSpots, informantSpots: informantSpots,
        pyre: pyreSpots[0], citadel: citadelSpots[0]
      };
    }
    throw new Error('Map generation failed after 60 attempts');
  }

  // --- Hunters ----------------------------------------------------------

  function makeHunter(state, elite) {
    var rng = state.rng;
    var stage = state.stages[pickInt(rng, state.stages.length)];
    var pool = elite ? GameArtifacts.ELITE_NAMES : GameArtifacts.COURIER_NAMES;
    var name = pool[pickInt(rng, pool.length)];
    state.hunterIdCounter += 1;
    return {
      id: state.hunterIdCounter,
      name: (elite ? '' : 'Courier ') + name + ' #' + state.hunterIdCounter,
      x: stage.x, y: stage.y,
      speed: elite ? 2 : 1,
      sight: elite ? T.ELITE_SIGHT : T.HUNTER_SIGHT,
      elite: elite,
      alert: null,          // {x, y} last known Foyle position, or null
      attackedThisTurn: false
    };
  }

  // --- Sight ------------------------------------------------------------

  function updateSight(state) {
    var revealed = [];
    for (var y = 0; y < T.GRID_H; y++) {
      for (var x = 0; x < T.GRID_W; x++) {
        if (chebyshev(x, y, state.foyle.x, state.foyle.y) > T.SIGHT) continue;
        state.grid[idx(x, y)].seen = true;
      }
    }
    state.crew.forEach(function (c) {
      if (c.revealed) return;
      if (!state.grid[idx(c.x, c.y)].seen) return;
      c.revealed = true;
      revealed.push(c);
    });
    return revealed;
  }

  // --- Construction -----------------------------------------------------

  function newGame(seed) {
    var rng = mulberry32(seed);
    var map = generateMap(rng);

    var crew = GameArtifacts.CREW.map(function (def, i) {
      return {
        name: def.name, city: def.city, confession: def.confession,
        x: map.crewSpots[i].x, y: map.crewSpots[i].y,
        revealed: false, confronted: false
      };
    });

    var informants = map.informantSpots.map(function (spot, i) {
      return { x: spot.x, y: spot.y, used: false, crewIndex: i };
    });

    var state = {
      seed: seed,
      rng: rng,
      turn: 1,
      over: false,
      ending: null,          // 'captured' | 'choice' | 'vengeance' | 'stars'
      ap: T.AP_NORMAL,
      hp: T.HP_MAX,
      rage: 0,
      ragedThisTurn: false,
      tigerTurns: 0,
      manhunt: 1,
      foyle: { x: map.wreck.x, y: map.wreck.y },
      grid: map.grid,
      stages: map.stages,
      wreck: map.wreck,
      crew: crew,
      informants: informants,
      pyre: { x: map.pyre.x, y: map.pyre.y, found: false, used: false },
      citadel: { x: map.citadel.x, y: map.citadel.y, revealed: false },
      hunters: [],
      hunterIdCounter: 0,
      spawnCooldown: T.SPAWN_BASE - 1,
      log: []
    };

    tileAt(state, state.foyle.x, state.foyle.y).visited = true;
    for (var i = 0; i < T.START_HUNTERS; i++) {
      state.hunters.push(makeHunter(state, false));
    }
    updateSight(state);
    return state;
  }

  return {
    newGame: newGame,
    makeHunter: makeHunter,
    updateSight: updateSight,
    openTilesReachableFrom: openTilesReachableFrom,
    idx: idx,
    inBounds: inBounds,
    chebyshev: chebyshev,
    tileAt: tileAt,
    pickInt: pickInt
  };
})();
