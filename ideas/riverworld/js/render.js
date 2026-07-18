// Canvas renderer. Runs a continuous rAF loop over Game.state(); ui.js feeds it
// selection, highlights, unit animations, and effect flashes.

var Render = (function () {
  const SIZE = 24;               // hex radius, pointy-top
  const MARGIN_X = 18;
  const MARGIN_Y = 26;
  const HOP_MS = 110;            // enemy movement, hex to hex

  const TERRAIN_FILL = {
    grass: '#2e4a2e', bamboo: '#3a5a2a', trees: '#26402a', stone: '#4a4438',
    ice: '#9fb4c8', tower: '#1a2030', water: '#1d3a5f', mountain: '#242430',
  };
  const TERRAIN_GLYPH = { bamboo: '🎋', trees: '🌲', tower: '🗼' };

  let canvas = null;
  let ctx = null;
  let camY = 0;
  let camTarget = 0;
  let selected = null;           // {kind:'unit'|'raft', id}
  let moveSet = new Map();       // Hex key -> reachable info
  let attackIds = new Set();     // unit ids attackable by selection
  let effects = [];              // {c, r, color, text, until}
  let anims = new Map();         // unit id -> {path, start}

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    snapToParty();
    camY = camTarget;
    requestAnimationFrame(frame);
  }

  function hexCenter(c, r) {
    const p = Hex.toPixel(c, r, SIZE);
    return { x: p.x + MARGIN_X + SIZE, y: p.y + MARGIN_Y - camY };
  }

  function setSelection(sel, reach, targets) {
    selected = sel;
    moveSet = reach;
    attackIds = targets;
  }

  function flash(c, r, color, text, ms) {
    effects.push({ c, r, color, text, until: performance.now() + ms });
  }

  function animateMove(unitId, path, from) {
    anims.set(unitId, { path: path.slice(), from, start: performance.now() });
    return path.length * HOP_MS;
  }

  function snapToParty() {
    const S = Game.state();
    const foot = Game.footParty();
    const anchor = foot.length > 0 ? foot[0] : (S.raft || { c: 7, r: S.tiles.length - 3 });
    centerOn(anchor.c, anchor.r);
  }

  function centerOn(c, r) {
    const p = Hex.toPixel(c, r, SIZE);
    const maxCam = Hex.toPixel(0, Game.state().tiles.length - 1, SIZE).y + MARGIN_Y * 2 - canvas.height;
    camTarget = Math.max(0, Math.min(maxCam, p.y + MARGIN_Y - canvas.height / 2));
  }

  function scroll(dy) {
    camTarget += dy;
    const maxCam = Hex.toPixel(0, Game.state().tiles.length - 1, SIZE).y + MARGIN_Y * 2 - canvas.height;
    camTarget = Math.max(0, Math.min(maxCam, camTarget));
  }

  function pixelToHex(px, py) {
    // Nearest-center search over the visible row band — robust and cheap.
    const S = Game.state();
    let best = null;
    let bestD = SIZE * SIZE;
    const rMin = Math.max(0, Math.floor((camY + py - MARGIN_Y) / (SIZE * 1.5)) - 1);
    for (let r = rMin; r <= Math.min(S.tiles.length - 1, rMin + 3); r++) {
      for (let c = 0; c < S.tiles[0].length; c++) {
        const p = hexCenter(c, r);
        const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d < bestD) { bestD = d; best = { c, r }; }
      }
    }
    return best;
  }

  function hexPath(x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      const px = x + size * Math.cos(a);
      const py = y + size * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function frame(now) {
    camY += (camTarget - camY) * 0.15;
    effects = effects.filter(e => e.until > now);
    draw(now);
    requestAnimationFrame(frame);
  }

  function visibleRows() {
    const rMin = Math.max(0, Math.floor((camY - MARGIN_Y) / (SIZE * 1.5)) - 1);
    const rMax = Math.min(Game.state().tiles.length - 1, rMin + Math.ceil(canvas.height / (SIZE * 1.5)) + 2);
    return { rMin, rMax };
  }

  function draw(now) {
    const S = Game.state();
    if (!S) return;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { rMin, rMax } = visibleRows();
    for (let r = rMin; r <= rMax; r++) {
      for (let c = 0; c < S.tiles[r].length; c++) drawTile(S, c, r);
    }
    drawHighlights(S);
    drawRaft(S, now);
    for (const u of S.units) drawUnit(S, u, now);
    drawEffects(now);
  }

  function drawTile(S, c, r) {
    const tile = S.tiles[r][c];
    const p = hexCenter(c, r);
    const vis = S.visible.has(Hex.key(c, r));
    if (!tile.seen) {
      hexPath(p.x, p.y, SIZE - 0.5);
      ctx.fillStyle = '#0a0d14';
      ctx.fill();
      if (tile.stoneKnown) drawStoneIcon(p, 0.35);
      return;
    }
    hexPath(p.x, p.y, SIZE - 0.5);
    ctx.fillStyle = TERRAIN_FILL[tile.terrain];
    ctx.fill();
    ctx.strokeStyle = '#00000040';
    ctx.stroke();
    const glyph = TERRAIN_GLYPH[tile.terrain];
    if (glyph) {
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, p.x, p.y + 1);
    }
    if (tile.terrain === 'stone') drawStone(S, tile, p);
    if (!vis) {
      hexPath(p.x, p.y, SIZE - 0.5);
      ctx.fillStyle = 'rgba(5,7,12,0.55)';
      ctx.fill();
    }
  }

  function drawStoneIcon(p, alpha) {
    ctx.globalAlpha = alpha;
    drawMushroom(p, '#9a938a');
    ctx.globalAlpha = 1;
  }

  function drawStone(S, tile, p) {
    drawMushroom(p, tile.stone.slaver ? '#b08a8a' : '#b8b0a2');
    ctx.font = '11px serif';
    ctx.textAlign = 'center';
    if (tile.stone.wanderer && !tile.stone.slaver) ctx.fillText('🧍', p.x + 11, p.y - 8);
    if (tile.stone.captive) ctx.fillText('⛓️', p.x + 11, p.y - 8);
  }

  function drawMushroom(p, color) {
    ctx.fillStyle = color;
    ctx.fillRect(p.x - 3, p.y - 1, 6, 10);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 2, 11, 7, 0, Math.PI, 0);
    ctx.fill();
  }

  function drawHighlights(S) {
    for (const [, info] of moveSet) {
      const p = hexCenter(info.c, info.r);
      hexPath(p.x, p.y, SIZE - 3);
      ctx.fillStyle = 'rgba(232, 216, 160, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(232, 216, 160, 0.5)';
      ctx.stroke();
    }
    for (const id of attackIds) {
      const t = Game.byId(id);
      if (!t) continue;
      const p = hexCenter(t.c, t.r);
      hexPath(p.x, p.y, SIZE - 3);
      ctx.strokeStyle = '#ff6b5b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  function unitPixel(u, now) {
    const anim = anims.get(u.id);
    if (!anim) return hexCenter(u.c, u.r);
    const t = (now - anim.start) / HOP_MS;
    if (t >= anim.path.length) { anims.delete(u.id); return hexCenter(u.c, u.r); }
    const idx = Math.min(anim.path.length - 1, Math.floor(t));
    const frac = t - idx;
    const from = idx === 0 ? anim.from : anim.path[idx - 1];
    const a = hexCenter(from.c, from.r);
    const b = hexCenter(anim.path[idx].c, anim.path[idx].r);
    return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
  }

  function drawUnit(S, u, now) {
    if (u.aboard) return;
    if (u.side === 'slaver' && !S.visible.has(Hex.key(u.c, u.r)) && !anims.has(u.id)) return;
    const p = unitPixel(u, now);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = u.side === 'party' ? '#3d5a80' : '#7a2e2e';
    ctx.fill();
    if (selected && selected.kind === 'unit' && selected.id === u.id) {
      ctx.strokeStyle = '#e8d8a0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.font = '15px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.glyph, p.x, p.y + 1);
    const w = 22;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(p.x - w / 2, p.y + 14, w, 3);
    ctx.fillStyle = u.hp / u.maxHp > 0.35 ? '#6dc26d' : '#ff6b5b';
    ctx.fillRect(p.x - w / 2, p.y + 14, w * Math.max(0, u.hp / u.maxHp), 3);
  }

  function drawRaft(S, now) {
    if (!S.raft) return;
    const p = hexCenter(S.raft.c, S.raft.r);
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛶', p.x, p.y);
    if (S.raft.aboard.length > 0) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#e8d8a0';
      ctx.fillText('×' + S.raft.aboard.length, p.x + 13, p.y - 9);
    }
    if (selected && selected.kind === 'raft') {
      hexPath(p.x, p.y, SIZE - 3);
      ctx.strokeStyle = '#e8d8a0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  function drawEffects(now) {
    for (const e of effects) {
      const p = hexCenter(e.c, e.r);
      const life = (e.until - now) / 400;
      hexPath(p.x, p.y, SIZE - 2);
      ctx.fillStyle = e.color;
      ctx.globalAlpha = Math.max(0, Math.min(0.6, life));
      ctx.fill();
      ctx.globalAlpha = 1;
      if (e.text) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(e.text, p.x, p.y - 18);
      }
    }
  }

  function gongPulse() {
    const S = Game.state();
    for (const st of S.stones) {
      if (!S.tiles[st.r][st.c].stoneKnown && !S.tiles[st.r][st.c].seen) continue;
      flash(st.c, st.r, '#e8d8a0', null, 700);
    }
  }

  return { init, setSelection, flash, animateMove, centerOn, snapToParty, scroll, pixelToHex, gongPulse };
})();
