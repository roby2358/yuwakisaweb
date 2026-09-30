// LOAD BEARING — everything the player sees. Reads state and state.report; never
// computes a game fact of its own, and never writes to state.
//
// Three ideas hold the screen together:
//   * the MAP is a drawing of the infra struct — boxes are stations, arrows are
//     the routes traffic actually took this tick (report.links).
//   * every verdict about a number comes from Fmt.level over Content.BANDS, so
//     a bar on the canvas and a row in a panel can never disagree.
//   * the PROBE answers the same four questions for every box, and how much of
//     the answer you get depends on how much telemetry you bought.

var UI = (() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const COLOR = { good: '#43d17a', warn: '#e3b341', bad: '#f85149' };
  const verdict = (value, band) => Fmt.level(value, Content.BANDS[band]);

  let onBuy = null, onScaleDown = null;
  let hover = null;          // station key under the pointer
  let pointer = { x: 0, y: 0 };
  let boxes = {};            // station key → rect, rebuilt on resize
  let guruOpen = false;
  let lastState = null;      // the pointer handler needs the board it is over
  let shopAcc = 0, guruAcc = 0;
  let dash = 0;

  // ---- the map ------------------------------------------------------------
  const COLS = 6, ROWS = 3;

  // Only the boxes this workload could need, and only once there is a design
  // to draw. Everything else stays off the board — a diagram with every
  // component on it is a catalogue, not a design.
  const onBoard = state => Content.STATION_KEYS.filter(key => state.report.stations[key].relevant);

  function layout(canvas) {
    const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
    const padX = 68, padY = 22;
    const cw = (w - padX * 2) / COLS, ch = (h - padY * 2) / ROWS;
    const bw = Math.min(cw - 16, 132), bh = Math.min(ch - 18, 74);
    boxes = {};
    for (const key of Content.STATION_KEYS) {
      const def = Content.STATIONS[key];
      boxes[key] = {
        x: padX + def.col * cw + (cw - bw) / 2,
        y: padY + def.row * ch + (ch - bh) / 2,
        w: bw, h: bh,
      };
    }
    boxes.client = { x: 8, y: padY + ch + (ch - bh) / 2 + bh / 2 - 18, w: 46, h: 36 };
    return { w, h };
  }

  // Arrows are the answer to "where does this traffic go?", drawn from what the
  // engine actually routed rather than from the shop list — so a component you
  // own but never send anything to has no arrow, which is itself information.
  function drawLinks(ctx, report) {
    const merged = new Map();
    for (const link of report.links) {
      if (link.rps <= 0) continue;
      const id = link.from + '>' + link.to;
      const at = merged.get(id);
      if (at) { at.rps += link.rps; if (link.rps > at.top) { at.top = link.rps; at.cls = link.cls; } }
      else merged.set(id, { from: link.from, to: link.to, rps: link.rps, top: link.rps, cls: link.cls });
    }
    const peak = Math.max(1, ...[...merged.values()].map(l => l.rps));
    ctx.lineCap = 'round';
    for (const link of merged.values()) {
      const a = boxes[link.from], b = boxes[link.to];
      if (!a || !b) continue;
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      const mid = (x1 + x2) / 2;
      const share = Math.log10(1 + 9 * link.rps / peak);
      ctx.strokeStyle = Content.CLASSES[link.cls].color;
      ctx.globalAlpha = 0.16 + 0.4 * share;
      ctx.lineWidth = 1 + 4 * share;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(mid, y1, mid, y2, x2, y2);
      ctx.stroke();
      // the moving dashes are the only animation on the board; they read as
      // flow without costing a particle system
      ctx.globalAlpha = 0.5 + 0.4 * share;
      ctx.setLineDash([3, 22]);
      ctx.lineDashOffset = -dash;
      ctx.lineWidth = 1.4 + 3 * share;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawBox(ctx, state, report, key) {
    const def = Content.STATIONS[key], st = report.stations[key], box = boxes[key];
    const owned = st.owned;
    const level = verdict(st.util, 'util');
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 6);
    ctx.fillStyle = owned ? '#161b22' : '#101419';
    ctx.fill();
    ctx.lineWidth = hover === key ? 2 : 1;
    ctx.setLineDash(owned ? [] : [3, 3]);
    ctx.strokeStyle = !owned ? '#2b3240'
      : (level === 'good' ? (hover === key ? def.color : '#2b3240') : COLOR[level]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = owned ? def.color : '#3d4552';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText(def.short, box.x + 8, box.y + 15);

    if (!owned) {
      ctx.fillStyle = '#3d4552';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(def.idleLabel(state.infra), box.x + 8, box.y + 30);
      ctx.restore();
      return;
    }
    if (!state.live) {
      ctx.fillStyle = def.color;
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('×' + Fmt.count(st.nodes), box.x + 8, box.y + 30);
      ctx.fillStyle = '#4b5563';
      ctx.fillText(Fmt.count(st.cap) + ' units/s', box.x + 8, box.y + 42);
      ctx.restore();
      return;
    }

    // utilization bar — the one number every box has, and the one that decides
    // latency for everything travelling through it
    const bw = box.w - 16, by = box.y + box.h - 20;
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(box.x + 8, by, bw, 6);
    ctx.fillStyle = COLOR[level];
    ctx.fillRect(box.x + 8, by, bw * Math.min(1, st.util), 6);

    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = '#7d8899';
    ctx.fillText(Fmt.rate(st.inRps), box.x + 8, box.y + 29);
    const nodeLevel = verdict(st.nodes, 'redundancy');
    ctx.fillStyle = nodeLevel === 'bad' ? COLOR.bad : '#4b5563';
    ctx.fillText('×' + Fmt.count(st.nodes), box.x + 8, box.y + 41);
    ctx.fillStyle = COLOR[level];
    ctx.textAlign = 'right';
    ctx.fillText(Fmt.pct(st.util), box.x + box.w - 8, box.y + 41);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawScene(state) {
    const canvas = $('scene');
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * devicePixelRatio)
        || canvas.height !== Math.round(rect.height * devicePixelRatio)) {
      canvas.width = Math.round(rect.width * devicePixelRatio);
      canvas.height = Math.round(rect.height * devicePixelRatio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const size = layout(canvas);
    ctx.clearRect(0, 0, size.w, size.h);
    const report = state.report;
    if (!report) return;

    drawLinks(ctx, report);

    const c = boxes.client;
    ctx.fillStyle = '#1c2230';
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 5);
    ctx.fill();
    ctx.fillStyle = '#7d8899';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('USERS', c.x + 6, c.y + 15);
    ctx.fillText(Fmt.count(state.users), c.x + 6, c.y + 27);

    for (const key of onBoard(state)) drawBox(ctx, state, report, key);

    if (report.event) {
      const def = Content.EVENTS[report.event.key];
      ctx.fillStyle = COLOR.bad;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.icon + '  ' + def.name.toUpperCase() + '   '
        + report.event.left.toFixed(0) + 's', size.w / 2, size.h - 8);
      ctx.textAlign = 'left';
    }
    if (report.migration) {
      ctx.fillStyle = COLOR.warn;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('resharding — capacity reduced for '
        + report.migration.left.toFixed(0) + 's', 12, 16);
    }
  }

  // ---- the probe ----------------------------------------------------------
  // Every box answers the same four questions. How much of the answer you get
  // is bought, not given: with no telemetry you know what is arriving and what
  // it costs, and nothing about why it hurts.
  const EXTRA = {
    sql: (state, r) => [
      // the box's utilization is the worst of these two — show both, so a red
      // bar is attributable to the primary or to the replicas, not to a mystery
      ['primary', Fmt.pct(r.sql.primaryUtil) + ' of ' + Fmt.count(r.sql.cap) + ' units/s',
        verdict(r.sql.primaryUtil, 'util')],
      ['replicas', r.sql.replicas > 0
        ? Fmt.pct(r.sql.replicaUtil) + ' of ' + Fmt.count(r.sql.replicaCap) + ' units/s'
        : 'none', r.sql.replicas > 0 ? verdict(r.sql.replicaUtil, 'util') : 'good'],
      ['connections', Fmt.count(r.sql.connUsed) + ' / ' + Fmt.count(r.sql.connCap),
        verdict(r.sql.connUsed / Math.max(1, r.sql.connCap), 'conns')],
      ['shape', r.sql.shards + ' shards × ' + (1 + r.sql.replicas) + ' nodes, tier ' + state.infra.tier, 'good'],
      ['lookups', state.infra.kvEngine ? 'moved to the key-value store' : 'on the relational engine',
        state.infra.kvEngine ? 'good' : 'warn'],
      ['write replay', Fmt.pct(r.sql.replayFrac) + ' of replica capacity',
        r.sql.replayFrac > 0.4 ? 'warn' : 'good'],
      ['stale reads', Fmt.pct1(r.sql.staleFrac), verdict(r.sql.staleFrac, 'staleReads')],
      ['backlog', Fmt.count(r.backlog) + ' units', r.backlog > 1 ? 'warn' : 'good'],
    ],
    derived: (state, r) => [
      ['inverted index', state.infra.searchEngine ? 'on' : 'off',
        state.infra.searchEngine ? 'good' : 'warn'],
      ['columnar copy', state.infra.olapEngine ? 'on' : 'off',
        state.infra.olapEngine ? 'good' : 'warn'],
      ['vector index', state.infra.vectorEngine ? 'on' : 'off',
        state.infra.vectorEngine ? 'good' : 'warn'],
      ['fed by', state.infra.cdc ? 'change data capture' : 'bespoke pipelines',
        state.infra.cdc ? 'good' : 'warn'],
    ],
    cache: (state, r) => [
      ['hit rate', Fmt.pct(r.hits.cache) + ' (ceiling ' + Fmt.pct(state.repetition * Content.SIM.CACHE_HIT_MAX) + ')',
        verdict(r.hits.cache, 'hitRate')],
    ],
    kv: (state, r) => [
      ['scaling', 'partitions itself — capacity is not your problem', 'good'],
      ['billing', Fmt.dollars(r.costs.byKey.kvEngine.total) + '/s at $'
        + Content.SIM.KV_PER_KRPS + ' per 1k lookups', 'good'],
    ],
    edge: (state, r) => [
      ['static hit rate', Fmt.pct(r.hits.edgeStatic), verdict(r.hits.edgeStatic, 'hitRate')],
      ['bytes from edge', Fmt.pct(r.bytesPerS > 0 ? r.bytesEdge / r.bytesPerS : 0), 'good'],
    ],
    gpu: (state, r) => [
      ['serving', state.infra.gpuNodes > 0 ? 'self-hosted' : 'rented API (hard quota)',
        state.infra.gpuNodes > 0 ? 'good' : 'warn'],
      ['per request', '$' + (state.infra.gpuNodes === 0 ? Content.SIM.API_PER_REQ.toFixed(3)
        : (r.perClass.infer.served > 0 ? (r.costs.byKey.gpu.total / r.perClass.infer.served).toFixed(4) : '0')), 'good'],
    ],
    app: (state, r) => [
      ['fleet', Math.round(state.infra.appNodes) + ' running of ' + state.infra.appMax + ' allowed',
        state.infra.appNodes > 0.9 * state.infra.appMax ? 'warn' : 'good'],
    ],
  };

  // One unit of work ≈ one indexed point read. Requests are not equal — the
  // same tooltip everywhere, because "arriving req/s" and "capacity units/s"
  // sitting side by side with no bridge is how a display stops making sense.
  const UNIT_TIP = 'Work is measured in capacity units: an indexed read costs 1, '
    + 'a raw table scan 10, a report 60, a text scan 140. Requests differ, so '
    + 'the box fills on units of work, not on requests.';

  function probeRows(state, r, key) {
    const st = r.stations[key];
    const obs = state.infra.obs;
    const cost = r.costs.parts
      .filter(p => p.box === key)
      .reduce((sum, p) => sum + p.total, 0);
    const arriving = Content.CLASS_KEYS
      .filter(k => st.classRps[k] > 0.5)
      .sort((a, b) => st.classRps[b] - st.classRps[a])
      .map(k => [Content.CLASSES[k].label.toLowerCase(), Fmt.rate(st.classRps[k]), 'good']);
    const sections = [['TRAFFIC', [
      ['arriving', Fmt.rate(st.inRps), 'good',
        'Requests per second reaching this box, before any are refused.'],
      ...arriving,
    ]]];
    if (obs >= 1) {
      sections.push(['SATURATION', [
        ['work / capacity',
          Fmt.count(st.units + st.asyncUnits) + ' / ' + Fmt.count(st.cap) + ' units/s',
          verdict(st.util, 'util'), UNIT_TIP],
        ['utilization', Fmt.pct(st.util), verdict(st.util, 'util'),
          key === 'sql'
            ? 'The worst of primary and replica utilization — see the rows below.'
            : 'work ÷ capacity. Every hop multiplies its latency by 1 ÷ (1 − utilization).'],
        ['nodes', String(Fmt.count(st.nodes)), verdict(st.nodes, 'redundancy')],
        ...((EXTRA[key] ? EXTRA[key](state, r) : [])),
      ]]);
      sections.push(['ERRORS', [
        ['dropped here', Fmt.rate(r.fails[key] || 0), (r.fails[key] || 0) > 1 ? 'bad' : 'good'],
      ]]);
    }
    if (obs >= 2) {
      // service time is per class here, because one box can be doing three very
      // different jobs — a search and a report are not the same request
      const rows = Content.CLASS_KEYS
        .filter(k => st.classRps[k] > 0.5)
        .sort((a, b) => st.classRps[b] - st.classRps[a])
        .map(k => [Content.CLASSES[k].label.toLowerCase(),
          Fmt.ms(st.classMs[k]) + ' + queue → '
          + Fmt.ms(st.classMs[k] / (1 - Math.min(0.98, st.classUtil[k]))),
          st.classUtil[k] > Content.BANDS.util.warn ? 'warn' : 'good']);
      sections.push(['LATENCY', rows.length ? rows
        : [['service time', Fmt.ms(st.serviceMs), 'good']]]);
    }
    sections.push(['COST', [['run-rate', Fmt.dollars(cost) + '/s', 'good']]]);
    return sections;
  }

  function drawProbe(state) {
    const panel = $('probe');
    if (!hover || !state.report) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const def = Content.STATIONS[hover];
    panel.innerHTML = '';
    panel.appendChild(el('h4', null, def.name));
    panel.appendChild(el('div', 'p-desc', def.desc));
    for (const [title, rows] of probeRows(state, state.report, hover)) {
      panel.appendChild(el('div', 'p-sec', title));
      for (const [label, value, level, tip] of rows) {
        const row = el('div', 'p-row');
        if (tip) row.title = tip;
        row.appendChild(el('span', null, label));
        row.appendChild(el('span', level, value));
        panel.appendChild(row);
      }
    }
    if (state.infra.obs < 2) {
      panel.appendChild(el('div', 'p-blind', state.infra.obs === 0
        ? 'No telemetry. You can see what arrives and what it bills — nothing about why it hurts.'
        : 'Metrics only. Distributed tracing would show where the milliseconds go.'));
    }
    const stage = $('stage').getBoundingClientRect();
    panel.style.left = Math.min(pointer.x + 16, stage.width - 316) + 'px';
    panel.style.top = Math.min(pointer.y + 12, Math.max(8, stage.height - panel.offsetHeight - 8)) + 'px';
  }

  // ---- the shop -----------------------------------------------------------
  // The catalogue never changes, so the shop is built once and then updated in
  // place. Rebuilding the list on a timer scrolls it out from under the pointer
  // and — worse — a button destroyed between mousedown and mouseup never fires
  // a click at all, so buying silently does nothing.
  let rows = null;      // item key → { node, buy, less, sub }
  let heads = null;     // box key  → the "n% busy" span in its group header

  function buildRow(item) {
    const node = el('div', 'item');

    const name = el('div', 'item-name');
    const swatch = el('span', 'swatch');
    swatch.style.background = item.color;
    name.appendChild(swatch);
    name.appendChild(document.createTextNode(item.name));
    node.appendChild(name);

    const buys = el('div', 'item-buys');
    const buy = el('button', 'item-buy');
    buy.addEventListener('click', () => onBuy(item.key));
    buys.appendChild(buy);
    const less = el('button', 'item-less', '−');
    less.title = item.scaleDownLabel + '\n\nNothing is refunded. What stops is the run-rate.';
    less.addEventListener('click', () => onScaleDown(item.key));
    buys.appendChild(less);
    node.appendChild(buys);

    const sub = el('div', 'item-sub');
    node.appendChild(sub);

    rows[item.key] = { node, buy, less, sub };
    return node;
  }

  function buildShop() {
    const list = $('shop-items');
    list.innerHTML = '';
    rows = {};
    heads = {};
    for (const box of Content.BOXES) {
      const head = el('div', 'group-head');
      head.appendChild(el('span', null, box.name));
      heads[box.key] = head.appendChild(el('span', 'g-owned'));
      list.appendChild(head);
      for (const item of Content.SHOP) {
        if (item.box === box.key) list.appendChild(buildRow(item));
      }
    }
  }

  function syncRow(state, item) {
    const row = rows[item.key];
    const price = item.price(state);
    const owned = item.ownedLabel(state);
    const affordable = price !== null && state.cash >= price;

    row.node.classList.toggle('locked', price === null && !owned);
    row.buy.textContent = price === null ? (owned ? 'maxed' : 'n/a') : Fmt.money(price);
    row.buy.disabled = !affordable;
    row.buy.classList.toggle('can', affordable);
    row.buy.title = price === null ? item.blurb
      : item.blurb + '\n\nTRADE-OFF: ' + item.tradeoff
        + '\n\nRun-rate after this: ' + Fmt.dollars(Engine.expensesIfBought(state, item.key)) + '/s'
        + (state.report ? ' against ' + Fmt.dollars(state.report.income) + '/s of revenue' : '');
    row.less.classList.toggle('hidden', !item.canScaleDown(state));

    const costs = state.report ? state.report.costs.byKey[item.key] : null;
    row.sub.textContent = owned
      ? owned + (costs && costs.total > 0 ? '  ·  ' + Fmt.dollars(costs.total) + '/s' : '')
      : item.blurb;
  }

  function drawShop(state) {
    if (!rows) buildShop();
    for (const item of Content.SHOP) syncRow(state, item);
    for (const box of Content.BOXES) {
      const station = state.report && state.report.stations[box.key];
      heads[box.key].textContent = station && station.owned
        ? Fmt.pct(station.util) + ' busy' : '';
    }
    const r = state.report;
    $('stat-income').textContent = r
      ? 'revenue ' + Fmt.dollars(r.income) + '/s · spend ' + Fmt.dollars(r.spend) + '/s' : '';
  }

  // ---- money --------------------------------------------------------------
  function drawMoney(state) {
    const r = state.report;
    if (!r) return;
    const parts = r.costs.parts.filter(p => p.total > 0).sort((a, b) => b.total - a.total);
    const scale = Math.max(r.spend, r.income) * 1.06;
    const track = $('money-segments');
    track.innerHTML = '';
    for (const p of parts) {
      const seg = el('div');
      seg.style.width = (100 * p.total / scale) + '%';
      seg.style.background = p.color;
      seg.title = p.name + ' — ' + Fmt.dollars(p.total) + '/s\n'
        + (p.fixed > 0 ? 'fixed ' + Fmt.dollars(p.fixed) + '/s: ' + p.fixedNote + '\n' : '')
        + (p.marginal > 0 ? 'per node ' + Fmt.dollars(p.marginal) + '/s' : '');
      track.appendChild(seg);
    }
    const marker = $('money-marker');
    marker.style.left = (100 * r.income / scale) + '%';
    marker.title = 'revenue ' + Fmt.dollars(r.income) + '/s — profitable while the spend segments stay left of this line';
    const net = r.income - r.spend;
    const label = $('money-net');
    label.textContent = net >= 0
      ? '+' + Fmt.dollars(net) + '/s'
      : Fmt.dollars(net) + '/s · runway ' + Fmt.dur(Math.max(0, r.runway));
    label.className = net >= 0 ? 'good' : (r.runway < 60 ? 'bad' : 'warn');
  }

  // ---- charts -------------------------------------------------------------
  function drawChart(id, state, spec) {
    const canvas = $(id);
    const rect = canvas.getBoundingClientRect();
    // only on an actual resize — assigning width/height reallocates the backing
    // store and clears it, which at sixty frames a second is pure waste
    if (canvas.width !== Math.round(rect.width * devicePixelRatio)
        || canvas.height !== Math.round(rect.height * devicePixelRatio)) {
      canvas.width = Math.round(rect.width * devicePixelRatio);
      canvas.height = Math.round(rect.height * devicePixelRatio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const hist = state.history;
    const pad = 16;
    let peak = spec.floor;
    for (const point of hist) for (const s of spec.series) peak = Math.max(peak, s.of(point));
    // A target far above today's traffic must not pin the scale — that crushes
    // every line into the baseline for most of the run. The target line joins
    // the chart once the data is within reach; until then it lives in the
    // header as a number.
    const markShown = spec.mark && spec.mark.at <= peak * 3;
    if (markShown) peak = Math.max(peak, spec.mark.at * 1.1);
    const px = i => pad + (w - pad - 4) * (i / Math.max(1, Math.max(hist.length - 1, 40)));
    const py = v => h - 14 - (h - 22) * Math.min(1, v / peak);

    if (markShown) {
      ctx.strokeStyle = '#3f4a5a';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad, py(spec.mark.at));
      ctx.lineTo(w - 4, py(spec.mark.at));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#4b5563';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(spec.mark.label, pad + 2, py(spec.mark.at) - 3);
    }
    for (const s of spec.series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      hist.forEach((point, i) => (i ? ctx.lineTo(px(i), py(s.of(point))) : ctx.moveTo(px(i), py(s.of(point)))));
      ctx.stroke();
    }
    ctx.fillStyle = '#4b5563';
    ctx.font = '9px ui-monospace, monospace';
    const title = spec.mark && !markShown
      ? spec.title + '  ·  ' + spec.mark.label + ' ' + spec.top(spec.mark.at)
      : spec.title;
    ctx.fillText(title, 4, 10);
    // each line named in its own color — a chart with anonymous lines is the
    // kind of display that "lines up weirdly and inexplicably"
    let lx = 4 + ctx.measureText(title).width + 10;
    for (const s of spec.series) {
      if (!s.label) continue;
      ctx.fillStyle = s.color;
      ctx.fillText(s.label, lx, 10);
      lx += ctx.measureText(s.label).width + 8;
    }
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'right';
    ctx.fillText(spec.top(peak), w - 4, 10);
    ctx.textAlign = 'left';
  }

  function drawCharts(state) {
    drawChart('chart-rps', state, {
      title: 'THROUGHPUT', floor: 10, top: Fmt.rate,
      mark: { at: state.slo.targetRps, label: 'target' },
      series: [
        { of: p => p.demand, color: '#3d4552', width: 1, label: 'demand' },
        { of: p => p.served, color: '#43d17a', width: 1.6, label: 'served' },
        { of: p => p.fail, color: '#f85149', width: 1.2, label: 'failed' },
      ],
    });
    drawChart('chart-lat', state, {
      title: 'LATENCY', floor: state.slo.p99Ms * 1.5, top: Fmt.ms,
      mark: { at: state.slo.p99Ms, label: 'p99 target' },
      series: [
        { of: p => p.p99, color: '#e3b341', width: 1.6, label: 'p99' },
        { of: p => p.p50, color: '#4ea3ff', width: 1.2, label: 'p50' },
      ],
    });
    drawChart('chart-cash', state, {
      title: 'MONEY', floor: 10, top: Fmt.money,
      mark: { at: state.slo.costCeiling, label: 'cost ceiling $/s' },
      series: [
        { of: p => p.income, color: '#43d17a', width: 1.6, label: 'revenue' },
        { of: p => p.spend, color: '#f0883e', width: 1.2, label: 'spend' },
      ],
    });
  }

  // ---- top bar and brief --------------------------------------------------
  function setStat(id, text, level) {
    const node = $(id);
    node.textContent = text;
    node.className = 'stat-value' + (level ? ' ' + level : '');
  }

  function drawStats(state) {
    const r = state.report;
    if (!r) return;
    setStat('stat-rps', Fmt.rate(r.servedRps));
    $('stat-rps-sub').textContent = 'of ' + Fmt.rate(state.slo.targetRps) + ' target';
    setStat('stat-err', Fmt.pct1(r.errRate), verdict(r.errRate, 'errRate'));
    setStat('stat-p99', Fmt.ms(r.p99), verdict(r.p99 / state.slo.p99Ms, 'latency'));
    $('stat-p99-sub').textContent = 'target ' + state.slo.p99Ms + 'ms';
    setStat('stat-budget', Fmt.pct(Math.min(1, state.budget.spentFrac)),
      verdict(state.budget.spentFrac, 'budget'));
    setStat('stat-users', Fmt.count(state.users));
    setStat('stat-rep', Math.round(state.reputation), verdict(state.reputation, 'reputation'));
    $('stat-rep-sub').textContent = r.growthPerS >= 0
      ? 'users ×2 / ' + Fmt.dur(Math.LN2 / Math.max(0.001, r.growthPerS))
      : 'leaving';
    setStat('stat-cash', Fmt.money(state.cash), state.cash < 500 ? 'bad' : null);
    const win = $('winbar');
    if (state.winTimer > 0) {
      win.textContent = 'HOLDING TARGET — ' + (Content.SIM.WIN_HOLD_S - state.winTimer).toFixed(0) + 's';
      win.className = 'stat-value good';
    } else {
      win.textContent = '';
    }
  }

  function drawBrief(state) {
    const s = Content.SCENARIOS[state.scenario];
    $('brief-name').textContent = s.icon + ' ' + s.name;
    const chips = $('brief-chips');
    if (chips.dataset.for !== state.scenario) {
      chips.dataset.for = state.scenario;
      chips.innerHTML = '';
      for (const [label, value, why] of sloChips(state)) {
        const chip = el('span', 'chip');
        chip.appendChild(document.createTextNode(label + ' '));
        chip.appendChild(el('b', null, value));
        chip.title = why;
        chips.appendChild(chip);
      }
    }
    const segs = $('mix-segments');
    if (segs.dataset.for === state.scenario) return;
    segs.dataset.for = state.scenario;
    segs.innerHTML = '';
    // writes lead the bar: the mutation share is the design-deciding number.
    // Display order only — CLASS_KEYS order feeds the mix jitter's rng draws.
    const mixOrder = ['write', 'read',
      ...Content.CLASS_KEYS.filter(k => k !== 'write' && k !== 'read')];
    for (const k of mixOrder) {
      if (state.mix[k] < 0.002) continue;
      const cls = Content.CLASSES[k];
      const seg = el('div');
      seg.style.width = (100 * state.mix[k]) + '%';
      seg.style.background = cls.color;
      seg.title = cls.label + ' — ' + Fmt.pct(state.mix[k]) + ' of requests\n\n' + cls.desc;
      segs.appendChild(seg);
    }
  }

  function sloChips(state) {
    const slo = state.slo;
    const nines = (1 - slo.availability) * 100;
    return [
      ['throughput', Fmt.rate(slo.targetRps), 'The rate this system has to carry. Hold it, inside everything else here, for 30 seconds.'],
      ['p99', slo.p99Ms + 'ms', 'The ninety-ninth percentile users were promised. A tail, not an average.'],
      ['availability', (100 * slo.availability).toFixed(2) + '%',
        'You are allowed to fail ' + nines.toFixed(2) + '% of requests. That allowance is your error budget, and it is spendable.'],
      ['cost', '$' + slo.costCeiling + '/s', 'What the business will sign off at target scale.'],
      ['consistency', slo.consistency,
        slo.consistency === 'strong'
          ? 'Some operations here must not be applied twice or read stale. Queues and replicas are decisions, not free wins.'
          : 'Eventual is acceptable. Cache, replicate and queue freely — just know where you did it.'],
      ['durability', slo.durable ? 'required' : 'best effort',
        slo.durable ? 'Uploaded objects must not be lost. That means real storage, not a row in a table.'
          : 'Nothing here is irreplaceable if a node dies.'],
    ];
  }

  // ---- guru ---------------------------------------------------------------
  // Same rule as the shop, for the same reason: this panel refreshes four times
  // a second, so the cards are only rebuilt when the advice itself changes.
  // Their text still updates every pass — the numbers in a diagnosis are live.
  let guruSig = null, guruCards = null;   // [{ why, act, buy }] in card order

  const signature = cards =>
    cards.map(c => c.headline + '|' + (c.buy || '') + '|' + (c.undo || '')).join('\n');

  function buildGuruCards(cards) {
    const holder = $('guru-cards');
    holder.innerHTML = '';
    guruCards = cards.map(card => {
      const node = el('div', 'guru-card');
      node.appendChild(el('div', 'guru-head2', card.headline));
      const why = node.appendChild(el('div', 'guru-why'));
      const act = node.appendChild(el('div', 'guru-act'));
      let buy = null;
      if (card.buy) {
        buy = node.appendChild(el('button'));
        buy.addEventListener('click', () => onBuy(card.buy));
      }
      if (card.undo) {
        const btn = node.appendChild(
          el('button', null, 'scale down: ' + Content.SHOP_BY_KEY[card.undo].name));
        btn.addEventListener('click', () => onScaleDown(card.undo));
      }
      holder.appendChild(node);
      return { why, act, buy };
    });
  }

  function syncGuruCards(state, cards) {
    cards.forEach((card, i) => {
      const node = guruCards[i];
      node.why.textContent = card.why;
      node.act.textContent = card.action;
      if (!node.buy) return;
      const item = Content.SHOP_BY_KEY[card.buy];
      const price = item.price(state);
      node.buy.textContent = price === null ? item.name : item.name + ' — ' + Fmt.money(price);
      node.buy.disabled = price === null || state.cash < price;
      node.buy.title = !card.affordable && !node.buy.disabled
        ? 'You can pay for it. Carrying its run-rate is the other question.' : '';
    });
  }

  function drawGuru(state) {
    if (!guruOpen || !state.report) return;
    const { cards, load } = Guru.advise(state);
    const bar = $('guru-load');
    bar.innerHTML = '';
    for (const part of load) {
      const seg = el('div');
      seg.style.width = (100 * part.frac) + '%';
      seg.style.background = part.color;
      seg.title = part.label + ' — ' + Fmt.pct(part.frac) + ' of database work';
      bar.appendChild(seg);
    }
    $('guru-loadkey').textContent = load.length
      ? 'database work: ' + load.map(p => p.label + ' ' + Fmt.pct(p.frac)).join('  ·  ')
      : 'nothing is reaching the database yet';
    const sig = signature(cards);
    if (sig !== guruSig) {
      guruSig = sig;
      buildGuruCards(cards);
    }
    syncGuruCards(state, cards);
  }

  // ---- modals -------------------------------------------------------------
  function showModal(which) {
    $('modal-backdrop').classList.remove('hidden');
    for (const id of ['intro', 'insight-card', 'drawer', 'endscreen', 'cheatsheet']) {
      $(id).classList.toggle('hidden', id !== which);
    }
  }

  function hideModal() { $('modal-backdrop').classList.add('hidden'); }

  function showIntro(state, onClose, onPick) {
    const s = Content.SCENARIOS[state.scenario];
    $('intro-title').textContent = s.icon + '  ' + s.name;
    $('intro-blurb').textContent = s.blurb;
    const reqs = $('brief-req');
    reqs.innerHTML = '';
    for (const line of s.functional) reqs.appendChild(el('li', null, line));
    const nfr = $('brief-nfr');
    nfr.innerHTML = '';
    for (const [label, value, why] of sloChips(state)) {
      const chip = el('span', 'chip');
      chip.appendChild(document.createTextNode(label + ' '));
      chip.appendChild(el('b', null, value));
      chip.title = why;
      nfr.appendChild(chip);
    }
    // The brief is a choice until traffic exists. Once you are live you run
    // what you took — rereading it mid-run offers no exits.
    const pickable = !state.live && !!onPick;
    $('intro-pick-head').classList.toggle('hidden', !pickable);
    const pick = $('intro-pick');
    pick.classList.toggle('hidden', !pickable);
    pick.innerHTML = '';
    if (pickable) {
      for (const key of Content.SCENARIO_KEYS) {
        const def = Content.SCENARIOS[key];
        const btn = el('button', key === state.scenario ? 'sel' : null,
          def.icon + ' ' + def.name);
        btn.title = def.blurb;
        btn.addEventListener('click', () => {
          if (key !== state.scenario) onPick(key);
          showIntro(state, onClose, onPick);
        });
        pick.appendChild(btn);
      }
    }
    showModal('intro');
    $('intro-cheat').onclick = () => showCheat(state, () => showIntro(state, onClose, onPick));
    $('intro-ok').onclick = () => { hideModal(); onClose(); };
  }

  // The cheatsheet: every brief, and the components its mix implies — read from
  // the same table the closing review grades against, so studying it and being
  // graded by it are the same lesson.
  function showCheat(state, onClose) {
    const list = $('cheat-list');
    list.innerHTML = '';
    for (const key of Content.SCENARIO_KEYS) {
      const def = Content.SCENARIOS[key];
      const row = el('div', 'cheat-row' + (key === state.scenario ? ' now' : ''));
      const name = el('div', 'cheat-name', def.icon + ' ' + def.name);
      if (key === state.scenario) name.appendChild(el('span', 'cheat-you', '— your brief'));
      row.appendChild(name);
      const chips = el('div', 'cheat-chips');
      for (const e of Content.expectedFor(key)) {
        const chip = el('span', 'chip', Content.SHOP_BY_KEY[e.item].name);
        chip.title = e.need;
        chips.appendChild(chip);
      }
      row.appendChild(chips);
      row.appendChild(el('div', 'cheat-shape', def.winShape));
      list.appendChild(row);
    }
    showModal('cheatsheet');
    $('cheat-close').onclick = () => { hideModal(); onClose(); };
  }

  function showInsight(key, onClose) {
    const ins = Content.INSIGHTS[key];
    $('card-title').textContent = ins.title;
    $('card-text').textContent = ins.text;
    showModal('insight-card');
    $('card-ok').onclick = () => { hideModal(); onClose(); };
  }

  function showDrawer(state, onClose) {
    const list = $('drawer-list');
    list.innerHTML = '';
    const keys = Content.INSIGHT_KEYS.filter(k => state.insights[k]);
    if (!keys.length) {
      list.appendChild(el('p', 'card-text',
        'Nothing yet. Notes get written when something goes wrong, or when you fix it.'));
    }
    for (const key of keys) {
      const ins = Content.INSIGHTS[key];
      const node = el('div', 'ins');
      node.appendChild(el('h5', null, ins.title));
      node.appendChild(el('p', null, ins.text));
      list.appendChild(node);
    }
    showModal('drawer');
    $('drawer-close').onclick = () => { hideModal(); onClose(); };
  }

  // The scorecard. This is the whole point: a run that went well should read as
  // a system design answer that went well, line by line, with the reason.
  function showEnd(state, onRestart) {
    const card = Score.card(state);
    const won = state.outcome === 'won';
    $('end-kicker').textContent = won ? 'ARCHITECTURE REVIEW' : 'POST-MORTEM';
    $('end-title').textContent = won
      ? 'You held ' + Fmt.rate(state.slo.targetRps) + ' inside the brief.'
      : lossTitle(state);
    $('end-lead').textContent = won ? '' : lossDetail(state);
    $('overall').textContent = card.letter;
    $('overall').className = card.overall >= 0.7 ? 'good' : (card.overall >= 0.45 ? 'warn' : 'bad');
    $('verdict').textContent = card.verdict;

    // The brief, line by line: every promise the intro named, checked off or
    // not, each with the measured reason. The rubric below grades the work;
    // this answers the simpler question first — did it do what it said?
    const reqs = $('end-reqs');
    reqs.innerHTML = '';
    reqs.appendChild(el('div', 'card-kicker', 'THE BRIEF, LINE BY LINE'));
    for (const r of Score.requirements(state)) {
      const row = el('div', 'req');
      row.appendChild(el('span', 'req-mark ' + (r.met ? 'good' : 'bad'), r.met ? '✓' : '✗'));
      const label = el('span', 'req-label', r.label + ' ');
      label.appendChild(el('b', null, r.target));
      row.appendChild(label);
      row.appendChild(el('span', 'req-why', r.why));
      reqs.appendChild(row);
    }

    // ...and the subsystems that shape implied, against the board you drew.
    const MARK = { met: ['✓', 'good'], missed: ['✗', 'bad'], overbuilt: ['~', 'warn'] };
    const subs = $('end-subs');
    subs.innerHTML = '';
    subs.appendChild(el('div', 'card-kicker', 'THE SUBSYSTEMS IT EXPECTED'));
    for (const r of Score.subsystems(state)) {
      const [mark, tone] = MARK[r.status];
      const row = el('div', 'req');
      row.appendChild(el('span', 'req-mark ' + tone, mark));
      row.appendChild(el('span', 'req-label', r.label));
      row.appendChild(el('span', 'req-why', r.why));
      subs.appendChild(row);
    }

    // What the workload was always going to need. Naming it at the end is the
    // single most useful sentence in the whole run — it is the answer the board
    // was a four-hundred-second way of asking.
    const wanted = $('wanted');
    wanted.innerHTML = '';
    wanted.appendChild(el('div', 'card-kicker', 'WHAT THIS WORKLOAD WANTED'));
    wanted.appendChild(el('div', 'card-text', Content.SCENARIOS[state.scenario].winShape));

    const table = $('scorecard');
    table.innerHTML = '';
    for (const line of card.lines) {
      const row = table.insertRow();
      const grade = row.insertCell();
      grade.className = 'sc-grade ' + (line.score >= 0.7 ? 'good' : (line.score >= 0.45 ? 'warn' : 'bad'));
      grade.textContent = line.letter;
      const name = row.insertCell();
      name.className = 'sc-name';
      name.appendChild(el('div', null, line.name));
      name.appendChild(el('div', 'sc-what', line.what));
      const note = row.insertCell();
      note.className = 'sc-note';
      note.textContent = line.note;
    }
    const insights = $('end-insights');
    insights.innerHTML = '';
    insights.appendChild(el('div', 'card-kicker',
      'FIELD NOTES — ' + card.run.insightCount + ' of ' + Content.INSIGHT_KEYS.length
      + ' · what this system taught you, in the words you would use to explain it'));
    for (const key of Content.INSIGHT_KEYS.filter(k => state.insights[k])) {
      const ins = Content.INSIGHTS[key];
      const node = el('div', 'ins');
      node.appendChild(el('h5', null, ins.title));
      node.appendChild(el('p', null, ins.text));
      insights.appendChild(node);
    }
    showModal('endscreen');
    $('btn-restart').onclick = onRestart;
  }

  const LOSS_TITLE = {
    bankrupt: 'You ran out of money before you ran out of traffic.',
    timeout: 'Everything queued, everything timed out, everyone left.',
    shed: 'You shed more load than you served.',
    sql: 'The database was the wall, and you hit it.',
    gpu: 'Inference capacity never caught up with demand.',
    app: 'The app servers could not keep up.',
    derived: 'The read models could not keep up.',
    stream: 'The queue backed up and never drained.',
  };

  function lossTitle(state) {
    return LOSS_TITLE[state.deathCause] || 'The users left faster than you could fix it.';
  }

  function lossDetail(state) {
    const totals = Engine.failReasonTotals(state);
    const worst = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .filter(([, v]) => v > 0)
      .map(([reason]) => reason);
    const peak = 'Peak served ' + Fmt.rate(state.peakServed)
      + ' of a ' + Fmt.rate(state.slo.targetRps) + ' target.';
    return worst.length
      ? peak + ' In the last fifteen seconds, requests were failing at: ' + worst.join(', ') + '.'
      : peak;
  }

  // ---- toasts & memos -----------------------------------------------------
  function toast(key) {
    const def = Content.EVENTS[key];
    const node = el('div', 'toast');
    node.appendChild(el('b', null, def.icon + '  ' + def.name));
    node.appendChild(el('div', null, def.blurb));
    $('toasts').appendChild(node);
    setTimeout(() => node.remove(), 5200);
  }

  function memo(m) {
    const holder = $('memos');
    const node = el('div', 'memo');
    node.appendChild(el('div', 'm-from', m.from.toUpperCase() + ', ' + m.title));
    node.appendChild(el('div', 'm-subj', m.subject));
    node.appendChild(el('div', 'm-body', m.body));
    holder.appendChild(node);
    while (holder.children.length > 3) holder.firstChild.remove();
    setTimeout(() => node.remove(), 11000);
  }

  function clearMemos() { $('memos').innerHTML = ''; }


  // ---- go live ------------------------------------------------------------
  // Before launch there is no clock and no traffic — just a design, and the
  // run-rate it already implies. The button is disabled until there is
  // somewhere to run code and somewhere to keep data, because those two are
  // not judgement calls.
  function drawLaunch(state) {
    const panel = $('launch');
    if (state.live) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const missing = Engine.launchBlockers(state);
    const btn = $('btn-golive');
    btn.disabled = missing.length > 0;
    $('launch-note').textContent = missing.length
      ? 'You still need ' + missing.join(' and ') + '.'
      : 'Costing ' + Fmt.dollars(state.report.spend) + '/s before a single request arrives.';
  }

  // ---- wiring -------------------------------------------------------------
  function init(buyFn, scaleDownFn) {
    onBuy = buyFn;
    onScaleDown = scaleDownFn;
    const canvas = $('scene');
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      hover = onBoard(lastState).find(key => {
        const b = boxes[key];
        return b && pointer.x >= b.x && pointer.x <= b.x + b.w
          && pointer.y >= b.y && pointer.y <= b.y + b.h;
      }) || null;
    });
    canvas.addEventListener('mouseleave', () => { hover = null; });
  }

  function toggleGuru(state) {
    guruOpen = !guruOpen;
    $('guru-panel').classList.toggle('hidden', !guruOpen);
    if (guruOpen) drawGuru(state);
  }

  function closeGuru() {
    guruOpen = false;
    $('guru-panel').classList.add('hidden');
  }

  function render(state, dtFrame, running) {
    lastState = state;
    if (running) dash = (dash + dtFrame * 90) % 500;
    drawLaunch(state);
    drawStats(state);
    drawBrief(state);
    drawScene(state);
    drawProbe(state);
    drawMoney(state);
    drawCharts(state);
    shopAcc += dtFrame;
    if (shopAcc > 0.2) { shopAcc = 0; drawShop(state); }
    guruAcc += dtFrame;
    if (guruAcc > 0.25) { guruAcc = 0; drawGuru(state); }
  }

  return {
    init, render, showModal, hideModal, showIntro, showInsight, showDrawer,
    showCheat, showEnd, toast, memo, clearMemos, toggleGuru, closeGuru,
  };
})();

if (typeof module !== 'undefined') module.exports = UI;
