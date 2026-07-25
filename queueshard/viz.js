// Shard-map rendering: hand-rolled SVG built by DOM construction from a
// plain layout object. Re-rendered whole on every state change.

import { MAX_SHARDS, SHARD_SPEC, FETCH_CMD_PER_THREAD, LATENCY_CLASSES } from './config.js';

// Latency-class palette, validated (dataviz six checks) against the dark
// slate surface #0f172a: all-pairs CVD ΔE ≥ 10.2, normal-vision ΔE ≥ 19.8,
// contrast ≥ 3:1. `text` is the on-fill label ink per swatch.
export const LATENCY_COLORS = {
  urgent:  { fill: '#c0396a', text: '#ffffff' },
  fast:    { fill: '#c98500', text: '#0b1120' },
  default: { fill: '#3987e5', text: '#ffffff' },
  batch:   { fill: '#1fae80', text: '#0b1120' },
};

const STATUS = { ok: '#34d399', warn: '#fab219', crit: '#d03b3b' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_W = 1164;
const VB_H = 402;
const SHARD_W = 176;
const SHARD_X = (s) => 6 + s * 194;
const STACK_Y = 38;
const PX_PER_CMD = 0.04;

const el = (tag, attrs) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

const text = (x, y, str, attrs) => {
  const node = el('text', { x, y, ...attrs });
  node.textContent = str;
  return node;
};

const title = (parent, str) => {
  const node = document.createElementNS(SVG_NS, 'title');
  node.textContent = str;
  parent.appendChild(node);
};

const kFmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const utilizationColor = (pct) => pct > 0.95 ? STATUS.crit : (pct > 0.85 ? STATUS.warn : STATUS.ok);

// One capacity bar: track, scenario fill, worst-case tick, % label.
const capacityBar = (g, x, y, label, pct, worstPct, tooltip) => {
  g.appendChild(text(x, y + 7, label, { class: 'svg-tiny', fill: '#64748b' }));
  const track = el('rect', { x: x + 36, y, width: 96, height: 8, rx: 2, fill: '#1e293b' });
  title(track, tooltip);
  g.appendChild(track);
  const w = Math.min(96, Math.round(96 * pct));
  if (w > 0) {
    g.appendChild(el('rect', {
      x: x + 36, y, width: w, height: 8, rx: 2,
      fill: utilizationColor(worstPct), 'fill-opacity': 0.9,
    }));
  }
  const tickX = x + 36 + Math.min(96, Math.round(96 * worstPct));
  g.appendChild(el('rect', { x: tickX - 1, y: y - 2, width: 2, height: 12, fill: '#e2e8f0' }));
  g.appendChild(text(x + 164, y + 7, `${Math.round(pct * 100)}%`, {
    class: 'svg-tiny', fill: utilizationColor(worstPct), 'text-anchor': 'end',
  }));
};

const badge = (g, x, y, letter, color, tooltip) => {
  const grp = el('g', { class: 'svg-badge' });
  grp.appendChild(el('circle', { cx: x, cy: y, r: 6, fill: 'rgba(2,6,23,0.75)', stroke: color, 'stroke-width': 1 }));
  grp.appendChild(text(x, y + 2.5, letter, {
    class: 'svg-badge-letter', fill: color, 'text-anchor': 'middle',
  }));
  title(grp, tooltip);
  g.appendChild(grp);
};

const queueTooltip = (q, scenario) => [
  `${q.label} (${q.latencyClass}) — ${q.description}`,
  `${scenario}: ${q.cmd[scenario]} cmd/s · demand ${q.demand[scenario]} threads · ${q.memoryMB} MB backlog`,
  `jobs: ${q.jobs.map(j => j.name).join(', ')}`,
].join('\n');

const queueBlock = (view, q, x, y, h) => {
  const { fill, text: ink } = LATENCY_COLORS[q.latencyClass];
  const move = view.moves.find(m => (m.kind === 'move' || m.kind === 'place') && m.queue === q.id);
  const selected = view.selectedQueue === q.id;
  const highlighted = view.highlightQueues !== null && view.highlightQueues.has(q.id);

  const g = el('g', { class: 'svg-queue' });
  const rect = el('rect', {
    x, y, width: SHARD_W - 16, height: h, rx: 3, fill,
    'fill-opacity': view.diffActive && !move && !selected && !highlighted ? 0.45 : 0.92,
  });
  if (selected || highlighted) {
    rect.setAttribute('stroke', '#e2e8f0');
    rect.setAttribute('stroke-width', 2);
  } else if (move) {
    rect.setAttribute('stroke', '#34d399');
    rect.setAttribute('stroke-width', 2);
    if (move.kind === 'place') rect.setAttribute('stroke-dasharray', '5 3');
  }
  title(rect, queueTooltip(q, view.scenario));
  g.appendChild(rect);

  const midY = y + h / 2 + 3.5;
  g.appendChild(text(x + 7, midY, q.label, { class: 'svg-label', fill: ink }));
  g.appendChild(text(x + SHARD_W - 24, midY, kFmt(q.cmd[view.scenario]), {
    class: 'svg-tiny', fill: ink, 'text-anchor': 'end', 'fill-opacity': 0.85,
  }));

  let bx = x + SHARD_W - 44;
  for (const group of q.affinityGroups) {
    badge(g, bx, y + h / 2, 'A', '#e2e8f0', `Ordering affinity: '${group}' — must share a shard with its group.`);
    bx -= 14;
  }
  if (view.demotionQueueIds.has(q.id)) {
    badge(g, bx, y + h / 2, 'D', '#e2e8f0', 'Demotion path — must share a shard with its demotion partner.');
    bx -= 14;
  }
  if (q.noisy) {
    badge(g, bx, y + h / 2, 'N', STATUS.warn, 'Noisy tenant workload — anti-affinity with protected workloads.');
  }

  if (move && move.kind === 'move') {
    g.appendChild(text(x + SHARD_W - 24, y - 3, `was shard ${move.from}`, {
      class: 'svg-tiny svg-move-tag', fill: '#34d399', 'text-anchor': 'end',
    }));
  }
  if (move && move.kind === 'place') {
    g.appendChild(text(x + SHARD_W - 24, y - 3, 'new', {
      class: 'svg-tiny svg-move-tag', fill: '#34d399', 'text-anchor': 'end',
    }));
  }

  const handleQueueClick = () => view.onSelectQueue(q.id);
  g.addEventListener('click', handleQueueClick);
  return g;
};

const shardGroup = (view, s) => {
  const x = SHARD_X(s);
  const g = el('g', {});
  const placed = view.layout === null ? [] : view.agg.queues
    .filter(q => view.layout.placements[q.id] === s)
    .sort((a, b) => LATENCY_CLASSES.findIndex(c => c.id === a.latencyClass)
      - LATENCY_CLASSES.findIndex(c => c.id === b.latencyClass)
      || b.cmd[view.scenario] - a.cmd[view.scenario]);
  const isUsed = placed.length > 0;
  const overCap = s >= view.shardCap;

  const box = el('rect', {
    x, y: 6, width: SHARD_W, height: 380, rx: 8,
    fill: isUsed ? 'rgba(30,41,59,0.35)' : 'none',
    stroke: isUsed ? '#1e293b' : '#334155',
    'stroke-width': 1,
    ...(isUsed ? {} : { 'stroke-dasharray': '6 4', 'stroke-opacity': 0.6 }),
  });
  g.appendChild(box);
  g.appendChild(text(x + 8, 24, `shard ${s}`, {
    class: 'svg-mono', fill: isUsed ? '#34d399' : '#475569',
  }));
  if (!isUsed) {
    const note = overCap ? 'over cap' : 'unused';
    g.appendChild(text(x + SHARD_W - 8, 24, note, {
      class: 'svg-tiny', fill: '#475569', 'text-anchor': 'end',
    }));
    if (view.layout !== null) return g;
    g.appendChild(text(x + SHARD_W / 2, 200, 'awaiting solve', {
      class: 'svg-tiny', fill: '#334155', 'text-anchor': 'middle',
    }));
    return g;
  }

  let y = STACK_Y;
  for (const q of placed) {
    const h = Math.max(16, Math.round(q.cmd[view.scenario] * PX_PER_CMD));
    g.appendChild(queueBlock(view, q, x + 8, y, h));
    y += h + 3;
  }

  // Pool chips.
  let chipX = x + 8;
  for (const cls of LATENCY_CLASSES) {
    const size = view.layout.pools[s][cls.id];
    if (size === 0) continue;
    const chip = el('g', { class: 'svg-chip' });
    const w = 38;
    chip.appendChild(el('rect', {
      x: chipX, y: 288, width: w, height: 16, rx: 8,
      fill: 'none', stroke: LATENCY_COLORS[cls.id].fill, 'stroke-width': 1.2,
    }));
    chip.appendChild(text(chipX + w / 2, 299, `${cls.id[0]}·${size}`, {
      class: 'svg-tiny', fill: '#e2e8f0', 'text-anchor': 'middle',
    }));
    title(chip, `${cls.id} worker pool: ${size} threads (processes × threads) attached to shard ${s}.`);
    g.appendChild(chip);
    chipX += w + 5;
  }

  // Capacity bars: fill follows the selected scenario; the tick and the
  // emphasis color mark the worst case across scenarios.
  const threads = LATENCY_CLASSES.reduce((acc, c) => acc + view.layout.pools[s][c.id], 0);
  const redisPct = (sc) =>
    (placed.reduce((acc, q) => acc + q.cmd[sc], 0) + threads * FETCH_CMD_PER_THREAD)
    / SHARD_SPEC.redisCmdCeiling;
  const worstRedis = Math.max(...view.agg.scenarioIds.map(redisPct));
  capacityBar(g, x + 8, 322, 'redis', redisPct(view.scenario), worstRedis,
    `Redis commands/sec vs ${SHARD_SPEC.redisCmdCeiling} ceiling. Fill: ${view.scenario}; tick: worst scenario.`);

  const memPct = placed.reduce((acc, q) => acc + q.memoryMB, 0) / SHARD_SPEC.memoryMB;
  capacityBar(g, x + 8, 348, 'mem', memPct, memPct,
    `Worst-case backlog memory vs ${SHARD_SPEC.memoryMB} MB instance memory.`);

  return g;
};

// view: { agg, layout, scenario, moves, selectedQueue, highlightQueues,
//         shardCap, onSelectQueue }
export const renderShardMap = (container, view) => {
  // Derived, map-wide facts appended to the caller's view.
  const demotionQueueIds = new Set(view.agg.demotionPairs.flatMap(p => [p.a, p.b]));
  const diffActive = view.moves.some(m => m.kind === 'move' || m.kind === 'place');
  const fullView = { ...view, demotionQueueIds, diffActive };
  const svg = el('svg', { viewBox: `0 0 ${VB_W} ${VB_H}`, class: 'shard-map-svg' });
  for (let s = 0; s < MAX_SHARDS; s++) svg.appendChild(shardGroup(fullView, s));
  container.replaceChildren(svg);
};

// Database connection budgets, aggregated across shards, as HTML bars.
export const renderDbBars = (container, agg, layout) => {
  container.replaceChildren();
  for (const db of agg.databases) {
    let usedConns = 0;
    if (layout !== null) {
      for (let s = 0; s < MAX_SHARDS; s++) {
        for (const cls of LATENCY_CLASSES) {
          const touching = agg.queues.some(q =>
            q.latencyClass === cls.id && q.dbs.includes(db.id) && layout.placements[q.id] === s);
          if (touching) usedConns += layout.pools[s][cls.id];
        }
      }
    }
    const pct = usedConns / db.maxConnections;
    const item = document.createElement('div');
    item.className = 'db-bar';
    item.title = `${db.label}: pools serving ${db.label}-touching queues hold ${usedConns} of ${db.maxConnections} budgeted connections.`;
    item.innerHTML = `
      <span class="db-bar-name">${db.label}</span>
      <span class="db-bar-track"><span class="db-bar-fill" style="width:${Math.min(100, Math.round(pct * 100))}%; background:${utilizationColor(pct)}"></span></span>
      <span class="db-bar-count">${usedConns}/${db.maxConnections}</span>`;
    container.appendChild(item);
  }
};

export const renderLegend = (container) => {
  container.replaceChildren();
  for (const cls of LATENCY_CLASSES) {
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.title = cls.sloText;
    item.innerHTML = `<span class="legend-swatch" style="background:${LATENCY_COLORS[cls.id].fill}"></span>${cls.label}`;
    container.appendChild(item);
  }
};
