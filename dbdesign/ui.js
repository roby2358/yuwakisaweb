// HUG OF DEATH — ui: canvas pipeline scene, particles, charts, DOM panels.
// Reads Engine reports; game control flow lives in index.js.

const UI = (() => {
  const S = Content.SIM;
  const $ = id => document.getElementById(id);

  const COLORS = {
    good: '#43d17a', warn: '#e3b341', bad: '#f85149',
    dim: '#8b96a5', line: '#2d3646', text: '#d7dee8', accent: '#58a6ff',
    panel: '#1c2330',
  };

  let scene, ctx, W = 0, H = 0, dpr = 1;
  const particles = [];
  const spawnAcc = { read: 0, write: 0, lookup: 0, analytics: 0 };
  let perDot = 1;

  // ------------------------------------------------------------------ layout
  function layout(state) {
    const infra = state.infra;
    return {
      clients: { x: 70, y: H * 0.5 },
      pooler: { x: 215, y: H * 0.5, w: 84, h: 44, on: infra.pooler },
      cache: { x: 385, y: H * 0.22, w: 150, h: 74, on: infra.cacheNodes > 0 },
      kv: { x: 385, y: H * 0.8, w: 150, h: 64, on: infra.kvNodes > 0 },
      warehouse: { x: 640, y: H * 0.85, w: 150, h: 50, on: infra.warehouse },
      sql: { x: 640, y: H * 0.42, w: 220, h: 170 },
      exit: { x: W - 46, y: H * 0.5 },
    };
  }

  // Routes only pass through components that exist. Returns waypoints plus the
  // index of the component where a failing request dies (-1 = never fails).
  function buildRoute(fate, L, state) {
    const infra = state.infra;
    const pts = [[L.clients.x, L.clients.y]];
    let failIdx = -1;
    const push = (p, failsHere) => {
      pts.push([p.x, p.y]);
      if (failsHere) failIdx = pts.length - 1;
    };
    if (fate === 'readHit') {
      push(L.cache, false);
    } else if (fate === 'lookupKv') {
      push(L.kv, true);
    } else if (fate === 'analyticsOlap') {
      push(L.warehouse, false);
    } else { // anything bound for SQL
      if (fate === 'readMiss' && infra.cacheNodes > 0) push(L.cache, false);
      if (infra.pooler) push(L.pooler, false);
      push(L.sql, true);
    }
    push(L.exit, false);
    return { pts, failIdx };
  }

  // --------------------------------------------------------------- particles
  function pickFate(type, r, state) {
    const p = r.perType[type];
    const failing = Math.random() * Math.max(1e-9, p.demand) < p.fail;
    if (type === 'read') {
      const hitFrac = p.demand > 0 ? r.cache.hits / p.demand : 0;
      if (!failing && Math.random() < hitFrac) return { fate: 'readHit', fail: false };
      return { fate: 'readMiss', fail: failing };
    }
    if (type === 'lookup') {
      if (state.infra.kvNodes > 0) return { fate: 'lookupKv', fail: failing };
      return { fate: 'lookupSql', fail: failing };
    }
    if (type === 'analytics') {
      if (state.infra.warehouse) return { fate: 'analyticsOlap', fail: false };
      return { fate: 'analyticsSql', fail: failing };
    }
    return { fate: 'write', fail: failing };
  }

  function spawnParticles(state, dtFrame) {
    const r = state.report;
    if (!r) return;
    const L = layout(state);
    // 1 dot ≈ perDot requests; keep total flow around ~50 dots/sec
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(10, r.demandRps / 5))));
    perDot = Math.max(1, mag / 10);
    for (const type of Content.TYPE_KEYS) {
      const p = r.perType[type];
      spawnAcc[type] += (p.demand / perDot) * dtFrame;
      let n = Math.floor(spawnAcc[type]);
      spawnAcc[type] -= n;
      n = Math.min(n, 6);
      for (let i = 0; i < n && particles.length < 420; i++) {
        const fate = pickFate(type, r, state);
        const route = buildRoute(fate.fate, L, state);
        const pts = route.pts.map(([x, y]) => [x, y + (Math.random() - 0.5) * 22]);
        particles.push({
          pts, seg: 0, t: 0,
          speed: fate.fate === 'readHit' ? 420 : 260,
          color: Content.TYPES[type].color,
          fail: fate.fail && route.failIdx >= 0, failAt: route.failIdx,
          dead: false, fall: 0,
        });
      }
    }
  }

  function updateParticles(dtFrame) {
    for (const p of particles) {
      if (p.fall > 0) {
        p.fall += dtFrame;
        p.fy += 140 * dtFrame;
        if (p.fall > 0.7) p.dead = true;
        continue;
      }
      const [x1, y1] = p.pts[p.seg];
      const [x2, y2] = p.pts[p.seg + 1];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      p.t += (p.speed * dtFrame) / len;
      if (p.t >= 1) {
        p.seg++;
        p.t = 0;
        if (p.fail && p.seg >= p.failAt) {
          p.fall = 0.001;
          p.fx = p.pts[p.seg][0];
          p.fy = p.pts[p.seg][1];
          continue;
        }
        if (p.seg >= p.pts.length - 1) p.dead = true;
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].dead) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.fall > 0) {
        ctx.globalAlpha = Math.max(0, 1 - p.fall / 0.7);
        ctx.fillStyle = COLORS.bad;
        ctx.fillRect(p.fx - 2.5, p.fy - 2.5, 5, 5);
        ctx.globalAlpha = 1;
        continue;
      }
      const [x1, y1] = p.pts[p.seg];
      const [x2, y2] = p.pts[p.seg + 1];
      const x = x1 + (x2 - x1) * p.t, y = y1 + (y2 - y1) * p.t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------ scene
  function utilColor(u) {
    return u < 0.7 ? COLORS.good : u < 0.9 ? COLORS.warn : COLORS.bad;
  }

  function drawWire(a, b) {
    ctx.strokeStyle = 'rgba(90,110,140,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function boxFrame(b, on, label) {
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    ctx.fillStyle = on ? COLORS.panel : 'rgba(28,35,48,.35)';
    ctx.strokeStyle = on ? '#3b4658' : 'rgba(59,70,88,.5)';
    ctx.setLineDash(on ? [] : [4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, b.w, b.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = on ? COLORS.text : COLORS.dim;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x, y - 5);
    return { x, y };
  }

  function utilBar(x, y, w, frac, label) {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = utilColor(frac);
    ctx.fillRect(x, y, w * Math.min(1, frac), 5);
    if (label) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label + ' ' + Math.round(frac * 100) + '%', x + w + 6, y + 5);
    }
  }

  function drawClients(L, state, r) {
    const { x, y } = L.clients;
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('USERS', x, y - 34);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(fmt(state.users), x, y - 20);
    // little crowd
    const n = Math.min(24, 4 + Math.floor(Math.log10(Math.max(10, state.users)) * 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 10 + (i % 3) * 5;
      ctx.fillStyle = 'rgba(88,166,255,.5)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.dim;
    ctx.font = '9px monospace';
    const apps = Math.ceil(r.demandRps / S.RPS_PER_APP_SERVER);
    ctx.fillText(fmt(apps) + ' app servers', x, y + 34);
  }

  function drawPooler(L, state, r) {
    const b = L.pooler;
    if (!b.on) return;
    boxFrame(b, true, 'POOLER');
    ctx.textAlign = 'center';
    ctx.font = '9px monospace';
    ctx.fillStyle = COLORS.good;
    ctx.fillText('multiplexing', b.x, b.y + 2);
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('held: query only', b.x, b.y + 13);
  }

  function drawCache(L, state, r) {
    const b = L.cache;
    if (!b.on) return;
    const { x, y } = boxFrame(b, true, 'CACHE ×' + state.infra.cacheNodes);
    for (let i = 0; i < Math.min(8, state.infra.cacheNodes); i++) {
      ctx.fillStyle = 'rgba(78,163,255,.7)';
      ctx.fillRect(x + 8 + i * 16, y + 8, 12, 10);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(r.cache.hitRate * 100) + '% hit', x + 8, y + 36);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '9px monospace';
    ctx.fillText(fmt(r.cache.hits) + '/s absorbed', x + 8, y + 48);
    utilBar(x + 8, y + b.h - 12, b.w - 60, r.cache.util, 'ops');
  }

  function drawKv(L, state, r) {
    const b = L.kv;
    if (!b.on) return;
    const { x, y } = boxFrame(b, true, 'NoSQL KV ×' + state.infra.kvNodes);
    for (let i = 0; i < Math.min(8, state.infra.kvNodes); i++) {
      ctx.fillStyle = 'rgba(67,209,122,.7)';
      ctx.fillRect(x + 8 + i * 16, y + 8, 12, 10);
    }
    ctx.fillStyle = COLORS.dim;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(r.kv.rps) + '/s · no joins, no txns', x + 8, y + 34);
    utilBar(x + 8, y + b.h - 12, b.w - 60, r.kv.util, 'ops');
  }

  function drawWarehouse(L, state, r) {
    const b = L.warehouse;
    if (!b.on) return;
    boxFrame(b, true, 'OLAP WAREHOUSE');
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b48cff';
    ctx.fillText(fmt(r.perType.analytics.served) + '/s reports · ~2s', b.x, b.y + 3);
  }

  function drawSql(L, state, r) {
    const b = L.sql;
    const infra = state.infra;
    const label = 'SQL · db.t' + infra.tier +
      (infra.shards > 1 ? ' · ' + infra.shards + ' shards' : '') +
      (infra.replicas > 0 ? ' · ' + infra.replicas + ' replicas' : '');
    const { x, y } = boxFrame(b, true, label);
    const cols = infra.shards, rows = 1 + infra.replicas;
    const gw = b.w - 20, gh = 86;
    const cw = Math.min(24, (gw - (cols - 1) * 2) / cols);
    const ch = Math.min(20, (gh - (rows - 1) * 2) / rows);
    const gx = b.x - (cols * (cw + 2) - 2) / 2;
    for (let c = 0; c < cols; c++) {
      for (let rr = 0; rr < rows; rr++) {
        const isPrimary = rr === 0;
        const util = isPrimary ? r.sql.primaryUtil : r.sql.replicaUtil;
        const out = !isPrimary && rr > r.sql.replicas; // event knocked it out
        ctx.fillStyle = out ? 'rgba(139,150,165,.15)'
          : `rgba(${util < 0.7 ? '67,209,122' : util < 0.9 ? '227,179,65' : '248,81,73'},${0.25 + 0.6 * Math.min(1, util)})`;
        ctx.fillRect(gx + c * (cw + 2), y + 10 + rr * (ch + 2), cw, ch);
        if (isPrimary) {
          ctx.strokeStyle = 'rgba(215,222,232,.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(gx + c * (cw + 2) + 0.5, y + 10.5 + rr * (ch + 2), cw - 1, ch - 1);
        }
      }
    }
    const barY = y + b.h - 42;
    utilBar(x + 10, barY, 120, r.sql.primaryUtil, 'CPU');
    utilBar(x + 10, barY + 12, 120, r.sql.connCap > 0 ? r.sql.connUsed / r.sql.connCap : 0, 'CONN');
    ctx.fillStyle = COLORS.dim;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(r.sql.connUsed) + '/' + fmt(r.sql.connCap) + ' conns held', x + 10, barY + 34);
    if (r.sql.staleFrac > 0.02) {
      ctx.fillStyle = COLORS.warn;
      ctx.textAlign = 'right';
      ctx.fillText('REPLICA LAG — stale reads', x + b.w - 10, barY + 34);
    }
    if (r.sql.replayFrac > 0.05) {
      ctx.fillStyle = COLORS.dim;
      ctx.textAlign = 'right';
      ctx.fillText('replicas replaying ' + Math.round(r.sql.replayFrac * 100) + '% writes', x + b.w - 10, barY + 12);
    }
    // write-queue backlog
    if (state.backlog > 1) {
      const stack = Math.min(14, 1 + Math.floor(Math.log2(1 + state.backlog / 1000)));
      for (let i = 0; i < stack; i++) {
        ctx.fillStyle = 'rgba(255,157,60,.8)';
        ctx.fillRect(x - 16, y + b.h - 8 - i * 7, 10, 5);
      }
      ctx.fillStyle = '#ff9d3c';
      ctx.textAlign = 'right';
      ctx.fillText('backlog', x - 20, y + b.h - 4);
    }
    // migration overlay
    if (state.migration) {
      ctx.fillStyle = 'rgba(227,179,65,.12)';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = COLORS.warn;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RESHARDING ' + Math.ceil(state.migration.left) + 's — 60% capacity', b.x, b.y);
    }
  }

  function drawWires(L, state) {
    const infra = state.infra;
    const fates = ['readMiss', 'write'];
    if (infra.cacheNodes > 0) fates.push('readHit');
    fates.push(infra.kvNodes > 0 ? 'lookupKv' : 'lookupSql');
    fates.push(infra.warehouse ? 'analyticsOlap' : 'analyticsSql');
    const seen = new Set();
    for (const f of fates) {
      const { pts } = buildRoute(f, L, state);
      for (let i = 0; i < pts.length - 1; i++) {
        const key = pts[i] + '|' + pts[i + 1];
        if (seen.has(key)) continue;
        seen.add(key);
        drawWire({ x: pts[i][0], y: pts[i][1] }, { x: pts[i + 1][0], y: pts[i + 1][1] });
      }
    }
  }

  function drawScene(state, dtFrame, running) {
    const r = state.report;
    ctx.clearRect(0, 0, W, H);
    if (!r) return;
    const L = layout(state);
    drawWires(L, state);
    drawClients(L, state, r);
    drawPooler(L, state, r);
    drawCache(L, state, r);
    drawKv(L, state, r);
    drawWarehouse(L, state, r);
    drawSql(L, state, r);

    // active event badge (the toast fades; this stays for the duration)
    if (r.event) {
      const def = Content.EVENTS[r.event.key];
      ctx.fillStyle = 'rgba(227,179,65,.12)';
      ctx.strokeStyle = COLORS.warn;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(10, 10, 300, 30, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.warn;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(def.icon + ' ' + def.name + ' — ' + Math.ceil(r.event.left) + 's', 20, 29);
    }

    // exit / revenue
    ctx.fillStyle = COLORS.good;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('200 OK', L.exit.x, L.exit.y - 18);
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('+$' + (r.income).toFixed(0) + '/s', L.exit.x, L.exit.y - 6);

    if (running) {
      spawnParticles(state, dtFrame);
      updateParticles(dtFrame);
    }
    drawParticles();
    if (!running) {
      ctx.fillStyle = 'rgba(13,17,23,.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ PAUSED', W / 2, H / 2);
    }
  }

  // ------------------------------------------------------------------ charts
  function drawChart(canvas, history, spec) {
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    const c = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    c.font = '9px monospace';
    c.fillStyle = COLORS.dim;
    c.textAlign = 'left';
    c.fillText(spec.title, 6, 11);
    if (history.length < 2) return;
    const t0 = history[0].t, t1 = history[history.length - 1].t;
    const tx = t => 4 + (w - 8) * (t - t0) / Math.max(1, t1 - t0);
    let yOf;
    if (spec.log) {
      const lo = Math.log10(spec.min), hi = Math.log10(spec.max);
      yOf = v => h - 4 - (h - 20) * (Math.log10(Math.max(spec.min, Math.min(spec.max, v))) - lo) / (hi - lo);
    } else {
      let vmax = spec.min;
      for (const e of history) for (const s of spec.series) vmax = Math.max(vmax, s.get(e));
      let vmin = 0;
      for (const e of history) for (const s of spec.series) vmin = Math.min(vmin, s.get(e));
      yOf = v => h - 4 - (h - 20) * (v - vmin) / Math.max(1e-9, vmax - vmin);
    }
    if (spec.goal !== undefined) {
      c.strokeStyle = 'rgba(67,209,122,.5)';
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(0, yOf(spec.goal));
      c.lineTo(w, yOf(spec.goal));
      c.stroke();
      c.setLineDash([]);
    }
    for (const s of spec.series) {
      c.strokeStyle = s.color;
      c.lineWidth = 1.2;
      c.beginPath();
      history.forEach((e, i) => {
        const x = tx(e.t), y = yOf(s.get(e));
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      });
      c.stroke();
      if (s.fill) {
        c.lineTo(tx(t1), h - 4);
        c.lineTo(tx(t0), h - 4);
        c.closePath();
        c.fillStyle = s.fill;
        c.fill();
      }
    }
    c.fillStyle = COLORS.dim;
    c.textAlign = 'right';
    const last = history[history.length - 1];
    c.fillText(spec.label(last), w - 6, 11);
  }

  function renderCharts(state) {
    drawChart($('chart-rps'), state.history, {
      title: 'TRAFFIC (log)', log: true, min: 10, max: 10000000, goal: S.WIN_RPS,
      series: [
        { get: e => e.demand, color: 'rgba(139,150,165,.8)' },
        { get: e => e.served, color: COLORS.accent, fill: 'rgba(88,166,255,.15)' },
      ],
      label: e => fmt(e.served) + ' / ' + fmt(e.demand) + ' rps',
    });
    drawChart($('chart-lat'), state.history, {
      title: 'LATENCY ms (log)', log: true, min: 1, max: 5000, goal: S.TIMEOUT_MS,
      series: [
        { get: e => e.p50, color: COLORS.accent },
        { get: e => e.p99, color: COLORS.warn },
      ],
      label: e => 'p50 ' + e.p50.toFixed(0) + ' · p99 ' + e.p99.toFixed(0),
    });
    drawChart($('chart-cash'), state.history, {
      title: 'CASH', log: false, min: 100, goal: 0,
      series: [{ get: e => e.cash, color: COLORS.good, fill: 'rgba(67,209,122,.12)' }],
      label: e => '$' + fmt(e.cash),
    });
  }

  // ------------------------------------------------------------------- DOM
  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
    return Math.round(n).toString();
  }

  function buildShop(onBuy, onScaleDown) {
    const wrap = $('shop-items');
    for (const item of Content.SHOP) {
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML =
        '<div class="row1"><span class="name">' + item.name + '</span>' +
        '<span class="owned" id="owned-' + item.key + '"></span></div>' +
        '<div class="blurb">' + item.blurb + '</div>' +
        '<div class="tradeoff">⚖ ' + item.tradeoff + '</div>' +
        '<div class="run" id="run-' + item.key + '"></div>' +
        '<div class="buttons"><button id="buy-' + item.key + '"></button>' +
        (item.scaleDown ? '<button class="down" id="down-' + item.key + '" title="' +
          item.scaleDownLabel + '">−</button>' : '') +
        '</div>';
      wrap.appendChild(div);
      $('buy-' + item.key).addEventListener('click', () => onBuy(item.key));
      if (item.scaleDown) {
        $('down-' + item.key).addEventListener('click', () => onScaleDown(item.key));
      }
    }
  }

  function updateShop(state) {
    const costs = Engine.costBreakdown(state);
    for (const item of Content.SHOP) {
      const price = item.price(state);
      const btn = $('buy-' + item.key);
      const owned = item.ownedLabel(state);
      $('owned-' + item.key).textContent = owned || '';

      const cost = costs.find(c => c.key === item.key);
      const run = $('run-' + item.key);
      if (cost.total > 0) {
        run.innerHTML = 'runs at <b>$' + cost.total.toFixed(1) + '/s</b> — $' +
          cost.fixed.toFixed(1) + ' fixed' +
          (cost.marginal > 0 ? ' + $' + cost.marginal.toFixed(1) + ' nodes' : '');
        run.title = 'Fixed $' + cost.fixed.toFixed(1) + '/s: ' + cost.fixedNote + '.';
      } else {
        run.innerHTML = 'costs <b>$' + item.fixed.toFixed(1) + '/s</b> the moment you own one';
        run.title = 'Fixed cost covers: ' + item.fixedNote + '.';
      }

      if (price === null) {
        btn.textContent = 'maxed';
        btn.disabled = true;
        btn.className = '';
      } else {
        btn.textContent = 'buy — $' + fmt(price);
        btn.disabled = state.cash < price || !!state.outcome;
        btn.className = state.cash >= price ? 'affordable' : '';
      }
      if (item.scaleDown) {
        $('down-' + item.key).disabled = !item.canScaleDown(state) || !!state.outcome;
      }
    }
  }

  // money bar ----------------------------------------------------------
  const costSegs = {};

  function buildMoneybar() {
    const wrap = $('money-segments');
    for (const item of Content.SHOP) {
      const seg = document.createElement('div');
      seg.className = 'cost-seg';
      seg.style.background = item.color + '55';
      seg.style.boxShadow = 'inset 3px 0 0 ' + item.color;
      wrap.appendChild(seg);
      costSegs[item.key] = seg;
    }
  }

  function runwayText(secs) {
    if (!isFinite(secs)) return '';
    if (secs <= 0) return 'RUNWAY: out';
    const m = Math.floor(secs / 60), s = Math.round(secs % 60);
    return 'RUNWAY: ' + (m > 0 ? m + 'm ' + s + 's' : s + 's');
  }

  function updateMoneybar(state) {
    const r = state.report;
    if (!r) return;
    const scale = Math.max(r.income, r.spend, 1);
    $('money-income').textContent = 'REVENUE $' + fmt(r.income) + '/s';
    for (const part of r.costs.parts) {
      const seg = costSegs[part.key];
      const frac = part.total / scale;
      seg.style.width = (frac * 100).toFixed(2) + '%';
      seg.textContent = frac > 0.1 ? '$' + fmt(part.total) : '';
      seg.title = part.name + ' — $' + part.total.toFixed(1) + '/s = $' +
        part.fixed.toFixed(1) + ' fixed (' + part.fixedNote + ')' +
        (part.marginal > 0 ? ' + $' + part.marginal.toFixed(1) + ' per-node hosting' : '') + '.';
    }
    $('money-marker').style.left = (100 * r.income / scale).toFixed(2) + '%';
    const net = r.income - r.spend;
    const el = $('money-net');
    el.textContent = (net >= 0 ? 'PROFIT +$' : 'BURN −$') + fmt(Math.abs(net)) + '/s' +
      (net < 0 ? '  ·  ' + runwayText(r.runway) : '');
    el.style.color = net >= 0 ? COLORS.good : r.runway < 60 ? COLORS.bad : COLORS.warn;
    el.title = 'Maintenance $' + r.spend.toFixed(1) + '/s = $' + r.costs.fixed.toFixed(1) +
      '/s fixed (teams, monitoring, on-call) + $' + r.costs.marginal.toFixed(1) +
      '/s per-node hosting. Fixed cost is a step function: each new kind of system ' +
      'adds one whether you use it or not.';
  }

  function updateTopbar(state) {
    const r = state.report;
    if (!r) return;
    $('stat-rps').textContent = fmt(r.servedRps);
    $('stat-demand').textContent = fmt(r.demandRps);
    const errFrac = r.demandRps > 0 ? r.failRps / r.demandRps : 0;
    const err = $('stat-err');
    err.textContent = (errFrac * 100).toFixed(1) + '%';
    err.style.color = errFrac > 0.05 ? COLORS.bad : errFrac > 0.01 ? COLORS.warn : COLORS.good;
    const p99 = $('stat-p99');
    p99.textContent = r.p99.toFixed(0) + 'ms';
    p99.style.color = r.p99 > 500 ? COLORS.bad : r.p99 > 200 ? COLORS.warn : COLORS.good;
    const users = $('stat-users');
    const fleeing = errFrac > S.ERR_TOLERANCE + 0.01;
    users.textContent = (fleeing ? '▼' : '') + fmt(state.users);
    users.style.color = fleeing ? COLORS.bad : COLORS.text;
    const rep = $('stat-rep');
    rep.textContent = Math.round(state.reputation);
    rep.style.color = state.reputation > 70 ? COLORS.good : state.reputation > 55 ? COLORS.warn : COLORS.bad;
    const cash = $('stat-cash');
    cash.textContent = '$' + fmt(Math.max(0, state.cash));
    cash.style.color = state.cash < 50 ? COLORS.bad : COLORS.text;
    const net = r.income - r.spend;
    $('stat-income').textContent = (net >= 0 ? '+$' : '−$') + fmt(Math.abs(net)) + '/s';
    $('stat-income').style.color = net >= 0 ? COLORS.good : COLORS.bad;
    $('insight-count').textContent = Object.keys(state.insights).length;
    $('insight-total').textContent = Content.INSIGHT_KEYS.length;
    // win progress
    const wb = $('winbar');
    if (state.winTimer > 0 && !state.outcome) {
      wb.classList.remove('hidden');
      $('winbar-fill').style.width = (100 * state.winTimer / S.WIN_HOLD_S) + '%';
      $('winbar-text').textContent = '1M RPS SUSTAINED — IPO IN ' + Math.ceil(S.WIN_HOLD_S - state.winTimer) + 's';
    } else {
      wb.classList.add('hidden');
    }
  }

  // workload mix bar --------------------------------------------------
  const mixSegs = {};

  function buildMixbar() {
    const wrap = $('mix-segments');
    for (const cls of Content.MIX_CLASSES) {
      const seg = document.createElement('div');
      seg.className = 'mix-seg';
      seg.style.background = cls.color + '55';
      seg.style.boxShadow = 'inset 3px 0 0 ' + cls.color;
      wrap.appendChild(seg);
      mixSegs[cls.key] = seg;
    }
  }

  function repetitionLabel(rep) {
    return rep >= 0.85 ? 'high — cache-friendly' : rep >= 0.6 ? 'moderate' : 'low — cache is a cash sink';
  }

  function updateMixbar(state) {
    const r = state.report;
    if (!r || !state.profile) return;
    const prof = Content.PROFILES[state.profile];
    const label = $('mix-profile');
    label.textContent = 'WORKLOAD: ' + prof.name.toUpperCase();
    label.title = prof.blurb + ' Repeated reads: ' + repetitionLabel(state.repetition) + '.';
    const live = {}, base = {};
    for (const k of Content.TYPE_KEYS) {
      live[k] = r.demandRps > 0 ? r.perType[k].demand / r.demandRps : state.mix[k];
      base[k] = state.mix[k];
    }
    for (const cls of Content.MIX_CLASSES) {
      const now = cls.share(state, live);
      const seg = mixSegs[cls.key];
      seg.style.width = (now * 100).toFixed(1) + '%';
      seg.textContent = now >= 0.06 ? cls.label + ' ' + Math.round(now * 100) + '%' : '';
      seg.title = cls.label + ' — ' + Math.round(now * 100) + '% of traffic now (' +
        Math.round(cls.share(state, base) * 100) + '% baseline). ' + cls.desc;
    }
  }

  function buildLegend() {
    const el = $('legend');
    let html = '';
    for (const k of Content.TYPE_KEYS) {
      html += '<span><span class="legend-dot" style="background:' + Content.TYPES[k].color + '"></span>' +
        Content.TYPES[k].label + '</span>';
    }
    html += '<span id="legend-scale"></span>';
    el.innerHTML = html;
  }

  function updateLegend() {
    $('legend-scale').textContent = '● ≈ ' + fmt(perDot) + ' request' + (perDot > 1 ? 's' : '');
  }

  // toasts -------------------------------------------------------------
  function toast(eventKey) {
    const def = Content.EVENTS[eventKey];
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<div class="t-name">' + def.icon + ' ' + def.name + '</div>' +
      '<div class="t-blurb">' + def.blurb + '</div>';
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), Math.min(def.dur, 8) * 1000);
  }

  // component probe: per-component observability -------------------------
  //
  // Framed as the Four Golden Signals (Google SRE): TRAFFIC, LATENCY, ERRORS,
  // SATURATION — plus what the thing costs to run. Every component answers the
  // same four questions, which is the whole point of the discipline: you should
  // be able to walk up to any box in an architecture and ask them.
  //
  // One entry per component; each returns {title, sub, secs:[[label, rows]],
  // note}. Rows are [key, value, className].
  const PROBES = {
    clients: (s, r) => ({
      title: 'Users & app tier',
      sub: fmt(s.users) + ' users · ' + fmt(Math.ceil(r.demandRps / S.RPS_PER_APP_SERVER)) + ' app servers',
      secs: [
        ['TRAFFIC (rate)', Content.TYPE_KEYS.map(k =>
          [Content.TYPES[k].label, fmt(r.perType[k].demand) + '/s', ''])],
        ['ERRORS', [
          ['failed', fmt(r.failRps) + '/s', r.failRps > 0 ? 'badv' : ''],
          ['error rate', (100 * (r.demandRps > 0 ? r.failRps / r.demandRps : 0)).toFixed(1) + '%',
            r.failRps / Math.max(1, r.demandRps) > 0.02 ? 'badv' : 'goodv'],
        ]],
        ['LATENCY (what users feel)', [
          ['p50', r.p50.toFixed(0) + 'ms', r.p50 > 200 ? 'warnv' : 'goodv'],
          ['p99', r.p99.toFixed(0) + 'ms', r.p99 > 500 ? 'badv' : r.p99 > 200 ? 'warnv' : 'goodv'],
          ['client timeout', S.TIMEOUT_MS + 'ms', ''],
        ]],
      ],
      note: 'Rate, Errors, Duration — the RED method, measured at the edge. This is what your users actually experience, and the only view that matters for an SLO.',
    }),

    pooler: (s, r) => ({
      title: 'Connection pooler',
      sub: 'multiplexing clients onto database connections',
      secs: [
        ['TRAFFIC', [['queries through', fmt(r.servedRps) + '/s', '']]],
        ['SATURATION', [
          ['conns held', fmt(r.sql.connUsed) + ' / ' + fmt(r.sql.connCap),
            r.sql.connUsed > 0.9 * r.sql.connCap ? 'badv' : 'goodv'],
          ['avg hold time', r.p50.toFixed(0) + 'ms', ''],
        ]],
        ['COST', [['run-rate', '$' + r.costs.parts.find(p => p.key === 'pooler').total.toFixed(1) + '/s', '']]],
      ],
      note: 'Little\'s Law: connections = arrival rate × hold time. Without this, app servers hold connections while idle and the database starves at low CPU.',
    }),

    cache: (s, r) => ({
      title: 'Cache tier',
      sub: s.infra.cacheNodes + ' nodes · ' + fmt(s.infra.cacheNodes * S.CACHE_OPS) + ' ops/s capacity',
      secs: [
        ['TRAFFIC', [
          ['hits (absorbed)', fmt(r.cache.hits) + '/s', 'goodv'],
          ['misses (to SQL)', fmt(r.cache.misses) + '/s', ''],
        ]],
        ['SATURATION', [
          ['hit rate', (100 * r.cache.hitRate).toFixed(0) + '%',
            r.cache.hitRate < 0.4 ? 'badv' : r.cache.hitRate < 0.7 ? 'warnv' : 'goodv'],
          ['ceiling (repetition)', (100 * s.repetition * S.CACHE_HIT_MAX).toFixed(0) + '%', ''],
          ['ops utilization', (100 * r.cache.util).toFixed(0) + '%', r.cache.util > 0.9 ? 'badv' : ''],
        ]],
        ['COST', [
          ['run-rate', '$' + r.costs.parts.find(p => p.key === 'cache').total.toFixed(1) + '/s', ''],
          ['per DB read saved', '$' + (r.cache.hits > 0
            ? (r.costs.parts.find(p => p.key === 'cache').total / r.cache.hits * 1000).toFixed(3)
            : '—') + '/1k', ''],
        ]],
      ],
      note: 'Hit rate is the only number that justifies a cache. Its ceiling is set by how much this workload repeats, not by how many nodes you buy.',
    }),

    kv: (s, r) => ({
      title: 'NoSQL KV store',
      sub: s.infra.kvNodes + ' nodes · ' + fmt(s.infra.kvNodes * S.KV_OPS) + ' ops/s capacity',
      secs: [
        ['TRAFFIC', [['lookups served', fmt(r.kv.rps) + '/s', '']]],
        ['SATURATION', [['utilization', (100 * r.kv.util).toFixed(0) + '%',
          r.kv.util > 0.9 ? 'badv' : r.kv.util > 0.7 ? 'warnv' : 'goodv']]],
        ['ERRORS', [['dropped', fmt(r.fails.kv) + '/s', r.fails.kv > 0 ? 'badv' : 'goodv']]],
        ['LATENCY', [['p50', r.perType.lookup.latencyMs.toFixed(1) + 'ms', 'goodv']]],
        ['COST', [['run-rate', '$' + r.costs.parts.find(p => p.key === 'kv').total.toFixed(1) + '/s', '']]],
      ],
      note: 'Scales linearly because it refuses to do the hard things: no joins, no multi-row transactions, no ad-hoc queries.',
    }),

    warehouse: (s, r) => ({
      title: 'Analytics warehouse (OLAP)',
      sub: 'columnar copy, fed off the transaction path',
      secs: [
        ['TRAFFIC', [['reports served', fmt(r.perType.analytics.served) + '/s', '']]],
        ['LATENCY', [['per report', (S.WAREHOUSE_LAT_MS / 1000).toFixed(1) + 's', 'warnv']]],
        ['SATURATION', [['work removed from OLTP', fmt(r.perType.analytics.demand * S.ANALYTICS_UNITS) +
          ' units/s', 'goodv']]],
        ['COST', [['run-rate', '$' + r.costs.parts.find(p => p.key === 'warehouse').total.toFixed(1) + '/s', '']]],
      ],
      note: 'Slow on purpose, and nobody minds — reports are not on the checkout path. This deletes load rather than adding nodes to absorb it.',
    }),

    sql: (s, r) => {
      const u = r.sql.units;
      const cap = r.sql.clusterCapTotal;
      const unitRow = (label, v) => [label, fmt(v) + ' u/s (' +
        (cap > 0 ? Math.round(100 * v / cap) : 0) + '%)', ''];
      const sqlCost = r.costs.parts.find(p => p.key === 'tier').total +
        r.costs.parts.find(p => p.key === 'shard').total +
        r.costs.parts.find(p => p.key === 'replica').total;
      return {
        title: 'SQL cluster',
        sub: 'tier ' + s.infra.tier + ' · ' + s.infra.shards + ' shard' + (s.infra.shards > 1 ? 's' : '') +
          ' · ' + s.infra.replicas + ' replica/shard · ' + (s.infra.shards * (1 + s.infra.replicas)) + ' nodes',
        secs: [
          ['WORK BREAKDOWN (query units)', [
            unitRow('reads', u.read),
            unitRow('writes', u.write),
            unitRow('analytics', u.analytics),
            unitRow('write replay', u.replay),
            ['cluster capacity', fmt(cap) + ' u/s', ''],
          ]],
          ['SATURATION', [
            ['primary CPU', (100 * r.sql.primaryUtil).toFixed(0) + '%',
              r.sql.primaryUtil > 0.85 ? 'badv' : r.sql.primaryUtil > 0.7 ? 'warnv' : 'goodv'],
            ['replica CPU', s.infra.replicas ? (100 * r.sql.replicaUtil).toFixed(0) + '%' : '—',
              r.sql.replicaUtil > 0.85 ? 'badv' : ''],
            ['connections', fmt(r.sql.connUsed) + ' / ' + fmt(r.sql.connCap),
              r.sql.connUsed > 0.9 * r.sql.connCap ? 'badv' : 'goodv'],
            ['replication lag', r.sql.staleFrac > 0.01
              ? (100 * r.sql.staleFrac).toFixed(0) + '% stale reads' : 'none',
              r.sql.staleFrac > 0.05 ? 'badv' : 'goodv'],
            ['write backlog', s.backlog > 1 ? fmt(s.backlog) + ' units' : 'none',
              s.backlog > 1 ? 'warnv' : 'goodv'],
          ]],
          ['ERRORS (by cause)', [
            ['connection refused', fmt(r.fails.connections) + '/s', r.fails.connections > 0 ? 'badv' : ''],
            ['out of capacity', fmt(r.fails.cpu) + '/s', r.fails.cpu > 0 ? 'badv' : ''],
            ['client timeout', fmt(r.fails.timeout) + '/s', r.fails.timeout > 0 ? 'badv' : ''],
          ]],
          ['COST', [['run-rate (nodes + ops)', '$' + sqlCost.toFixed(1) + '/s', '']]],
        ],
        note: 'Utilization, Saturation, Errors — the USE method, per resource. The work breakdown is the first thing to read: it tells you whether a bigger box, more shards, or less work is the answer.',
      };
    },

    exit: (s, r) => ({
      title: 'Served responses',
      sub: 'the only traffic that earns anything',
      secs: [
        ['TRAFFIC', [
          ['served', fmt(r.servedRps) + '/s', 'goodv'],
          ['demanded', fmt(r.demandRps) + '/s', ''],
          ['goodput', (100 * (r.demandRps > 0 ? r.servedRps / r.demandRps : 1)).toFixed(1) + '%',
            r.servedRps / Math.max(1, r.demandRps) < 0.95 ? 'warnv' : 'goodv'],
        ]],
        ['MONEY', [
          ['revenue', '$' + fmt(r.income) + '/s', 'goodv'],
          ['maintenance', '$' + fmt(r.spend) + '/s', 'badv'],
          ['fixed share', (100 * (r.spend > 0 ? r.costs.fixed / r.spend : 0)).toFixed(0) + '%', ''],
          ['net', (r.income >= r.spend ? '+$' : '−$') + fmt(Math.abs(r.income - r.spend)) + '/s',
            r.income >= r.spend ? 'goodv' : 'badv'],
        ]],
      ],
      note: 'Goodput, not throughput: a request you failed cost you money to receive and earned you nothing.',
    }),
  };

  // Hit-test the scene. Only components that exist can be probed.
  function probeAt(px, py, state) {
    const L = layout(state);
    const targets = [
      { key: 'clients', box: { x: L.clients.x, y: L.clients.y, w: 100, h: 100 }, on: true },
      { key: 'pooler', box: L.pooler, on: state.infra.pooler },
      { key: 'cache', box: L.cache, on: state.infra.cacheNodes > 0 },
      { key: 'kv', box: L.kv, on: state.infra.kvNodes > 0 },
      { key: 'warehouse', box: L.warehouse, on: state.infra.warehouse },
      { key: 'sql', box: L.sql, on: true },
      { key: 'exit', box: { x: L.exit.x, y: L.exit.y, w: 90, h: 90 }, on: true },
    ];
    for (const t of targets) {
      if (!t.on) continue;
      const b = t.box;
      if (Math.abs(px - b.x) <= b.w / 2 + 6 && Math.abs(py - b.y) <= b.h / 2 + 6) return t.key;
    }
    return null;
  }

  let probeKey = null, probeX = 0, probeY = 0;

  function renderProbe(state) {
    const el = $('probe');
    if (!probeKey || !state.report) {
      el.classList.add('hidden');
      return;
    }
    const data = PROBES[probeKey](state, state.report);
    let html = '<div class="p-title">' + data.title + '</div><div class="p-sub">' + data.sub + '</div>';
    for (const [label, rows] of data.secs) {
      html += '<div class="p-sec">' + label + '</div>';
      for (const [k, v, cls] of rows) {
        html += '<div class="p-row"><span class="k">' + k + '</span><span class="v ' + cls + '">' + v + '</span></div>';
      }
    }
    html += '<div class="p-note">' + data.note + '</div>';
    el.innerHTML = html;
    el.classList.remove('hidden');
    // keep it on screen
    const maxX = scene.clientWidth - el.offsetWidth - 8;
    const maxY = scene.clientHeight - el.offsetHeight - 8;
    el.style.left = Math.max(8, Math.min(maxX, probeX + 16)) + 'px';
    el.style.top = Math.max(8, Math.min(maxY, probeY + 14)) + 'px';
  }

  // guru ---------------------------------------------------------------
  const LOAD_KINDS = [
    { key: 'read', label: 'reads', color: '#4ea3ff' },
    { key: 'write', label: 'writes', color: '#ff9d3c' },
    { key: 'analytics', label: 'analytics', color: '#b48cff' },
    { key: 'replay', label: 'replay', color: '#8b96a5' },
  ];

  function updateGuru(state) {
    const panel = $('guru-panel');
    if (panel.classList.contains('hidden')) return;
    const r = state.report;
    if (!r) return;

    // where the cluster's work is going — the diagnosis behind the advice
    const mix = Guru.loadMix(r);
    const load = $('guru-load');
    let bar = '<div class="gl-title">WHAT YOUR CLUSTER IS DOING</div><div class="gl-bar">';
    for (const kind of LOAD_KINDS) {
      const frac = mix[kind.key];
      if (frac <= 0.001) continue;
      bar += '<div class="gl-seg" style="width:' + (frac * 100).toFixed(1) + '%;background:' +
        kind.color + '" title="' + kind.label + ': ' + Math.round(frac * 100) + '% of cluster work">' +
        (frac > 0.13 ? kind.label + ' ' + Math.round(frac * 100) + '%' : '') + '</div>';
    }
    bar += '</div>';
    load.innerHTML = mix.total > 0 ? bar : '';

    const cards = $('guru-cards');
    cards.innerHTML = '';
    for (const advice of Guru.advise(state, r)) {
      const el = document.createElement('div');
      el.className = 'guru-card ' + advice.severity;
      el.innerHTML = '<div class="gc-head"></div><div class="gc-body"></div><div class="gc-action"></div>';
      el.querySelector('.gc-head').textContent = advice.headline;
      el.querySelector('.gc-body').textContent = advice.body;
      el.querySelector('.gc-action').textContent = advice.action;
      cards.appendChild(el);
    }
  }

  function toggleGuru(state) {
    const panel = $('guru-panel');
    const open = panel.classList.toggle('hidden');
    $('btn-guru').classList.toggle('sel', !open);
    updateGuru(state);
    return !open;
  }

  function closeGuru() {
    $('guru-panel').classList.add('hidden');
    $('btn-guru').classList.remove('sel');
  }

  // management memos ---------------------------------------------------
  function dismissMemo(el) {
    if (el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 350);
  }

  function memo(m) {
    const wrap = $('memos');
    while (wrap.children.length >= 3) dismissMemo(wrap.firstElementChild);
    const el = document.createElement('div');
    el.className = 'memo';
    el.innerHTML =
      '<div class="memo-head"><span>Internal memo</span><span>do not reply</span></div>' +
      '<div class="memo-subject"></div><div class="memo-body"></div><div class="memo-from"></div>';
    el.querySelector('.memo-subject').textContent = m.subject;
    el.querySelector('.memo-body').textContent = '“' + m.body + '”';
    el.querySelector('.memo-from').textContent = '— ' + m.from + (m.title ? ', ' + m.title : '');
    el.addEventListener('click', () => dismissMemo(el));
    wrap.appendChild(el);
    setTimeout(() => dismissMemo(el), Content.MEMO_DWELL * 1000);
  }

  function clearMemos() {
    $('memos').innerHTML = '';
  }

  // modal --------------------------------------------------------------
  function showInsight(key, onClose) {
    const ins = Content.INSIGHTS[key];
    $('modal-backdrop').classList.remove('hidden');
    $('insight-card').classList.remove('hidden');
    $('drawer').classList.add('hidden');
    $('card-title').textContent = ins.title;
    $('card-text').textContent = ins.text;
    $('card-ok').onclick = () => {
      $('modal-backdrop').classList.add('hidden');
      $('insight-card').classList.add('hidden');
      onClose();
    };
  }

  function showDrawer(state, onClose) {
    $('modal-backdrop').classList.remove('hidden');
    $('drawer').classList.remove('hidden');
    $('insight-card').classList.add('hidden');
    const list = $('drawer-list');
    list.innerHTML = '';
    for (const key of Content.INSIGHT_KEYS) {
      const ins = Content.INSIGHTS[key];
      const got = state.insights[key];
      const div = document.createElement('div');
      div.className = 'drawer-item' + (got ? '' : ' locked');
      div.innerHTML = '<div class="card-title">' + (got ? '✓ ' + ins.title : '🔒 ???') + '</div>' +
        (got ? '<div class="card-text">' + ins.text + '</div>' : '');
      list.appendChild(div);
    }
    $('drawer-close').onclick = () => {
      $('modal-backdrop').classList.add('hidden');
      $('drawer').classList.add('hidden');
      onClose();
    };
  }

  const DEATH_TEXT = {
    bankrupt: 'The money ran out. Infrastructure has a run-rate; capacity you are not using is cash on fire. Buy what the bottleneck needs, not what the catalog offers.',
    connections: 'Connection starvation. The database refused new connections while its CPU sat mostly idle — app servers held them all. A connection pooler multiplexes thousands of clients onto a few dozen busy connections.',
    cpu: 'CPU saturation. Query demand exceeded total capacity, work queued, and everything slowed until users left. Scale the tier, add replicas for reads, shard for writes — before 80% utilization, not after.',
    timeout: 'The latency hockey stick. Utilization pinned near 100%, so latency exploded past what users tolerate. A system at 95% utilization is not "efficient" — it is 20× slower than at 50%.',
    kv: 'The KV store was undersized and lookups failed. Linear-scaling stores still need nodes.',
    cache: 'The cache tier collapsed under its own traffic.',
    latency: 'Users drifted away as errors and latency mounted. Somewhere a bottleneck went unwatched.',
  };

  function showEnd(state, onRestart) {
    $('modal-backdrop').classList.remove('hidden');
    $('endscreen').classList.remove('hidden');
    $('insight-card').classList.add('hidden');
    $('drawer').classList.add('hidden');
    const won = state.outcome === 'won';
    $('end-kicker').textContent = won ? 'SUSTAINED 1,000,000 RPS' : 'POST-MORTEM';
    const t = $('end-title');
    t.textContent = won ? 'IPO. You scaled it. 🔔' : 'The startup is dead.';
    t.className = 'card-title ' + (won ? 'won' : 'lost');
    const mins = Math.floor(state.t / 60), secs = Math.round(state.t % 60);
    $('end-text').textContent = (won
      ? 'From 20 requests/second to one million in ' + mins + 'm ' + secs + 's. '
      : (DEATH_TEXT[state.deathCause] || DEATH_TEXT.latency) + ' Survived ' + mins + 'm ' + secs + 's, peaked at ' +
        fmt(state.peakUsers * S.RPS_PER_USER) + ' RPS. ')
      + 'Insights collected: ' + Object.keys(state.insights).length + '/' + Content.INSIGHT_KEYS.length + '.';
    const list = $('end-insights');
    list.innerHTML = '';
    for (const key of Content.INSIGHT_KEYS) {
      if (!state.insights[key]) continue;
      const div = document.createElement('div');
      div.className = 'drawer-item';
      div.innerHTML = '<div class="card-title">✓ ' + Content.INSIGHTS[key].title + '</div>' +
        '<div class="card-text">' + Content.INSIGHTS[key].text + '</div>';
      list.appendChild(div);
    }
    $('btn-restart').onclick = onRestart;
  }

  // ------------------------------------------------------------------- init
  function resize() {
    W = scene.clientWidth;
    H = scene.clientHeight;
    dpr = window.devicePixelRatio || 1;
    scene.width = W * dpr;
    scene.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const id of ['chart-rps', 'chart-lat', 'chart-cash']) {
      const c = $(id);
      c.width = c.clientWidth;
      c.height = c.clientHeight;
    }
  }

  function init(onBuy, onScaleDown) {
    scene = $('scene');
    ctx = scene.getContext('2d');
    buildShop(onBuy, onScaleDown);
    buildLegend();
    buildMixbar();
    buildMoneybar();
    scene.addEventListener('mousemove', e => {
      const rect = scene.getBoundingClientRect();
      probeX = e.clientX - rect.left;
      probeY = e.clientY - rect.top;
      probeKey = probeState ? probeAt(probeX, probeY, probeState) : null;
      if (probeState) renderProbe(probeState);
    });
    scene.addEventListener('mouseleave', () => {
      probeKey = null;
      $('probe').classList.add('hidden');
    });
    window.addEventListener('resize', resize);
    resize();
  }

  let shopClock = 0;
  let probeState = null;   // latest state, so hover can render between ticks

  function render(state, dtFrame, running) {
    probeState = state;
    drawScene(state, dtFrame, running);
    if (probeKey) renderProbe(state);
    updateTopbar(state);
    updateLegend();
    shopClock -= dtFrame;
    if (shopClock <= 0) {
      shopClock = 0.25;
      // drift check: reconverge canvas bitmaps to their CSS size even if a
      // resize event was missed mid-drag
      if (scene.clientWidth !== W || scene.clientHeight !== H) resize();
      updateShop(state);
      updateMixbar(state);
      updateMoneybar(state);
      updateGuru(state);
      renderCharts(state);
    }
  }

  return {
    init, render, toast, memo, clearMemos, toggleGuru, closeGuru,
    showInsight, showDrawer, showEnd, fmt,
    probes: PROBES, // exported for tests
  };
})();
