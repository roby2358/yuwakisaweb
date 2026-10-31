// Canvas drawing. Reads game state, never mutates it. Owns only display effects
// (floaters, blasts, slashes, banners) and the smoothed camera.
(function (ID) {
  const N = ID.N, CELL = N.CELL;
  const R = ID.Render = {};
  let canvas, ctx, W = 1, H = 1, dpr = 1;
  const cam = { x: 0, y: 0, snap: true };
  let effects = [];
  let banner = null;
  let alpha = 1;             // fraction of the way from the last tick to the next

  // Interpolated draw position between the previous tick and this one.
  const at = u => ({ x: u.px === undefined ? u.x : u.px + (u.x - u.px) * alpha,
                     y: u.py === undefined ? u.y : u.py + (u.y - u.py) * alpha });
  const isMoving = u => u.px !== undefined && Math.hypot(u.x - u.px, u.y - u.py) > 0.05;

  R.init = function (c) { canvas = c; ctx = c.getContext('2d'); R.resize(); };

  R.resize = function () {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = canvas.width = Math.max(1, Math.round(r.width * dpr));
    H = canvas.height = Math.max(1, Math.round(r.height * dpr));
  };

  const CLS_NAME = { warrior: 'Warrior', archer: 'Archer', mage: 'Mage', priest: 'Priest' };

  // Display effects spawned from engine events.
  const FROM_EVENT = {
    killed: e => effects.push({ kind: 'floater', x: e.x, y: e.y - 14, text: '+' + ID.fmt(e.xp), t: 0, life: 1.2 }),
    blast: e => effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, t: 0, life: 0.35 }),
    swing: e => effects.push({ kind: 'slash', x: e.x, y: e.y, t: 0, life: 0.15 }),
    revived: e => effects.push({ kind: 'pillar', x: e.x, y: e.y, t: 0, life: 0.8 }),
    heroDied: e => effects.push({ kind: 'floater', x: e.x, y: e.y - 20, text: CLS_NAME[e.cls] + ' down', t: 0, life: 1.6, color: '#e04040' }),
    levelEntered: e => {
      cam.snap = true;
      effects = [];
      if (e.reason !== 'load') banner = { text: 'DEPTH ' + e.depth, sub: e.reason === 'wipe' ? 'back to the entrance' : '', t: 0, life: 2.2, color: '#ddd' };
    },
    wiped: () => { banner = { text: 'THE PARTY HAS FALLEN', sub: '', t: 0, life: N.WIPE_DELAY, color: '#e04040' }; },
  };

  R.addEvents = function (events) { for (const e of events) if (FROM_EVENT[e.type]) FROM_EVENT[e.type](e); };

  // ---------- primitives ----------

  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  // The vertical health bar down the middle of every body: black backing, red draining to the bottom.
  function hpBar(top, bottom, frac) {
    const h = bottom - top, f = Math.max(0, Math.min(1, frac));
    rect(-1.6, top, 3.2, h, '#000');
    rect(-1.6, bottom - h * f, 3.2, h * f, '#e02424');
  }

  // ---------- heroes: stacks of rectangles, drawn facing right ----------

  const HEROES = {
    warrior() {
      rect(-8, 6, 6, 9, '#4a4f57'); rect(2, 6, 6, 9, '#4a4f57');           // legs
      rect(-11, -8, 22, 15, '#8a9099');                                     // torso
      rect(-11, -2, 22, 3, '#6b7178');                                      // belt
      rect(-6, -17, 12, 9, '#b4bac2');                                      // helm
      rect(-4, -14, 9, 2, '#1a1a1a');                                       // visor slit
      rect(9, -9, 6, 17, '#5b616a'); rect(10.5, -2, 3, 3, '#c9a94a');       // shield + boss
      return [-17, 14];
    },
    archer() {
      rect(-5, 7, 4, 8, '#4a3a2a'); rect(1, 7, 4, 8, '#4a3a2a');
      rect(-5, -7, 10, 15, '#3f8f4a');
      rect(-6, -16, 11, 10, '#2f6b38');                                     // hood
      rect(-1, -13, 5, 4, '#d9b38c');                                       // face
      rect(-8, -6, 3, 12, '#6b4a2a');                                       // quiver
      rect(8, -14, 2, 26, '#8b5a2b');                                       // bow stave
      rect(7, -14, 1, 26, 'rgba(230,230,200,0.5)');                         // string
      return [-16, 14];
    },
    mage() {
      rect(-7, -5, 14, 21, '#2f4fbf');                                      // robe
      rect(-8, 12, 16, 4, '#23379a');                                       // hem
      rect(-4, -11, 8, 6, '#d9b38c');                                       // face
      rect(-8, -14, 16, 3, '#23379a');                                      // hat brim
      rect(-5, -19, 10, 5, '#23379a');
      rect(-3, -24, 6, 5, '#23379a');
      rect(-1, -29, 3, 5, '#23379a');                                       // peak
      rect(10, -16, 2, 32, '#7a5a3a');                                      // staff
      rect(8.5, -21, 5, 5, '#6ff');                                         // crystal
      return [-24, 15];
    },
    priest() {
      rect(-6, -6, 12, 10, '#eeeeee');                                      // robe top
      rect(-9, 4, 18, 12, '#d8d8d8');                                       // hem
      rect(-1.5, -6, 3, 22, '#c9a94a');                                     // gold stole (hidden behind bar, peeks out)
      rect(-4, -13, 8, 7, '#d9b38c');                                       // face
      rect(-7, -19, 14, 2, '#ffd84a');                                      // halo
      return [-12, 15];
    },
  };

  function drawHero(h, t, i) {
    const p = at(h);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!h.alive) {
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.35;
      HEROES[h.cls]();
      ctx.restore();
      return;
    }
    // Fixed step cadence whatever the speed; each hero offset so they don't march in lockstep.
    const bob = isMoving(h) ? Math.abs(Math.sin(t * 9 + i * 1.7)) * -1.6 : 0;
    ctx.translate(0, bob);
    ctx.save();
    if (Math.cos(h.facing) < 0) ctx.scale(-1, 1);
    const [top, bottom] = HEROES[h.cls]();
    ctx.restore();
    hpBar(top + 2, bottom, h.hp / h.maxHp);
    if (h.flash > 0) rect(-12, top, 24, bottom - top, 'rgba(255,255,255,0.45)');
    ctx.restore();
  }

  // ---------- monsters: one silhouette template per shape, scaled by size ----------

  function eyes(r, y, look) {
    const s = Math.max(2, r * 0.22);
    rect(-r * 0.45 - s / 2, y, s, s, '#fff'); rect(r * 0.45 - s / 2, y, s, s, '#fff');
    rect(-r * 0.45 - s / 2 + look * s * 0.4, y + s * 0.3, s * 0.5, s * 0.5, '#000');
    rect(r * 0.45 - s / 2 + look * s * 0.4, y + s * 0.3, s * 0.5, s * 0.5, '#000');
  }

  // Each returns [top, bottom, eyeY].
  const SHAPES = {
    squat(r, sp) { rect(-r, -r * 0.5, r * 2, r * 1.1, sp.color); rect(-r, r * 0.45, r * 2, r * 0.2, sp.dark); return [-r * 0.5, r * 0.65, -r * 0.35]; },
    tall(r, sp) {
      rect(-r * 0.5, -r * 1.2, r, r * 2.2, sp.color);
      rect(-r * 0.75, -r * 1.45, r * 1.5, r * 0.35, sp.dark);
      return [-r * 1.45, r, -r * 0.95];
    },
    wide(r, sp) {
      rect(-r * 1.25, -r * 0.6, r * 2.5, r * 0.95, sp.color);
      for (const x of [-1, -0.15, 0.7]) rect(x * r, r * 0.35, r * 0.45, r * 0.4, sp.dark);
      return [-r * 0.6, r * 0.75, -r * 0.45];
    },
    blob(r, sp) {
      sp.blob.forEach(([dx, dy], i) => rect(dx * r - r * 0.45, dy * r - r * 0.45, r * 0.9, r * 0.9, i % 2 ? sp.dark : sp.color));
      return [-r * 1.05, r * 0.85, -r * 0.4];
    },
    spiky(r, sp) {
      const k = r * 0.3;
      rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, sp.color);
      rect(-k / 2, -r * 1.05, k, r * 0.35, sp.dark); rect(-k / 2, r * 0.7, k, r * 0.35, sp.dark);
      rect(-r * 1.05, -k / 2, r * 0.35, k, sp.dark); rect(r * 0.7, -k / 2, r * 0.35, k, sp.dark);
      rect(-r * 0.95, -r * 0.95, k, k, sp.dark); rect(r * 0.65, -r * 0.95, k, k, sp.dark);
      return [-r * 1.05, r * 1.05, -r * 0.4];
    },
    stack(r, sp) {
      rect(-r * 0.9, r * 0.1, r * 1.8, r * 0.8, sp.dark);
      rect(-r * 0.65 + r * 0.1, -r * 0.55, r * 1.3, r * 0.7, sp.color);
      rect(-r * 0.4 - r * 0.08, -r * 1.05, r * 0.8, r * 0.55, sp.color);
      return [-r * 1.05, r * 0.9, -r * 0.9];
    },
  };

  function drawMonster(g, m, t, labels) {
    const sp = g.roster[m.sp], r = m.size, p = at(m);
    ctx.save();
    const wobble = m.aggro ? Math.sin(t * 14 + m.id) * 1.2 : Math.sin(t * 3 + m.id) * 0.6;
    ctx.translate(p.x, p.y + wobble);
    const [top, bottom, eyeY] = SHAPES[sp.shape](r, sp);
    eyes(r, eyeY, Math.cos(m.facing || 0) < 0 ? -1 : 1);
    hpBar(top + 1, bottom, m.hp / m.maxHp);
    if (m.flash > 0) rect(-r, top, r * 2, bottom - top, 'rgba(255,255,255,0.5)');
    ctx.restore();
    labels.push({ x: p.x, y: p.y + top - 6, text: sp.name, aggro: m.aggro, color: sp.labelColor });
  }

  // ---------- projectiles and effects ----------

  const PROJ = {
    arrow(p) {
      const q = at(p);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      rect(-7, -1, 14, 2, '#e6d38a');
      rect(5, -2, 3, 4, '#ccc');
      ctx.restore();
    },
    bolt(p) {
      const q = at(p);
      ctx.fillStyle = 'rgba(110,210,255,0.25)';
      ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9fe6ff';
      ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill();
    },
    heal(p) {
      const q = at(p);
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill();
    },
  };

  const FX = {
    floater(e, k) {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color || '#ffd84a';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y - k * 24);
    },
    ring(e, k) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#9fe6ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * k), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(110,210,255,0.12)';
      ctx.fill();
    },
    slash(e, k) {
      ctx.globalAlpha = 1 - k;
      rect(e.x - 10, e.y - 10 + k * 8, 20, 3, '#fff');
    },
    pillar(e, k) {
      ctx.globalAlpha = (1 - k) * 0.6;
      rect(e.x - 6, e.y - 60 + k * 30, 12, 70, '#ffd84a');
    },
  };

  // ---------- the frame ----------

  function drawWalls(L, x0, y0, x1, y1, s) {
    const wall = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.cells[y * L.w + x] === 1;
    ctx.fillStyle = '#151515';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (!wall(x, y)) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (wall(x, y)) continue;
        const px = x * CELL, py = y * CELL;
        if (wall(x, y - 1)) { ctx.moveTo(px, py); ctx.lineTo(px + CELL, py); }
        if (wall(x, y + 1)) { ctx.moveTo(px, py + CELL); ctx.lineTo(px + CELL, py + CELL); }
        if (wall(x - 1, y)) { ctx.moveTo(px, py); ctx.lineTo(px, py + CELL); }
        if (wall(x + 1, y)) { ctx.moveTo(px + CELL, py); ctx.lineTo(px + CELL, py + CELL); }
      }
    }
    ctx.strokeStyle = '#8c8c8c';
    ctx.lineWidth = 1.5 * dpr / s;
    ctx.stroke();
  }

  R.draw = function (g, dt) {
    alpha = Math.min(1, g.acc / N.TICK);
    const L = g.level, t = g.time + g.acc, lead = at(ID.Engine.leader(g));
    const s = Math.min(W, H) / (N.VIEW_CELLS * CELL);
    if (cam.snap) { cam.x = lead.x; cam.y = lead.y; cam.snap = false; }
    const k = Math.min(1, dt * 5);
    cam.x += (lead.x - cam.x) * k;
    cam.y += (lead.y - cam.y) * k;
    // However fast the party runs, the camera never trails more than CAM_LAG cells.
    const lag = Math.hypot(lead.x - cam.x, lead.y - cam.y), maxLag = N.CAM_LAG * CELL;
    if (lag > maxLag) { cam.x = lead.x + (cam.x - lead.x) * maxLag / lag; cam.y = lead.y + (cam.y - lead.y) * maxLag / lag; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, W / 2 - cam.x * s, H / 2 - cam.y * s);

    const halfW = W / 2 / s, halfH = H / 2 / s;
    const x0 = Math.floor((cam.x - halfW) / CELL) - 1, x1 = Math.ceil((cam.x + halfW) / CELL) + 1;
    const y0 = Math.floor((cam.y - halfH) / CELL) - 1, y1 = Math.ceil((cam.y + halfH) / CELL) + 1;
    drawWalls(L, x0, y0, x1, y1, s);

    const onScreen = o => Math.abs(o.x - cam.x) < halfW + 60 && Math.abs(o.y - cam.y) < halfH + 60;
    g.heroes.forEach((h, i) => { if (!h.alive) drawHero(h, t, i); });
    const labels = [];
    for (const m of L.monsters) if (onScreen(m)) drawMonster(g, m, t, labels);
    g.heroes.forEach((h, i) => { if (h.alive) drawHero(h, t, i); });
    for (const p of L.projectiles) if (onScreen(p)) PROJ[p.kind](p);

    effects = effects.filter(e => (e.t += dt) < e.life);
    for (const e of effects) { ctx.save(); FX[e.kind](e, e.t / e.life); ctx.restore(); }

    // Names in screen space so they stay crisp at any zoom.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${Math.round(10 * dpr)}px monospace`;
    ctx.textAlign = 'center';
    for (const l of labels) {
      ctx.fillStyle = l.color || (l.aggro ? '#c8a0a0' : '#8a8a8a');
      ctx.fillText(l.text, W / 2 + (l.x - cam.x) * s, H / 2 + (l.y - cam.y) * s);
    }

    if (banner) {
      banner.t += dt;
      const a = Math.min(1, banner.t * 4, (banner.life - banner.t) * 2);
      if (a <= 0) banner = null;
      else {
        ctx.globalAlpha = a;
        ctx.fillStyle = banner.color;
        ctx.font = `bold ${Math.round(28 * dpr)}px monospace`;
        ctx.fillText(banner.text, W / 2, H * 0.3);
        if (banner.sub) {
          ctx.font = `${Math.round(12 * dpr)}px monospace`;
          ctx.fillStyle = '#888';
          ctx.fillText(banner.sub, W / 2, H * 0.3 + 22 * dpr);
        }
        ctx.globalAlpha = 1;
      }
    }
  };
})(this.ID = this.ID || {});
