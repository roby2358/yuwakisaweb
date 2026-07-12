'use strict';

// TIGER! TIGER! — rendering, animation, input. All DOM lives here.

var GameUI = (function () {
  var T = GameArtifacts.TUNING;
  var TERRAIN = GameArtifacts.TERRAIN;
  var TILE = 36;

  var state = null;
  var canvas, ctx;
  var busy = false;              // input locked while events animate
  var uiHunterPos = {};          // id -> {x, y} shown positions during animation
  var deadHunters = {};          // ids removed mid-animation (PyrE)
  var effects = [];              // transient visuals {type, x, y, start, dur}
  var hoverTile = null;

  // --- Effects -------------------------------------------------------------

  function addEffect(type, x, y, dur) {
    effects.push({ type: type, x: x, y: y, start: performance.now(), dur: dur });
  }

  function pruneEffects(now) {
    effects = effects.filter(function (e) { return now - e.start < e.dur; });
  }

  // --- Event animation -------------------------------------------------------

  var EVENT_PLAYBACK = {
    step:          { dur: 40,  fx: function (e) {} },
    jaunte:        { dur: 220, fx: function (e) { addEffect('ring', e.fx, e.fy, 400); addEffect('ring', e.x, e.y, 400); } },
    ping:          { dur: 150, fx: function (e) { addEffect('ping', e.x, e.y, 500); } },
    reveal:        { dur: 120, fx: function (e) {} },
    informant:     { dur: 120, fx: function (e) { addEffect('flash', e.x, e.y, 300); } },
    pickupPyre:    { dur: 200, fx: function (e) {} },
    confront:      { dur: 350, fx: function (e) {} },
    revealCitadel: { dur: 250, fx: function (e) {} },
    citadel:       { dur: 200, fx: function (e) {} },
    hstep:         { dur: 85,  fx: function (e) { uiHunterPos[e.id] = { x: e.x, y: e.y }; } },
    attack:        { dur: 300, fx: function (e) { addEffect('slash', e.x, e.y, 350); } },
    burn:          { dur: 250, fx: function (e) { addEffect('burn', e.x, e.y, 400); } },
    heal:          { dur: 100, fx: function (e) {} },
    tigerOn:       { dur: 500, fx: function (e) { addEffect('tiger', 0, 0, 900); } },
    tigerOff:      { dur: 200, fx: function (e) {} },
    spawn:         { dur: 200, fx: function (e) { uiHunterPos[e.id] = { x: e.x, y: e.y }; addEffect('ring', e.x, e.y, 400); } },
    detonate:      { dur: 700, fx: function (e) { addEffect('blast', e.x, e.y, 700); markPyreDead(e); } },
    death:         { dur: 500, fx: function (e) {} },
    turn:          { dur: 0,   fx: function (e) {} }
  };

  function markPyreDead(e) {
    Object.keys(uiHunterPos).forEach(function (id) {
      var p = uiHunterPos[id];
      if (GameState.chebyshev(p.x, p.y, e.x, e.y) <= T.PYRE_RADIUS) deadHunters[id] = true;
    });
  }

  function syncHunterPositions() {
    uiHunterPos = {};
    deadHunters = {};
    state.hunters.forEach(function (h) { uiHunterPos[h.id] = { x: h.x, y: h.y }; });
  }

  function playEvents(events) {
    if (!events || events.length === 0) { renderPanel(); return; }
    busy = true;
    var i = 0;
    function next() {
      if (i >= events.length) {
        busy = false;
        syncHunterPositions();
        renderPanel();
        checkModals();
        return;
      }
      var e = events[i];
      i += 1;
      var play = EVENT_PLAYBACK[e.type];
      play.fx(e);
      renderPanel();
      setTimeout(next, play.dur);
    }
    next();
  }

  // --- Canvas rendering -------------------------------------------------------

  function px(v) { return v * TILE; }

  function drawTile(x, y, tile) {
    var def = TERRAIN[tile.t];
    if (!tile.seen) {
      ctx.fillStyle = '#04050a';
      ctx.fillRect(px(x), px(y), TILE, TILE);
      return;
    }
    ctx.fillStyle = def.fill;
    ctx.fillRect(px(x), px(y), TILE, TILE);
    ctx.strokeStyle = def.edge;
    ctx.strokeRect(px(x) + 0.5, px(y) + 0.5, TILE - 1, TILE - 1);

    if (tile.t === 'RUIN') drawRuin(x, y);
    if (tile.t === 'RAD') drawGlyph(x, y, '☢', '#4fd66a', 15);
    if (tile.t === 'STAGE') drawGlyph(x, y, '◎', '#5cc8ff', 17);
    if (tile.t === 'WRECK') drawGlyph(x, y, '⌂', '#c79aff', 18);

    if (tile.visited && tile.t !== 'WRECK') {
      ctx.fillStyle = 'rgba(120, 200, 255, 0.5)';
      ctx.fillRect(px(x) + TILE - 7, px(y) + TILE - 7, 3, 3);
    }
  }

  function drawRuin(x, y) {
    ctx.fillStyle = '#4a3b30';
    ctx.beginPath();
    ctx.moveTo(px(x) + 6, px(y) + TILE - 6);
    ctx.lineTo(px(x) + 10, px(y) + 8);
    ctx.lineTo(px(x) + 16, px(y) + 18);
    ctx.lineTo(px(x) + 22, px(y) + 6);
    ctx.lineTo(px(x) + TILE - 6, px(y) + TILE - 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawGlyph(x, y, glyph, color, size) {
    ctx.fillStyle = color;
    ctx.font = size + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, px(x) + TILE / 2, px(y) + TILE / 2 + 1);
  }

  function drawEntities() {
    state.informants.forEach(function (n) {
      if (n.used || !GameState.tileAt(state, n.x, n.y).seen) return;
      drawGlyph(n.x, n.y, '?', '#d08aff', 18);
    });
    state.crew.forEach(function (c) {
      if (!c.revealed || c.confronted) return;
      drawGlyph(c.x, c.y, '◆', '#ffd257', 18);
    });
    var p = state.pyre;
    if (!p.found && GameState.tileAt(state, p.x, p.y).seen) {
      drawGlyph(p.x, p.y, '✶', '#ff9d3c', 18);
    }
    if (state.citadel.revealed) {
      drawGlyph(state.citadel.x, state.citadel.y, '★', '#ffffff', 20);
    }
  }

  function hunterVisibleToPlayer(h, pos) {
    if (h.alert) return true; // the hue and cry is loud
    return GameState.chebyshev(pos.x, pos.y, state.foyle.x, state.foyle.y) <= T.SIGHT;
  }

  function drawHunters() {
    state.hunters.forEach(function (h) {
      var pos = uiHunterPos[h.id];
      if (!pos || deadHunters[h.id]) return;
      if (!GameState.tileAt(state, pos.x, pos.y).seen) return;
      if (!hunterVisibleToPlayer(h, pos)) return;
      var cx = px(pos.x) + TILE / 2, cy = px(pos.y) + TILE / 2;
      ctx.fillStyle = h.elite ? '#ff5c5c' : '#c23b3b';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 9, cy + 8);
      ctx.lineTo(cx - 9, cy + 8);
      ctx.closePath();
      ctx.fill();
      if (h.elite) {
        ctx.strokeStyle = '#ffd0d0';
        ctx.stroke();
      }
      if (h.alert) drawGlyph(pos.x, pos.y - 0.45, '!', '#ff7a7a', 13);
    });
  }

  function drawFoyle(now) {
    var f = state.foyle;
    var cx = px(f.x) + TILE / 2, cy = px(f.y) + TILE / 2;
    var tiger = state.tigerTurns > 0;
    ctx.fillStyle = tiger ? '#ff8c1a' : '#e8a05c';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    var stripeAlpha = tiger ? 1 : Math.min(1, state.rage / T.RAGE_MAX);
    if (stripeAlpha > 0.15) {
      ctx.strokeStyle = 'rgba(30, 10, 5, ' + stripeAlpha + ')';
      ctx.lineWidth = 2;
      [-5, 0, 5].forEach(function (off) {
        ctx.beginPath();
        ctx.moveTo(cx + off - 3, cy - 9);
        ctx.lineTo(cx + off + 3, cy + 9);
        ctx.stroke();
      });
      ctx.lineWidth = 1;
    }
    if (tiger) {
      var pulse = 4 + 3 * Math.sin(now / 120);
      ctx.strokeStyle = 'rgba(255, 60, 20, 0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 13 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFog() {
    for (var y = 0; y < T.GRID_H; y++) {
      for (var x = 0; x < T.GRID_W; x++) {
        var tile = GameState.tileAt(state, x, y);
        if (!tile.seen) continue;
        if (GameState.chebyshev(x, y, state.foyle.x, state.foyle.y) <= T.SIGHT) continue;
        ctx.fillStyle = 'rgba(2, 3, 8, 0.55)';
        ctx.fillRect(px(x), px(y), TILE, TILE);
      }
    }
  }

  function drawHover() {
    if (!hoverTile || busy || state.over) return;
    var tile = GameState.tileAt(state, hoverTile.x, hoverTile.y);
    if (!tile.seen) return;
    var adjacent = GameState.chebyshev(hoverTile.x, hoverTile.y, state.foyle.x, state.foyle.y) === 1;
    var stepOk = adjacent && TERRAIN[tile.t].foyleWalk;
    var jaunteOk = !adjacent && GameEngine.canJaunte(state, hoverTile.x, hoverTile.y);
    if (!stepOk && !jaunteOk) return;
    ctx.strokeStyle = jaunteOk ? '#5cc8ff' : '#e8e8e8';
    ctx.lineWidth = 2;
    ctx.strokeRect(px(hoverTile.x) + 2, px(hoverTile.y) + 2, TILE - 4, TILE - 4);
    ctx.lineWidth = 1;
  }

  var EFFECT_DRAW = {
    ring: function (e, t) {
      ctx.strokeStyle = 'rgba(92, 200, 255, ' + (1 - t) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(e.x) + TILE / 2, px(e.y) + TILE / 2, 6 + t * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    },
    ping: function (e, t) {
      ctx.strokeStyle = 'rgba(255, 120, 80, ' + (1 - t) + ')';
      ctx.beginPath();
      ctx.arc(px(e.x) + TILE / 2, px(e.y) + TILE / 2, 8 + t * T.PING_RADIUS * TILE * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    },
    flash: function (e, t) {
      ctx.fillStyle = 'rgba(208, 138, 255, ' + (0.6 * (1 - t)) + ')';
      ctx.fillRect(px(e.x), px(e.y), TILE, TILE);
    },
    slash: function (e, t) {
      ctx.fillStyle = 'rgba(255, 40, 40, ' + (0.7 * (1 - t)) + ')';
      ctx.fillRect(px(e.x), px(e.y), TILE, TILE);
    },
    burn: function (e, t) {
      ctx.fillStyle = 'rgba(80, 255, 120, ' + (0.5 * (1 - t)) + ')';
      ctx.fillRect(px(e.x), px(e.y), TILE, TILE);
    },
    tiger: function (e, t) {
      ctx.fillStyle = 'rgba(255, 60, 10, ' + (0.35 * (1 - t)) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    blast: function (e, t) {
      ctx.fillStyle = 'rgba(255, 200, 60, ' + (0.8 * (1 - t)) + ')';
      ctx.beginPath();
      ctx.arc(px(e.x) + TILE / 2, px(e.y) + TILE / 2, t * (T.PYRE_RADIUS + 0.5) * TILE, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  function drawEffects(now) {
    effects.forEach(function (e) {
      var t = Math.min(1, (now - e.start) / e.dur);
      EFFECT_DRAW[e.type](e, t);
    });
  }

  function render(now) {
    pruneEffects(now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var y = 0; y < T.GRID_H; y++) {
      for (var x = 0; x < T.GRID_W; x++) {
        drawTile(x, y, GameState.tileAt(state, x, y));
      }
    }
    drawEntities();
    drawHunters();
    drawFoyle(now);
    drawFog();
    drawHover();
    drawEffects(now);
    requestAnimationFrame(render);
  }

  // --- Side panel -------------------------------------------------------------

  function el(id) { return document.getElementById(id); }

  function pips(count, max, glyph, emptyGlyph) {
    var out = '';
    for (var i = 0; i < max; i++) out += i < count ? glyph : emptyGlyph;
    return out;
  }

  function portraitFor() {
    if (state.tigerTurns > 0) return GameArtifacts.PORTRAITS.tiger;
    if (state.rage >= T.RAGE_MAX / 2) return GameArtifacts.PORTRAITS.simmer;
    return GameArtifacts.PORTRAITS.calm;
  }

  function renderDossier() {
    var rows = state.crew.map(function (c) {
      var status = c.confronted ? 'CONFRONTED' : (c.revealed ? 'LOCATED' : 'UNKNOWN');
      var cls = c.confronted ? 'done' : (c.revealed ? 'located' : 'unknown');
      var name = c.revealed || c.confronted ? c.name : '?????';
      return '<li class="' + cls + '"><span>' + name + '</span><em>' + status + '</em></li>';
    });
    el('dossier').innerHTML = rows.join('');
  }

  function renderLog() {
    var recent = state.log.slice(-40);
    el('log').innerHTML = recent.map(function (line) {
      return '<p class="' + (line.cls || '') + '"><b>T' + line.turn + '</b> ' + line.text + '</p>';
    }).join('');
    el('log').scrollTop = el('log').scrollHeight;
  }

  function renderPanel() {
    el('turn').textContent = state.turn;
    el('manhunt').textContent = state.manhunt;
    el('seed').textContent = state.seed;
    el('hp').textContent = pips(state.hp, T.HP_MAX, '♥', '♡');
    el('ap').textContent = pips(state.ap, state.tigerTurns > 0 ? T.AP_TIGER : T.AP_NORMAL, '■', '□');
    el('ragefill').style.width = (state.rage / T.RAGE_MAX * 100) + '%';
    el('portrait').textContent = portraitFor();
    el('portrait').className = state.tigerTurns > 0 ? 'tiger' : (state.rage >= T.RAGE_MAX / 2 ? 'simmer' : '');
    el('tigerbanner').style.display = state.tigerTurns > 0 ? 'block' : 'none';
    el('tigerbanner').textContent = 'TIGER! TIGER! — ' + state.tigerTurns + ' turns';
    el('pyrestatus').textContent = state.pyre.used ? 'SPENT' : (state.pyre.found ? 'IN HAND' : 'RUMORED');
    el('detonate').disabled = !GameEngine.canDetonate(state) || busy;
    renderDossier();
    renderLog();
  }

  // --- Modals -------------------------------------------------------------------

  function showModal(id) {
    document.querySelectorAll('.modal-back').forEach(function (m) { m.style.display = 'none'; });
    if (id) el(id).style.display = 'flex';
  }

  var ENDING_MODALS = {
    captured: function () { showModal('modal-captured'); },
    choice: function () { showModal('modal-choice'); },
    vengeance: function () {
      el('ending-title').textContent = 'VENGEANCE';
      el('ending-text').innerHTML =
        'You kill her filthy, as promised. The rage burns out and leaves only ash — ' +
        'a tiger with nothing left to hunt.<br><br>The stars were never your destination.';
      showModal('modal-ending');
    },
    stars: function () {
      el('ending-title').textContent = 'THE STARS MY DESTINATION';
      el('ending-text').innerHTML =
        'You spare her — and understand, at last, what the rage was for. ' +
        'Faith in life, faith in yourself. You jaunte naked into the void:<br><br><em>' +
        GameArtifacts.QUATRAIN.join('<br>') + '</em>';
      showModal('modal-ending');
    }
  };

  function checkModals() {
    if (!state.over || !state.ending) return;
    ENDING_MODALS[state.ending]();
  }

  // --- Input --------------------------------------------------------------------

  function act(events) {
    if (events) playEvents(events);
  }

  var KEY_ACTIONS = {
    ArrowUp: function () { return GameEngine.tryStep(state, 0, -1); },
    ArrowDown: function () { return GameEngine.tryStep(state, 0, 1); },
    ArrowLeft: function () { return GameEngine.tryStep(state, -1, 0); },
    ArrowRight: function () { return GameEngine.tryStep(state, 1, 0); },
    w: function () { return GameEngine.tryStep(state, 0, -1); },
    s: function () { return GameEngine.tryStep(state, 0, 1); },
    a: function () { return GameEngine.tryStep(state, -1, 0); },
    d: function () { return GameEngine.tryStep(state, 1, 0); },
    ' ': function () { return GameEngine.wait(state); }
  };

  function onKey(e) {
    if (busy || state.over) return;
    var action = KEY_ACTIONS[e.key];
    if (!action) return;
    e.preventDefault();
    act(action());
  }

  function tileFromMouse(e) {
    var rect = canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - rect.left) / rect.width * T.GRID_W);
    var y = Math.floor((e.clientY - rect.top) / rect.height * T.GRID_H);
    if (!GameState.inBounds(x, y)) return null;
    return { x: x, y: y };
  }

  function onClick(e) {
    if (busy || state.over) return;
    var tile = tileFromMouse(e);
    if (!tile) return;
    var dx = tile.x - state.foyle.x, dy = tile.y - state.foyle.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      act(GameEngine.tryStep(state, dx, dy));
      return;
    }
    var events = GameEngine.tryJaunte(state, tile.x, tile.y);
    if (events) {
      act(events);
      return;
    }
    if (GameState.tileAt(state, tile.x, tile.y).seen) {
      GameEngine.logLine(state, '"Can\'t jaunte blind, you. Got to know the place first, is all."', 'dim');
      renderLog();
    }
  }

  function onMove(e) {
    hoverTile = tileFromMouse(e);
  }

  function newGame() {
    state = GameState.newGame(Math.floor(Math.random() * 2147483647));
    GameEngine.logLine(state, 'One hundred and seventy days you rotted in the wreck of the Nomad. Then Vorga passed you by.', 'gold');
    GameEngine.logLine(state, 'Five of her crew are hiding on this map. Find them. Make them talk.', 'info');
    GameEngine.logLine(state, 'Walk to memorize ground (·). Click any memorized tile to jaunte — but jauntes are loud.', 'dim');
    syncHunterPositions();
    showModal(null);
    renderPanel();
  }

  function init() {
    canvas = el('map');
    canvas.width = T.GRID_W * TILE;
    canvas.height = T.GRID_H * TILE;
    ctx = canvas.getContext('2d');

    document.addEventListener('keydown', onKey);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    el('wait').addEventListener('click', function () { if (!busy && !state.over) act(GameEngine.wait(state)); });
    el('detonate').addEventListener('click', function () { act(GameEngine.detonatePyre(state)); });
    el('begin').addEventListener('click', function () { showModal(null); });
    document.querySelectorAll('.newgame').forEach(function (btn) {
      btn.addEventListener('click', newGame);
    });
    el('choose-vengeance').addEventListener('click', function () {
      GameEngine.chooseEnding(state, 'vengeance');
      checkModals();
    });
    el('choose-stars').addEventListener('click', function () {
      GameEngine.chooseEnding(state, 'stars');
      checkModals();
    });

    newGame();
    showModal('modal-intro');
    requestAnimationFrame(render);
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', GameUI.init);
