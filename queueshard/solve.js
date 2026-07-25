// Solver orchestration. Two solvers over one compiled model:
//
//  - The DIAGNOSIS solver is symmetry-broken (canonical shard prefix) and
//    carries one assumption literal per policy group. It answers the
//    permutation-invariant questions fast: feasibility, the unsat core of
//    policy groups (shrunk toward a minimal set by deletion), and the
//    minimum shard count. Without symmetry breaking these UNSAT proofs
//    explore every relabeling of interchangeable shards and take tens of
//    seconds; with it, milliseconds.
//  - The OPTIMIZATION solver has no symmetry breaking when a baseline
//    exists, because the baseline pins concrete shard identities for move
//    counting. It runs the lexicographic tightening — cheapest moves
//    against the baseline, then balanced peak enqueue load — under the
//    shard count the diagnosis solver proved minimal. Its checks are
//    cheap: SAT searches, plus UNSAT proofs already pruned by the pinned
//    shard count and move bound.
//
// Pool sizes are then read off as the minimal values the SLO constraints
// admit for the chosen placement.
//
// Verdict object: { status: 'sat' | 'infeasible' | 'unknown',
//                   layout, moves, core, solveMs }

import {
  MAX_SHARDS, SHARD_SPEC, SOLVE_TIMEOUT_MS, LATENCY_CLASSES, MOVE_COST,
} from './config.js';
import { compileModel } from './model.js';

const classIds = LATENCY_CLASSES.map(c => c.id);

let solveCounter = 0;

const litTrue = (model, expr) => model.eval(expr, true).toString() === 'true';

// Minimal pools for a placement: per (shard, class), the largest scenario
// demand of the queues placed there. This is exactly the least solution
// the SLO constraints admit, and pools only appear with positive
// coefficients in capacity constraints, so it is always a valid one.
const minimalPools = (agg, placements) => {
  const pools = [];
  for (let s = 0; s < MAX_SHARDS; s++) {
    pools.push({});
    for (const cls of classIds) {
      const members = agg.queues.filter(q => q.latencyClass === cls && placements[q.id] === s);
      pools[s][cls] = members.length === 0 ? 0 : Math.max(...agg.scenarioIds.map(sc =>
        members.reduce((acc, q) => acc + q.demand[sc], 0)));
    }
  }
  return pools;
};

const extractLayout = (agg, model, vars) => {
  const placements = {};
  // place is one-hot per queue; exactly one literal is true in any model.
  for (const [qid, lits] of vars.place) {
    placements[qid] = lits.findIndex(l => litTrue(model, l));
  }
  const pools = minimalPools(agg, placements);
  const poolExists = pools.map(byCls =>
    Object.fromEntries(classIds.map(cls => [cls, byCls[cls] >= 1])));
  return {
    placements,
    pools,
    poolExists,
    shardsUsed: new Set(Object.values(placements)).size,
  };
};

// Human-readable diff against the baseline: queue relocations plus pool
// attachments/detachments.
const computeMoves = (layout, baseline) => {
  if (baseline === null) return [];
  const moves = [];
  for (const [qid, shard] of Object.entries(layout.placements)) {
    const from = baseline.placements[qid];
    if (from === undefined) {
      moves.push({ kind: 'place', queue: qid, to: shard, cost: 0 });
    } else if (from !== shard) {
      moves.push({ kind: 'move', queue: qid, from, to: shard, cost: MOVE_COST.queue });
    }
  }
  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const cls of classIds) {
      const was = baseline.poolExists[s][cls];
      const now = layout.poolExists[s][cls];
      if (was === now) continue;
      moves.push({ kind: now ? 'attach' : 'detach', shard: s, cls, cost: MOVE_COST.pool });
    }
  }
  return moves;
};

const measureMoveCost = (layout, baseline) =>
  computeMoves(layout, baseline).reduce((acc, m) => acc + m.cost, 0);

const measureBalance = (agg, layout) => {
  let worst = 0;
  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const sc of agg.scenarioIds) {
      const load = agg.queues.reduce((acc, q) =>
        acc + (layout.placements[q.id] === s ? q.cmd[sc] : 0), 0);
      worst = Math.max(worst, load);
    }
  }
  return worst;
};

// One stage solve. Context is the factory returned by Z3 init; a fresh
// context is created per solve. options: { shardCap, strictTenantIsolation,
// baseline } with baseline null for stage 1.
export const solveStage = async (Context, agg, options) => {
  const started = performance.now();
  const deadline = started + SOLVE_TIMEOUT_MS;
  const timeLeft = () => deadline - performance.now();

  const ctx = Context(`queueshard_${++solveCounter}`);
  const { vars, structural, symmetry, constraints, bounds } = compileModel(ctx, agg, options);

  // Default SMT solver, not Solver('QF_FD'): the finite-domain engine
  // bit-blasts through inc_sat_solver, whose allocations blow past the
  // vendored WASM build's memory in the browser ("memory access out of
  // bounds" in sat2goal). The default solver handles the one-hot Boolean
  // placement encoding fast; see the model.js header for why the encoding
  // matters.
  const check = async (solver, assumptions) => {
    const budget = Math.max(1000, Math.min(10000, timeLeft()));
    solver.set('timeout', Math.round(budget));
    const t0 = performance.now();
    const res = await Promise.race([
      solver.check(...assumptions),
      new Promise(resolve => setTimeout(() => resolve('unknown'), budget + 3000)),
    ]);
    if (globalThis.QS_TRACE) console.log(`    check[${assumptions.length}]: ${res} ${Math.round(performance.now() - t0)}ms`);
    return res;
  };

  const finish = (verdict) => ({ moves: [], core: null, layout: null, ...verdict, solveMs: performance.now() - started });

  // ── Diagnosis solver: feasibility, core, shard minimum ─────────────
  const diag = new ctx.Solver();
  for (const e of structural) diag.add(e);
  for (const e of symmetry) diag.add(e);

  const groupIds = [...new Set(constraints.map(c => c.policyGroup))];
  const litByGroup = new Map(groupIds.map(g => [g, ctx.Bool.const(`assume_${g}`)]));
  const groupByLitName = new Map(groupIds.map(g => [`assume_${g}`, g]));
  for (const c of constraints) {
    diag.add(ctx.Implies(litByGroup.get(c.policyGroup), c.expr));
  }
  const checkDiag = (groups) => check(diag, groups.map(g => litByGroup.get(g)));

  const feasible = await checkDiag(groupIds);

  if (feasible === 'unknown') return finish({ status: 'unknown' });

  if (feasible === 'unsat') {
    // Raw core of policy groups, shrunk toward minimality by deletion.
    // Each deletion test runs on a fresh solver with the kept groups'
    // constraints added directly: without assumption guards Z3 can
    // preprocess fully, so a weakened UNSAT re-proof costs ~1s instead
    // of ~10s. (Z3's own core.minimize does the guarded, slow version.)
    const stillUnsat = async (groups) => {
      const trial = new ctx.Solver();
      for (const e of structural) trial.add(e);
      for (const e of symmetry) trial.add(e);
      const keep = new Set(groups);
      for (const c of constraints) if (keep.has(c.policyGroup)) trial.add(c.expr);
      return await check(trial, []) === 'unsat';
    };
    let core = [...diag.unsatCore()].map(lit => groupByLitName.get(lit.toString()));
    for (const g of [...core]) {
      if (core.length <= 1 || timeLeft() < 1500) break;
      const rest = core.filter(x => x !== g);
      if (await stillUnsat(rest)) core = rest;
    }
    return finish({ status: 'infeasible', core });
  }

  let canonical = extractLayout(agg, diag.model(), vars);

  // Shard minimum: walk up from the capacity lower bound on the
  // symmetry-broken solver (shard count is permutation-invariant).
  const loadLB = Math.max(...agg.scenarioIds.map(sc =>
    Math.ceil(agg.queues.reduce((acc, q) => acc + q.cmd[sc], 0) / SHARD_SPEC.redisCmdCeiling)));
  for (let k = loadLB; k < canonical.shardsUsed && timeLeft() > 1500; k++) {
    diag.push();
    diag.add(bounds.shardCount(k));
    if (await checkDiag(groupIds) === 'sat') {
      canonical = extractLayout(agg, diag.model(), vars);
      break;
    }
    diag.pop();
  }

  // ── Optimization solver: moves, then balance, at the proven minimum ─
  const opt = new ctx.Solver();
  for (const e of structural) opt.add(e);
  if (options.baseline === null) for (const e of symmetry) opt.add(e);
  for (const c of constraints) opt.add(c.expr);
  opt.add(bounds.shardCount(canonical.shardsUsed));

  // The canonical layout is the incumbent (valid under every constraint,
  // possibly move-costly against a baseline); every SAT check in the
  // tightening below replaces it with a better one.
  let layout = canonical;

  // Objectives 2 and 3: binary search a bound downward, value-guided.
  const tighten = async (makeBound, measure, granularity, lo0 = 0) => {
    let hi = measure(layout);
    let lo = lo0;
    while (lo < hi && timeLeft() > 1500) {
      // Midpoint of [lo, hi - granularity], snapped down to a granularity
      // multiple offset from lo — always a strict improvement over hi.
      const mid = lo + Math.floor((hi - granularity - lo) / 2 / granularity) * granularity;
      opt.push();
      opt.add(makeBound(mid));
      const res = await check(opt, []);
      if (res === 'sat') {
        layout = extractLayout(agg, opt.model(), vars);
        hi = measure(layout);
      } else {
        opt.pop();
        if (res !== 'unsat') break; // timeout: keep best found
        lo = mid + granularity;
      }
    }
    opt.add(makeBound(hi)); // pin
  };

  if (bounds.moveCost !== null) {
    await tighten(bounds.moveCost, l => measureMoveCost(l, options.baseline), 1);
  }
  // All cmd loads are multiples of 50, so the optimum is too — and no
  // shard can carry less than the per-shard average, so the search floor
  // is the counting bound, sparing the hopeless UNSAT proofs below it.
  const balanceLB = Math.max(...agg.scenarioIds.map(sc => {
    const total = agg.queues.reduce((acc, q) => acc + q.cmd[sc], 0);
    return Math.ceil(total / canonical.shardsUsed / 50) * 50;
  }));
  await tighten(bounds.balance, l => measureBalance(agg, l), 50, balanceLB);

  return finish({ status: 'sat', layout, moves: computeMoves(layout, options.baseline) });
};
