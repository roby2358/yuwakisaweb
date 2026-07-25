// Offline dataset-tuning aid: emits the QueueShard constraint model as
// SMT-LIB for a named check, so the three staged outcomes can be verified
// against a reference Z3 before shipping dataset numbers. The app itself
// never generates SMT-LIB — it uses the direct API (model.js).
//
//   node scripts/verify.mjs <check>     # prints SMT-LIB on stdout
//   node scripts/verify.mjs --list
//
// Expected verdicts:
//   stage1-sat4      sat     baseline fits 4 shards
//   stage1-unsat3    unsat   baseline cannot fit 3 (forces "4 shards used")
//   balance-4100     sat     optimal balance value is 4100...
//   balance-4000     unsat   ...exactly (so every optimal baseline is known-shaped)
//   urgentbin        unsat   in every optimal baseline the urgent shard is {payments, fraud} alone
//   stage2-nomove    unsat   no optimal baseline absorbs the recalc queue with zero queue moves
//   stage2-onemove-a sat     a one-queue-move stage-2 solution exists (baseline shape A)
//   stage2-onemove-b sat     same for adversarial baseline shape B
//   stage2-unsat3    unsat   stage 2 still needs 4 shards
//   stage3-unsat     unsat   cap 4 + strict tenant isolation is infeasible
//   stage3-nocap     sat     drop the cap → feasible   (core member 1)
//   stage3-noiso     sat     drop strict isolation → feasible (core member 2)
//   stage3-noredis   sat     drop Redis capacity → feasible (core member 3)
//   stage3-relax     sat     suggested relaxation (cap 5, isolation kept) re-solves

import {
  SHARD_SPEC, MAX_SHARDS, FETCH_CMD_PER_THREAD, MAX_POOL_THREADS,
} from '../config.js';
import { buildAggregates } from '../model.js';

const CLASSES = ['urgent', 'fast', 'default', 'batch'];

const onS = (qid, s) => `(= place_${qid} ${s})`;
const iteSum = (terms) => terms.length ? `(+ 0 ${terms.join(' ')})` : '0';

const buildSMT = ({ includeHeldOut, shardCap, strict, dropRedis, extra }) => {
  const agg = buildAggregates(includeHeldOut);
  const out = [];

  for (const q of agg.queues) out.push(`(declare-const place_${q.id} Int)`);
  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const cls of CLASSES) out.push(`(declare-const pool_s${s}_${cls} Int)`);
  }

  const enq = (s, sc) => iteSum(agg.queues.map(q =>
    `(ite ${onS(q.id, s)} ${q.cmd[sc]} 0)`));
  const demandSum = (s, cls, sc) => iteSum(agg.queues
    .filter(q => q.latencyClass === cls)
    .map(q => `(ite ${onS(q.id, s)} ${q.demand[sc]} 0)`));
  const threads = (s) => `(+ ${CLASSES.map(c => `pool_s${s}_${c}`).join(' ')})`;

  // Bounds + shard cap
  for (const q of agg.queues) {
    out.push(`(assert (and (>= place_${q.id} 0) (< place_${q.id} ${shardCap})))`);
  }
  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const cls of CLASSES) {
      out.push(`(assert (and (>= pool_s${s}_${cls} 0) (<= pool_s${s}_${cls} ${MAX_POOL_THREADS})))`);
    }
  }

  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const sc of agg.scenarioIds) {
      if (!dropRedis) {
        out.push(`(assert (<= (+ ${enq(s, sc)} (* ${FETCH_CMD_PER_THREAD} ${threads(s)})) ${SHARD_SPEC.redisCmdCeiling}))`);
      }
      for (const cls of CLASSES) {
        out.push(`(assert (<= ${demandSum(s, cls, sc)} pool_s${s}_${cls}))`);
      }
    }
    out.push(`(assert (<= ${iteSum(agg.queues.map(q => `(ite ${onS(q.id, s)} ${q.memoryMB} 0)`))} ${SHARD_SPEC.memoryMB}))`);
  }

  for (const u of agg.urgentQueues) {
    for (const b of agg.batchQueues) {
      out.push(`(assert (not (= place_${u.id} place_${b.id})))`);
    }
  }
  for (const p of agg.affinityPairs) out.push(`(assert (= place_${p.a} place_${p.b}))`);
  for (const p of agg.demotionPairs) out.push(`(assert (= place_${p.a} place_${p.b}))`);
  for (const noisy of agg.noisyQueues) {
    const others = strict ? agg.queues.filter(q => q.id !== noisy.id) : agg.protectedQueues;
    for (const o of others) out.push(`(assert (not (= place_${noisy.id} place_${o.id})))`);
  }
  for (const db of agg.databases) {
    const terms = [];
    for (let s = 0; s < MAX_SHARDS; s++) {
      for (const cls of CLASSES) {
        const touching = agg.queues.filter(q => q.latencyClass === cls && q.dbs.includes(db.id));
        if (touching.length === 0) continue;
        const any = touching.length === 1 ? onS(touching[0].id, s)
          : `(or ${touching.map(q => onS(q.id, s)).join(' ')})`;
        terms.push(`(ite ${any} pool_s${s}_${cls} 0)`);
      }
    }
    out.push(`(assert (<= ${iteSum(terms)} ${db.maxConnections}))`);
  }

  if (extra) out.push(...extra({ agg, enq, demandSum }));
  out.push('(check-sat)');
  out.push('(get-model)');
  return out.join('\n');
};

// Assert every shard-scenario enqueue load ≤ bound (balance optimum probe).
const balanceCap = (bound) => ({ agg, enq }) => {
  const lines = [];
  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const sc of agg.scenarioIds) lines.push(`(assert (<= ${enq(s, sc)} ${bound}))`);
  }
  return lines;
};

// "Recalc fits some shard with zero queue moves" — pools taken at their
// minimum (demand), the most favorable case for fitting.
const recalcFitsSomewhere = () => ({ agg, enq, demandSum }) => {
  const recalcAgg = buildAggregates(true);
  const recalc = recalcAgg.byId.get('q_quarterly_recalc');
  const fits = [];
  for (let s = 0; s < 4; s++) {
    const parts = agg.urgentQueues.map(u => `(not ${onS(u.id, s)})`);
    for (const sc of agg.scenarioIds) {
      const minThreads = `(+ ${CLASSES.map(c => demandSum(s, c, sc)).join(' ')} ${recalc.demand[sc]})`;
      parts.push(`(<= (+ ${enq(s, sc)} ${recalc.cmd[sc]} (* ${FETCH_CMD_PER_THREAD} ${minThreads})) ${SHARD_SPEC.redisCmdCeiling})`);
      parts.push(`(<= (+ ${demandSum(s, 'batch', sc)} ${recalc.demand[sc]}) ${MAX_POOL_THREADS})`);
    }
    const memSum = iteSum(agg.queues.map(q => `(ite ${onS(q.id, s)} ${q.memoryMB} 0)`));
    parts.push(`(<= (+ ${memSum} ${recalc.memoryMB}) ${SHARD_SPEC.memoryMB})`);
    fits.push(`(and ${parts.join(' ')})`);
  }
  return [`(assert (or ${fits.join(' ')}))`];
};

const atMostOneMove = (baseline) => () => {
  const terms = Object.entries(baseline).map(([qid, s]) =>
    `(ite (= place_${qid} ${s}) 0 1)`);
  return [`(assert (<= (+ ${terms.join(' ')}) 1))`];
};

const BASELINE_A = {
  q_payments: 0, q_fraud: 0,
  q_payroll_run: 1, q_tax_calc: 1, q_documents: 1,
  q_webhooks: 2, q_reports: 2, q_tenant_bulk: 2,
  q_ledger: 3, q_integrations: 3, q_nightly_ledger: 3, q_notifications: 3,
};
const BASELINE_B = {
  q_payments: 0, q_fraud: 0,
  q_nightly_ledger: 1, q_reports: 1, q_tenant_bulk: 1,
  q_ledger: 2, q_integrations: 2, q_payroll_run: 2, q_notifications: 2,
  q_webhooks: 3, q_tax_calc: 3, q_documents: 3,
};

const urgentBinImpure = () => ({ agg }) => {
  const nonUrgent = agg.queues.filter(q => q.latencyClass !== 'urgent');
  const shares = nonUrgent.flatMap(q => agg.urgentQueues.map(u =>
    `(= place_${q.id} place_${u.id})`));
  return [`(assert (or ${shares.join(' ')}))`];
};

const CHECKS = {
  'stage1-sat4': () => buildSMT({ includeHeldOut: false, shardCap: 4, strict: false, dropRedis: false, extra: null }),
  'stage1-unsat3': () => buildSMT({ includeHeldOut: false, shardCap: 3, strict: false, dropRedis: false, extra: null }),
  'balance-4100': () => buildSMT({ includeHeldOut: false, shardCap: 4, strict: false, dropRedis: false, extra: balanceCap(4100) }),
  'balance-4000': () => buildSMT({ includeHeldOut: false, shardCap: 4, strict: false, dropRedis: false, extra: balanceCap(4000) }),
  'urgentbin': () => buildSMT({ includeHeldOut: false, shardCap: 4, strict: false, dropRedis: false,
    extra: (h) => [...balanceCap(4100)(h), ...urgentBinImpure()(h)] }),
  'stage2-nomove': () => buildSMT({ includeHeldOut: false, shardCap: 4, strict: false, dropRedis: false,
    extra: (h) => [...balanceCap(4100)(h), ...recalcFitsSomewhere()(h)] }),
  'stage2-onemove-a': () => buildSMT({ includeHeldOut: true, shardCap: 4, strict: false, dropRedis: false, extra: atMostOneMove(BASELINE_A) }),
  'stage2-onemove-b': () => buildSMT({ includeHeldOut: true, shardCap: 4, strict: false, dropRedis: false, extra: atMostOneMove(BASELINE_B) }),
  'stage2-unsat3': () => buildSMT({ includeHeldOut: true, shardCap: 3, strict: false, dropRedis: false, extra: null }),
  'stage3-unsat': () => buildSMT({ includeHeldOut: true, shardCap: 4, strict: true, dropRedis: false, extra: null }),
  'stage3-nocap': () => buildSMT({ includeHeldOut: true, shardCap: 6, strict: true, dropRedis: false, extra: null }),
  'stage3-noiso': () => buildSMT({ includeHeldOut: true, shardCap: 4, strict: false, dropRedis: false, extra: null }),
  'stage3-noredis': () => buildSMT({ includeHeldOut: true, shardCap: 4, strict: true, dropRedis: true, extra: null }),
  'stage3-relax': () => buildSMT({ includeHeldOut: true, shardCap: 5, strict: true, dropRedis: false, extra: null }),
};

const name = process.argv[2];
if (name === '--list' || !CHECKS[name]) {
  console.log(Object.keys(CHECKS).join('\n'));
  process.exit(name === '--list' ? 0 : 1);
}
console.log(CHECKS[name]());
