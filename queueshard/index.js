// UI controller: Z3 lifecycle, stage tabs, solve chain, result panel,
// workloads panel, and shard-map state.

import { Z3_WASM_URL, MAX_SHARDS, SOLVE_TIMEOUT_MS, LATENCY_CLASSES } from './config.js';
import { SCENARIOS, STAGES, PROVENANCE, DB_PROVENANCE } from './jobs.js';
import { buildAggregates, POLICY_GROUPS } from './model.js';
import { solveStage } from './solve.js';
import { renderShardMap, renderDbBars, renderLegend, LATENCY_COLORS } from './viz.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('z3Status');
const resolveBtn = $('resolveBtn');
const stageNav = $('stageNav');
const narrationEl = $('narration');
const queueListEl = $('queueList');
const policyListEl = $('policyList');
const scenarioSelectEl = $('scenarioSelect');
const shardMapEl = $('shardMap');
const dbBarsEl = $('dbBars');
const queueDetailEl = $('queueDetail');
const resultPanelEl = $('resultPanel');

const AGG = { base: buildAggregates(false), full: buildAggregates(true) };
const aggForStage = (stage) => stage.includeHeldOut ? AGG.full : AGG.base;

// Stage 3 is the infeasibility stage; its dataset entry carries the
// suggested relaxation.
const STAGE3 = STAGES.find(s => s.id === 3);

const state = {
  Context: null,
  stageId: 1,
  scenario: 'qclose',
  selectedQueue: null,
  highlightQueues: null,
  results: new Map(),   // stageId → verdict (or { status: 'error', ... })
  relaxed: null,        // verdict after applying stage 3's relaxation
  solving: false,
};

const currentStage = () => STAGES.find(s => s.id === state.stageId);
const currentAgg = () => aggForStage(currentStage());
const currentVerdict = () => (state.stageId === 3 && state.relaxed !== null)
  ? state.relaxed
  : state.results.get(state.stageId);

// The layout on display: the current stage's certified layout, or — when
// the current outcome is infeasible/unknown/error — the last certified one.
const displayed = () => {
  const verdict = currentVerdict();
  if (verdict?.status === 'sat') return { layout: verdict.layout, moves: verdict.moves };
  for (let id = state.stageId - 1; id >= 1; id--) {
    const prior = state.results.get(id);
    if (prior?.status === 'sat') return { layout: prior.layout, moves: [] };
  }
  return { layout: null, moves: [] };
};

const displayCap = () => (state.stageId === 3 && state.relaxed !== null)
  ? STAGE3.relaxation.shardCap
  : currentStage().shardCap;

// ── Z3 lifecycle ───────────────────────────────────────────────────────

const setStatus = (text, cls) => {
  statusEl.textContent = text;
  statusEl.className = `z3-status ${cls}`;
};

const initZ3 = async () => {
  setStatus('Loading Z3…', '');
  try {
    if (typeof globalThis.MiasZ3?.init !== 'function') {
      throw new Error('vendor/z3-bundle.js did not load (MiasZ3 global missing)');
    }
    const bundleUrl = new URL('./vendor/z3-bundle.js', document.baseURI).href;
    const { Context } = await globalThis.MiasZ3.init({
      locateFile: (path) => path.endsWith('.wasm') ? Z3_WASM_URL : path,
      // Pthread workers re-load the bundle from this URL; the IIFE re-executes
      // and z3-built.js self-detects pthread mode via self.name.
      mainScriptUrlOrBlob: bundleUrl,
    });
    state.Context = Context;
    setStatus('Z3 ready', 'ready');
    await showStage(1);
  } catch (e) {
    setStatus('Z3 failed to load', 'failed');
    resultPanelEl.innerHTML = `<div class="result-error">Z3 initialization failed: ${e.message}.
      Check that vendor/z3-bundle.js is present and that ${Z3_WASM_URL} is reachable.</div>`;
  }
};

// ── Solve chain ────────────────────────────────────────────────────────

const optionsFor = (stage, baseline) => ({
  shardCap: stage.shardCap,
  strictTenantIsolation: stage.strictTenantIsolation,
  baseline,
});

const runSolve = async (agg, options) => {
  state.solving = true;
  setStatus('Solving…', '');
  render();
  try {
    return await solveStage(state.Context, agg, options);
  } catch (e) {
    return { status: 'error', error: e.message, layout: null, moves: [], core: null, solveMs: 0 };
  } finally {
    state.solving = false;
    setStatus('Z3 ready', 'ready');
  }
};

// Stages build on each other: 2 needs 1's layout as baseline, 3 needs 2's.
const ensureSolved = async (stageId) => {
  for (const stage of STAGES) {
    if (stage.id > stageId) break;
    if (state.results.has(stage.id)) continue;
    let baseline = null;
    if (stage.useBaseline) {
      const prior = state.results.get(stage.id - 1);
      if (prior?.status !== 'sat') return; // upstream failed; its verdict shows
      baseline = prior.layout;
    }
    const verdict = await runSolve(aggForStage(stage), optionsFor(stage, baseline));
    state.results.set(stage.id, verdict);
    render();
  }
};

const showStage = async (stageId) => {
  state.stageId = stageId;
  state.selectedQueue = null;
  state.highlightQueues = null;
  render();
  if (state.Context !== null && !state.solving) await ensureSolved(stageId);
  render();
};

const applyRelaxation = async () => {
  const relaxation = STAGE3.relaxation;
  const baselineVerdict = state.results.get(2);
  if (baselineVerdict?.status !== 'sat') return;
  state.relaxed = await runSolve(AGG.full, {
    shardCap: relaxation.shardCap,
    strictTenantIsolation: true,
    baseline: baselineVerdict.layout,
  });
  render();
};

const handleResolve = async () => {
  for (const stage of STAGES) {
    if (stage.id >= state.stageId) state.results.delete(stage.id);
  }
  state.relaxed = null;
  await showStage(state.stageId);
};

// ── Workloads panel ────────────────────────────────────────────────────

const expandedQueues = new Set();

const renderQueueList = () => {
  queueListEl.replaceChildren();
  for (const q of currentAgg().queues) {
    const row = document.createElement('div');
    row.className = `queue-row${state.selectedQueue === q.id ? ' selected' : ''}`;
    const head = document.createElement('div');
    head.className = 'queue-row-head';
    head.innerHTML = `
      <span class="class-dot" style="background:${LATENCY_COLORS[q.latencyClass].fill}"></span>
      <span class="queue-row-name">${q.label}</span>
      <span class="queue-row-meta">${q.latencyClass} · ${q.jobs.length} class${q.jobs.length > 1 ? 'es' : ''}</span>`;
    const toggleQueueRow = () => {
      if (expandedQueues.has(q.id)) expandedQueues.delete(q.id); else expandedQueues.add(q.id);
      selectQueue(state.selectedQueue === q.id ? null : q.id);
    };
    head.addEventListener('click', toggleQueueRow);
    row.appendChild(head);
    if (expandedQueues.has(q.id)) {
      const list = document.createElement('div');
      list.className = 'job-list';
      for (const job of q.jobs) {
        const item = document.createElement('div');
        item.className = 'job-item';
        item.textContent = job.name;
        item.title = job.description;
        const selectJobQueue = (e) => {
          e.stopPropagation();
          selectQueue(q.id); // highlight this job's queue in the map
        };
        item.addEventListener('click', selectJobQueue);
        list.appendChild(item);
      }
      row.appendChild(list);
    }
    queueListEl.appendChild(row);
  }
};

const groupHighlight = (groupId) => {
  const agg = currentAgg();
  const sets = {
    'ordering-affinity': () => agg.queues.filter(q => q.affinityGroups.length > 0),
    'demotion-paths': () => agg.queues.filter(q => agg.demotionPairs.some(p => p.a === q.id || p.b === q.id)),
    'tenant-isolation': () => [...agg.noisyQueues, ...agg.protectedQueues],
    'latency-isolation': () => [...agg.urgentQueues, ...agg.batchQueues],
    'db-connections': () => agg.queues.filter(q => q.dbs.length > 0),
  };
  const pick = sets[groupId];
  return pick === undefined ? null : new Set(pick().map(q => q.id));
};

const sameQueueSet = (a, b) => a !== null && b !== null
  && a.size === b.size && [...a].every(id => b.has(id));

const renderPolicyList = () => {
  const core = currentVerdict()?.core ?? [];
  const describeOptions = {
    shardCap: displayCap(),
    strictTenantIsolation: currentStage().strictTenantIsolation,
  };
  policyListEl.replaceChildren();
  for (const group of POLICY_GROUPS) {
    const row = document.createElement('div');
    row.className = `policy-row${core.includes(group.id) ? ' conflict' : ''}`;
    row.innerHTML = `
      <div class="policy-row-head">${group.label}
        <span class="policy-active">${core.includes(group.id) ? 'in conflict' : 'active'}</span>
      </div>
      <div class="policy-desc">${group.describe(describeOptions)}</div>`;
    const togglePolicyHighlight = () => {
      const highlight = groupHighlight(group.id);
      state.highlightQueues = sameQueueSet(highlight, state.highlightQueues) ? null : highlight;
      render();
    };
    row.addEventListener('click', togglePolicyHighlight);
    policyListEl.appendChild(row);
  }
};

// ── Queue detail ───────────────────────────────────────────────────────

const provenanceLine = (kind, label) =>
  `<div class="provenance">${label}: ${PROVENANCE[kind].source} · ${PROVENANCE[kind].freshness} · ${PROVENANCE[kind].confidence}</div>`;

const constraintFamiliesFor = (q, agg) => {
  const families = ['Shard budget', 'Redis command capacity', 'Memory capacity', 'SLO feasibility'];
  if (q.latencyClass === 'urgent' || q.latencyClass === 'batch') families.push('Latency-class isolation');
  if (q.affinityGroups.length > 0) families.push('Ordering affinity');
  if (q.noisy || q.protected) families.push('Tenant isolation');
  if (agg.demotionPairs.some(p => p.a === q.id || p.b === q.id)) families.push('Demotion paths');
  if (q.dbs.length > 0) families.push('Database connection budget');
  return families;
};

const scenarioHeader = () => `<tr><th></th>${SCENARIOS.map(s => `<th>${s.label}</th>`).join('')}</tr>`;

const renderQueueDetail = () => {
  const agg = currentAgg();
  const q = state.selectedQueue === null ? null : agg.byId.get(state.selectedQueue);
  queueDetailEl.classList.toggle('hidden', q === null);
  if (q === null) return;

  const jobBlocks = q.jobs.map(job => `
    <div class="detail-job">
      <div class="detail-job-name">${job.name}</div>
      <div class="detail-job-desc">${job.description}</div>
      <table class="detail-table">
        ${scenarioHeader()}
        <tr><td>arrival j/s</td>${SCENARIOS.map(s => `<td>${job.arrivalRate[s.id]}</td>`).join('')}</tr>
        <tr><td>redis cmd/s</td>${SCENARIOS.map(s => `<td>${job.cmdLoad[s.id]}</td>`).join('')}</tr>
      </table>
      <div class="detail-job-desc">p99 ${job.p99Sec}s · payload ${job.payloadKB} KB · worst backlog ${job.backlogDepth.toLocaleString()}
        · db ${job.db ?? 'none'} · tenant ${job.tenant.profile}${job.tenant.noisy ? ' (noisy)' : ''}${job.tenant.protected ? ' (protected)' : ''}</div>
      ${job.slo ? `<div class="detail-job-desc">SLO: drain ${job.slo.burstBacklog}-job burst within ${job.slo.windowSec}s</div>` : ''}
    </div>`).join('');

  queueDetailEl.innerHTML = `
    <button class="detail-close" id="detailClose" title="Close">×</button>
    <div class="detail-title">
      <span class="class-dot" style="background:${LATENCY_COLORS[q.latencyClass].fill}"></span>
      ${q.label} <span class="queue-row-meta">${q.latencyClass}</span>
    </div>
    <div class="detail-desc">${q.description}</div>
    <table class="detail-table">
      ${scenarioHeader()}
      <tr><td>redis cmd/s</td>${SCENARIOS.map(s => `<td>${q.cmd[s.id]}</td>`).join('')}</tr>
      <tr><td>thread demand</td>${SCENARIOS.map(s => `<td>${q.demand[s.id]}</td>`).join('')}</tr>
    </table>
    <div class="detail-desc">worst-case backlog memory ${q.memoryMB} MB${q.dbs.length ? ` · databases: ${q.dbs.join(', ')}` : ''}</div>
    <div class="detail-section">member job classes</div>
    ${jobBlocks}
    <div class="detail-section">constraint families referencing this queue</div>
    ${constraintFamiliesFor(q, agg).map(f => `<div class="detail-constraint">· ${f}</div>`).join('')}
    <div class="detail-section">parameter provenance</div>
    ${provenanceLine('arrivalRate', 'arrival rates')}
    ${provenanceLine('cmdLoad', 'redis command load')}
    ${provenanceLine('p99Sec', 'p99 service time')}
    ${provenanceLine('payloadKB', 'payload size')}
    ${provenanceLine('backlogDepth', 'backlog depth')}
    ${q.jobs.some(j => j.slo) ? provenanceLine('slo', 'SLO & burst') : ''}
    <div class="provenance">db budgets: ${DB_PROVENANCE.source} · ${DB_PROVENANCE.freshness}</div>`;
  $('detailClose').addEventListener('click', clearSelection);
};

const selectQueue = (qid) => {
  state.selectedQueue = qid;
  state.highlightQueues = null;
  render();
};

const clearSelection = () => selectQueue(null);

// ── Result panel ───────────────────────────────────────────────────────

const queueLabel = (qid) => currentAgg().byId.get(qid)?.label ?? qid;

const moveSentence = (m) => {
  if (m.kind === 'place') return `Place new queue <strong>${queueLabel(m.queue)}</strong> on shard ${m.to}.`;
  if (m.kind === 'move') return `Move <strong>${queueLabel(m.queue)}</strong> from shard ${m.from} to shard ${m.to} — a drain-and-cutover.`;
  if (m.kind === 'attach') return `<span class="move-minor">Attach a ${m.cls} worker pool on shard ${m.shard} (throttled ramp).</span>`;
  return `<span class="move-minor">Detach the ${m.cls} worker pool from shard ${m.shard}.</span>`;
};

const movesHtml = (moves) => {
  if (moves.length === 0) return '';
  const order = { place: 0, move: 1, attach: 2, detach: 3 };
  const sorted = [...moves].sort((a, b) => order[a.kind] - order[b.kind]);
  return `<ul class="move-list">${sorted.map(m => `<li>${moveSentence(m)}</li>`).join('')}</ul>`;
};

const verdictHead = (label, cls, solveMs) => `
  <div class="result-head">
    <span class="verdict-pill verdict-${cls}">${label}</span>
    <span class="solve-time">solved in ${Math.round(solveMs)} ms</span>
  </div>`;

const conflictHtml = (core) => {
  const groups = core.map(id => POLICY_GROUPS.find(g => g.id === id));
  const describeOptions = { shardCap: currentStage().shardCap, strictTenantIsolation: true };
  const names = groups.map(g => g.label);
  const summary = core.length === 3
    ? `${names.join(' + ')} — pick two.`
    : `${names.join(' + ')} — they cannot all hold.`;
  const relaxation = STAGE3.relaxation;
  const relaxRow = state.stageId === 3 ? `
      <div class="relax-row">
        <button class="btn" id="relaxBtn" ${state.solving ? 'disabled' : ''}>${relaxation.label}</button>
        <span class="relax-note">${relaxation.description}</span>
      </div>` : '';
  return `
    <div class="conflict-box">
      <div class="conflict-summary">${summary}</div>
      ${groups.map(g => `
        <div class="conflict-group">
          <div class="conflict-group-name">${g.label}</div>
          <div class="conflict-group-desc">${g.describe(describeOptions)}</div>
        </div>`).join('')}
      <div class="result-note">No shard layout satisfies these at once — proven, not suspected.
        The negotiation happens now, at planning time, instead of at quarter close.</div>
      ${relaxRow}
    </div>`;
};

const renderResultPanel = () => {
  if (state.solving) {
    resultPanelEl.innerHTML = `<div class="result-head"><span class="solve-time">Solving stage ${state.stageId}…</span></div>`;
    return;
  }
  const verdict = currentVerdict();
  if (verdict === undefined) {
    resultPanelEl.innerHTML = `<div class="result-head"><span class="solve-time">${state.Context === null ? 'Waiting for Z3…' : 'Not solved yet.'}</span></div>`;
    return;
  }

  if (verdict.status === 'error') {
    resultPanelEl.innerHTML = `<div class="result-error">Solver error: ${verdict.error}.
      The previous certified layout, if any, remains displayed.</div>`;
    return;
  }

  if (verdict.status === 'unknown') {
    resultPanelEl.innerHTML = verdictHead('UNKNOWN', 'unknown', verdict.solveMs) + `
      <div class="result-note">The solver hit its ${Math.round(SOLVE_TIMEOUT_MS / 1000)}s budget before finding an answer.
      This is a solver limitation — <strong>not</strong> a proof that no layout exists. INFEASIBLE and UNKNOWN are different findings.</div>`;
    return;
  }

  if (verdict.status === 'infeasible') {
    resultPanelEl.innerHTML = verdictHead('INFEASIBLE', 'infeasible', verdict.solveMs)
      + conflictHtml(verdict.core ?? []);
    const relaxBtn = $('relaxBtn');
    if (relaxBtn) relaxBtn.addEventListener('click', applyRelaxation);
    return;
  }

  // SAT
  const { layout } = verdict;
  const relaxedNote = (state.stageId === 3 && state.relaxed !== null)
    ? `<div class="result-note">Relaxation applied: shard cap raised to ${STAGE3.relaxation.shardCap}, strict tenant isolation kept. The re-solve closes the loop from infeasibility to a negotiated fix:</div>`
    : '';
  const summary = state.stageId === 1
    ? `<div class="result-note">Certified layout: <strong>${layout.shardsUsed} of ${MAX_SHARDS}</strong> candidate shards used —
       the minimize-shards objective leaves the rest empty. Every constraint checked under every scenario.
       This layout becomes the move-cost baseline for stage 2.</div>`
    : (verdict.moves.length > 0
      ? `<div class="result-note">Fewest-moves re-solve against the previous layout (${layout.shardsUsed} shards used):</div>`
      : `<div class="result-note">Re-solve required no moves (${layout.shardsUsed} shards used).</div>`);

  resultPanelEl.innerHTML = verdictHead('SAT', 'sat', verdict.solveMs)
    + relaxedNote + summary + movesHtml(verdict.moves);
};

// ── Top-level render ───────────────────────────────────────────────────

const renderStageNav = () => {
  stageNav.replaceChildren();
  for (const stage of STAGES) {
    const tab = document.createElement('button');
    tab.className = `stage-tab${stage.id === state.stageId ? ' active' : ''}`;
    tab.textContent = stage.label;
    tab.disabled = state.solving || state.Context === null;
    const openStage = () => showStage(stage.id);
    tab.addEventListener('click', openStage);
    stageNav.appendChild(tab);
  }
};

const renderScenarioSelect = () => {
  scenarioSelectEl.replaceChildren();
  for (const scenario of SCENARIOS) {
    const btn = document.createElement('button');
    btn.className = `scenario-btn${scenario.id === state.scenario ? ' active' : ''}`;
    btn.textContent = scenario.label;
    btn.title = scenario.description;
    const pickScenario = () => {
      state.scenario = scenario.id;
      render();
    };
    btn.addEventListener('click', pickScenario);
    scenarioSelectEl.appendChild(btn);
  }
};

const render = () => {
  renderStageNav();
  narrationEl.textContent = currentStage().narration;
  renderScenarioSelect();
  renderQueueList();
  renderPolicyList();

  const { layout, moves } = displayed();
  renderShardMap(shardMapEl, {
    agg: currentAgg(),
    layout,
    scenario: state.scenario,
    moves,
    selectedQueue: state.selectedQueue,
    highlightQueues: state.highlightQueues,
    shardCap: displayCap(),
    onSelectQueue: selectQueue,
  });
  renderDbBars(dbBarsEl, currentAgg(), layout);
  renderQueueDetail();
  renderResultPanel();

  resolveBtn.disabled = state.solving || state.Context === null;
};

resolveBtn.addEventListener('click', handleResolve);

renderLegend($('legend'));
render();
initZ3();
