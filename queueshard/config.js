// Fixed planning parameters. These are the "capacity limits belong to shards"
// side of the model; workload numbers live in jobs.js.

// R2-hosted Z3 WebAssembly URL — same bucket MIAS uses. Non-secret.
export const Z3_WASM_URL = 'https://pub-3de05a81a5c94b69ac5dbc091eff370a.r2.dev/z3-built.wasm';

// Candidate shard fleet. Every shard is identical; the solver decides how
// many of the six candidates are actually used.
export const MAX_SHARDS = 6;

export const SHARD_SPEC = {
  // Sustainable Redis command ceiling per shard (single core), commands/sec.
  // Deliberately set at ~25% of the theoretical instance maximum: the ops
  // ceiling, not the benchmark ceiling.
  redisCmdCeiling: 5000,
  redisCeilingProvenance: {
    source: 'redis-benchmark on prod instance class, derated to ops ceiling',
    freshness: 'measured 2026-06-30',
    confidence: 'measured',
    owner: 'Infra / Datastores',
  },
  // Instance memory available for queue backlogs, MB.
  memoryMB: 2048,
  memoryProvenance: {
    source: 'instance class spec minus Redis overhead reservation',
    freshness: 'reviewed 2026-07-01',
    confidence: 'declared',
    owner: 'Infra / Datastores',
  },
};

// Redis command load each attached worker thread adds to its shard
// (blocking fetch + heartbeats), commands/sec per thread.
export const FETCH_CMD_PER_THREAD = 2;

// Upper bound on one worker pool (processes x threads) per shard per
// latency class.
export const MAX_POOL_THREADS = 96;

// Service-capacity headroom factor for SLO feasibility (peak-rate form).
export const HEADROOM = 1.3;

// Move costs for the stage-2 minimize-moves objective. A queue relocation
// is a drain-and-cutover (a small production event); a pool re-attachment
// is a throttled ramp — cheaper, but not free.
export const MOVE_COST = { queue: 10, pool: 3 };

// Global time budget per solve (feasibility + lexicographic tightening +
// diagnosis). A feasibility check that exceeds it reports UNKNOWN — a
// solver limit, never an infeasibility proof.
export const SOLVE_TIMEOUT_MS = 20000;

// Latency classes, in display order. sloText is narration, not model input.
export const LATENCY_CLASSES = [
  { id: 'urgent',  label: 'urgent',  sloText: 'seconds-scale queue latency' },
  { id: 'fast',    label: 'fast',    sloText: 'sub-minute queue latency' },
  { id: 'default', label: 'default', sloText: 'minutes-scale queue latency' },
  { id: 'batch',   label: 'batch',   sloText: 'hours-scale completion' },
];
