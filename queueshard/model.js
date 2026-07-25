// Shared model compilation. Two layers:
//
//  1. buildAggregates — pure JS: fold job classes into queue-level numbers
//     (the placement unit). Used by the solver, the visualization, and the
//     offline verification script alike.
//  2. compileModel — builds the Z3 constraint system from those aggregates
//     via the direct expression API (never SMT-LIB strings). Every policy
//     constraint carries { policyGroup, label, description } so unsat
//     cores can be reported at the policy-group level.
//
// Placement is one-hot Boolean: x[q][s] ⇔ queue q lives on shard s, with
// a PbEq exactly-one row per queue. Pool sizes are bounded Ints. Load
// constraints are pseudo-boolean (ctx.PbLe) over the placement literals.
// Pure Boolean placement matters: with Int place[q] variables and
// place[q]=s equality atoms, the SMT core's PB propagation is too weak
// and bin-packing UNSAT proofs take tens of seconds; over Bool literals
// they take milliseconds. (The finite-domain Solver('QF_FD') also proves
// them fast, but its SAT engine exhausts the WASM build's memory in the
// browser — "memory access out of bounds" in sat2goal.)

import {
  SHARD_SPEC, MAX_SHARDS, FETCH_CMD_PER_THREAD, MAX_POOL_THREADS,
  HEADROOM, MOVE_COST, LATENCY_CLASSES,
} from './config.js';
import {
  JOB_CLASSES, QUEUES, SCENARIOS, DATABASES, AFFINITY_GROUPS,
  DEMOTION_PATHS, NOISY_TENANT,
} from './jobs.js';

// ── Policy groups ─────────────────────────────────────────────────────

export const POLICY_GROUPS = [
  {
    id: 'shard-budget',
    label: 'Shard budget',
    describe: (o) => `Every queue placed on one of at most ${o.shardCap} shards. Shards cost money; the cap is the fleet budget.`,
  },
  {
    id: 'redis-capacity',
    label: 'Redis command capacity',
    describe: () => `Per shard, per scenario: enqueue traffic plus worker fetch overhead stays under ${SHARD_SPEC.redisCmdCeiling.toLocaleString()} commands/sec — one Redis core is the ceiling, and it is a number, not a vibe.`,
  },
  {
    id: 'memory-capacity',
    label: 'Memory capacity',
    describe: () => `Per shard: worst-case backlog depth × payload size over placed queues stays under ${SHARD_SPEC.memoryMB.toLocaleString()} MB.`,
  },
  {
    id: 'latency-isolation',
    label: 'Latency-class isolation',
    describe: () => 'Urgent queues never share a shard with batch queues (Redis contention). Pool isolation — no shared worker pool across classes — is structural: pools are per (shard, latency class).',
  },
  {
    id: 'ordering-affinity',
    label: 'Ordering affinity',
    describe: () => 'Queues in the same ordering-affinity group share a shard, so ordering guarantees stay cheap.',
  },
  {
    id: 'tenant-isolation',
    label: 'Tenant isolation',
    describe: (o) => o.strictTenantIsolation
      ? `Strict: ${NOISY_TENANT}'s bulk workload runs on a dedicated shard — nothing else may share it.`
      : `${NOISY_TENANT}'s bulk workload never shares a shard with protected workloads (payments, fraud, payroll).`,
  },
  {
    id: 'demotion-paths',
    label: 'Demotion paths',
    describe: () => 'Queue pairs that bulk-demote jobs into each other during incidents share a shard, so the escape valve stays a same-instance list op.',
  },
  {
    id: 'db-connections',
    label: 'Database connection budget',
    describe: () => 'Summed worker threads per downstream database stay under its connection pool capacity. Draining a shard faster must not knock over Postgres.',
  },
  {
    id: 'slo-feasibility',
    label: 'SLO feasibility',
    describe: () => `Per shard, class, and scenario: attached pool threads cover peak arrival × p99 with ${HEADROOM}× headroom; urgent queues additionally drain their burst backlog within the SLO window. Scenario peak rates, not averages.`,
  },
];

// ── Aggregates (pure) ─────────────────────────────────────────────────

const jobMemoryMB = (job) => (job.backlogDepth * job.payloadKB) / 1024;

// Worker-thread demand for a queue's jobs in one scenario: headroom-scaled
// concurrency (rate × p99) plus, for urgent jobs, the extra threads needed
// to drain the assumed burst backlog within the SLO window.
const threadDemand = (jobs, scenarioId) => {
  let concurrency = 0;
  let drain = 0;
  for (const job of jobs) {
    concurrency += job.arrivalRate[scenarioId] * job.p99Sec;
    if (job.slo) drain += (job.slo.burstBacklog * job.p99Sec) / job.slo.windowSec;
  }
  return Math.ceil(HEADROOM * concurrency + drain);
};

export const buildAggregates = (includeHeldOut) => {
  const scenarioIds = SCENARIOS.map(s => s.id);
  const queues = [];

  for (const queueDef of QUEUES) {
    const jobs = JOB_CLASSES.filter(j =>
      j.queue === queueDef.id && (includeHeldOut || !j.heldOut));
    if (jobs.length === 0) continue;

    const cmd = {};
    const demand = {};
    for (const sc of scenarioIds) {
      cmd[sc] = jobs.reduce((acc, j) => acc + j.cmdLoad[sc], 0);
      demand[sc] = threadDemand(jobs, sc);
    }
    queues.push({
      ...queueDef,
      jobs,
      cmd,
      demand,
      memoryMB: Math.ceil(jobs.reduce((acc, j) => acc + jobMemoryMB(j), 0)),
      dbs: [...new Set(jobs.map(j => j.db).filter(db => db !== null))],
      noisy: jobs.some(j => j.tenant.noisy),
      protected: jobs.some(j => j.tenant.protected),
      affinityGroups: [...new Set(jobs.flatMap(j => j.affinityGroups))],
      heldOut: jobs.every(j => j.heldOut === true),
    });
  }

  const affinityPairs = [];
  for (const group of AFFINITY_GROUPS) {
    const members = queues.filter(q => q.affinityGroups.includes(group.id));
    for (let i = 1; i < members.length; i++) {
      affinityPairs.push({ group: group.id, a: members[0].id, b: members[i].id });
    }
  }

  const byId = new Map(queues.map(q => [q.id, q]));
  const demotionPairs = DEMOTION_PATHS
    .filter(p => byId.has(p.from) && byId.has(p.to))
    .map(p => ({ a: p.from, b: p.to, description: p.description }));

  return {
    queues,
    byId,
    scenarioIds,
    affinityPairs,
    demotionPairs,
    urgentQueues: queues.filter(q => q.latencyClass === 'urgent'),
    batchQueues: queues.filter(q => q.latencyClass === 'batch'),
    noisyQueues: queues.filter(q => q.noisy),
    protectedQueues: queues.filter(q => q.protected),
    databases: DATABASES,
  };
};

// ── Z3 compilation ────────────────────────────────────────────────────

const classIds = LATENCY_CLASSES.map(c => c.id);
const ones = (n) => Array.from({ length: n }, () => 1);

// options: { shardCap, strictTenantIsolation, baseline } — baseline is a
// prior layout { placements, poolExists } or null (stage 1).
export const compileModel = (ctx, agg, options) => {
  const int = (n) => ctx.Int.val(n);
  const sum = (terms) => terms.length === 0 ? int(0) : terms.reduce((a, b) => a.add(b));

  const queuesInClass = new Map(classIds.map(cls =>
    [cls, agg.queues.filter(q => q.latencyClass === cls)]));

  const place = new Map(agg.queues.map(q => [q.id,
    Array.from({ length: MAX_SHARDS }, (_, s) => ctx.Bool.const(`place_${q.id}_s${s}`))]));
  const pool = {};   // pool[shard][classId] → Int const
  const used = [];   // used[shard] → Bool const
  for (let s = 0; s < MAX_SHARDS; s++) {
    pool[s] = {};
    for (const cls of classIds) pool[s][cls] = ctx.Int.const(`pool_s${s}_${cls}`);
    used.push(ctx.Bool.const(`used_s${s}`));
  }

  const onShard = (qid, s) => place.get(qid)[s];
  const anyOn = (qs, s) => qs.length === 0
    ? ctx.Bool.val(false)
    : (qs.length === 1 ? onShard(qs[0].id, s) : ctx.Or(...qs.map(q => onShard(q.id, s))));
  const placeLits = (qs, s) => qs.map(q => onShard(q.id, s));
  const shardRange = Array.from({ length: MAX_SHARDS }, (_, s) => s);
  const sameShard = (aId, bId) =>
    ctx.And(...shardRange.map(s => onShard(aId, s).eq(onShard(bId, s))));
  const apartShards = (aId, bId) =>
    ctx.And(...shardRange.map(s => ctx.Not(ctx.And(onShard(aId, s), onShard(bId, s)))));

  const enqLoad = (s, sc) =>
    sum(agg.queues.map(q => ctx.If(onShard(q.id, s), int(q.cmd[sc]), int(0))));
  const shardThreads = (s) => sum(classIds.map(cls => pool[s][cls]));

  // — Structural (hard, never in a policy core) —
  const structural = [];
  for (const q of agg.queues) {
    // Exactly-one: each queue sits on exactly one shard.
    structural.push(ctx.PbEq(place.get(q.id), ones(MAX_SHARDS), 1));
  }
  // Shards are interchangeable, so feasibility questions may canonicalize
  // usage to a contiguous prefix. Returned separately: valid for
  // permutation-invariant checks (feasibility, cores, shard minimum),
  // INVALID whenever move cost against a baseline is being measured,
  // because the baseline pins concrete shard identities.
  const symmetry = [];
  for (let s = 1; s < MAX_SHARDS; s++) {
    symmetry.push(ctx.Implies(used[s], used[s - 1]));
  }

  for (let s = 0; s < MAX_SHARDS; s++) {
    structural.push(used[s].eq(anyOn(agg.queues, s)));
    for (const cls of classIds) {
      structural.push(pool[s][cls].ge(int(0)));
      structural.push(pool[s][cls].le(int(MAX_POOL_THREADS)));
      // No queues of this class here → no pool attached here.
      structural.push(ctx.Implies(ctx.Not(anyOn(queuesInClass.get(cls), s)), pool[s][cls].eq(int(0))));
    }
  }

  // — Policy constraints —
  const constraints = [];
  const addC = (policyGroup, label, description, expr) =>
    constraints.push({ policyGroup, label, description, expr });

  for (const q of agg.queues) {
    const outside = shardRange.filter(s => s >= options.shardCap)
      .map(s => ctx.Not(onShard(q.id, s)));
    addC('shard-budget', `${q.label} within cap`,
      `${q.label} must land on one of the first ${options.shardCap} shards.`,
      outside.length === 0 ? ctx.Bool.val(true)
        : (outside.length === 1 ? outside[0] : ctx.And(...outside)));
  }

  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const sc of agg.scenarioIds) {
      addC('redis-capacity', `shard ${s} · ${sc}`,
        `Enqueue traffic + ${FETCH_CMD_PER_THREAD} cmd/s per attached worker thread ≤ ${SHARD_SPEC.redisCmdCeiling} cmd/s on shard ${s} under ${sc}.`,
        enqLoad(s, sc).add(shardThreads(s).mul(int(FETCH_CMD_PER_THREAD)))
          .le(int(SHARD_SPEC.redisCmdCeiling)));
      // Implied PB form (fetch overhead ≥ 0) — same policy group.
      addC('redis-capacity', `shard ${s} · ${sc} (pb)`,
        `Enqueue traffic alone ≤ ${SHARD_SPEC.redisCmdCeiling} cmd/s on shard ${s} under ${sc}.`,
        ctx.PbLe(placeLits(agg.queues, s), agg.queues.map(q => q.cmd[sc]),
          SHARD_SPEC.redisCmdCeiling));
    }
    addC('memory-capacity', `shard ${s} memory`,
      `Worst-case backlog memory of queues on shard ${s} ≤ ${SHARD_SPEC.memoryMB} MB.`,
      ctx.PbLe(placeLits(agg.queues, s), agg.queues.map(q => q.memoryMB),
        SHARD_SPEC.memoryMB));
  }

  for (const u of agg.urgentQueues) {
    for (const b of agg.batchQueues) {
      addC('latency-isolation', `${u.label} apart from ${b.label}`,
        `Urgent ${u.label} and batch ${b.label} may not share a shard.`,
        apartShards(u.id, b.id));
    }
  }

  for (const pair of agg.affinityPairs) {
    addC('ordering-affinity', `${pair.a} with ${pair.b}`,
      `Ordering group '${pair.group}' pins these queues to one shard.`,
      sameShard(pair.a, pair.b));
  }

  for (const noisy of agg.noisyQueues) {
    const others = options.strictTenantIsolation
      ? agg.queues.filter(q => q.id !== noisy.id)
      : agg.protectedQueues;
    for (const other of others) {
      addC('tenant-isolation', `${noisy.label} apart from ${other.label}`,
        options.strictTenantIsolation
          ? `Strict isolation: ${noisy.label} gets a dedicated shard, away from ${other.label}.`
          : `Noisy-tenant ${noisy.label} may not share a shard with protected ${other.label}.`,
        apartShards(noisy.id, other.id));
    }
  }

  for (const pair of agg.demotionPairs) {
    addC('demotion-paths', `${pair.a} with ${pair.b}`, pair.description,
      sameShard(pair.a, pair.b));
  }

  for (const db of agg.databases) {
    const touchingByClass = new Map(classIds.map(cls =>
      [cls, queuesInClass.get(cls).filter(q => q.dbs.includes(db.id))]));
    const terms = [];
    for (let s = 0; s < MAX_SHARDS; s++) {
      for (const cls of classIds) {
        const touching = touchingByClass.get(cls);
        if (touching.length === 0) continue;
        terms.push(ctx.If(anyOn(touching, s), pool[s][cls], int(0)));
      }
    }
    addC('db-connections', `${db.label} budget`,
      `Worker threads whose pools serve ${db.label}-touching queues ≤ ${db.maxConnections} connections.`,
      sum(terms).le(int(db.maxConnections)));
  }

  for (let s = 0; s < MAX_SHARDS; s++) {
    for (const cls of classIds) {
      const members = queuesInClass.get(cls);
      if (members.length === 0) continue;
      for (const sc of agg.scenarioIds) {
        addC('slo-feasibility', `shard ${s} · ${cls} pool · ${sc}`,
          `The ${cls} pool on shard ${s} must cover its queues' ${sc} demand (headroom + urgent burst drain).`,
          sum(members.map(q => ctx.If(onShard(q.id, s), int(q.demand[sc]), int(0))))
            .le(pool[s][cls]));
      }
    }
  }

  // — Lexicographic bound builders (solve.js tightens these iteratively) —
  // Pool existence is placement-forced (SLO lower bound + structural zero),
  // so move literals are expressed over placement alone.
  const bounds = {
    shardCount: (k) => ctx.PbLe(used, ones(MAX_SHARDS), k),

    moveCost: options.baseline === null ? null : (m) => {
      const lits = [];
      const costs = [];
      for (const q of agg.queues) {
        const basePlace = options.baseline.placements[q.id];
        if (basePlace === undefined) continue; // new queue: placement is free
        lits.push(ctx.Not(onShard(q.id, basePlace)));
        costs.push(MOVE_COST.queue);
      }
      for (let s = 0; s < MAX_SHARDS; s++) {
        for (const cls of classIds) {
          const present = anyOn(queuesInClass.get(cls), s);
          lits.push(options.baseline.poolExists[s][cls] ? ctx.Not(present) : present);
          costs.push(MOVE_COST.pool);
        }
      }
      return ctx.PbLe(lits, costs, m);
    },

    balance: (m) => ctx.And(...agg.scenarioIds.flatMap(sc =>
      Array.from({ length: MAX_SHARDS }, (_, s) =>
        ctx.PbLe(placeLits(agg.queues, s), agg.queues.map(q => q.cmd[sc]), m)))),
  };

  return { vars: { place, pool, used }, structural, symmetry, constraints, bounds };
};
