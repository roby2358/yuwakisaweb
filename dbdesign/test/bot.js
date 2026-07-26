// Reactive playtest bot for HUG OF DEATH — models sensible workload-aware
// play. Shared by test/sim.js and any diagnostic scripts.

const Engine = require('../engine.js');
const Content = require('../content.js');
const S = Content.SIM;

// Fix whichever bottleneck the report shows, cheapest effective fix first.
function botBuyOne(state) {
  const r = state.report;
  if (!r) return false;
  const infra = state.infra;
  const buy = k => Engine.buy(state, k).ok;

  if (!infra.indexes) return buy('indexes');
  if (!infra.pooler && (r.demandRps > 150 || r.sql.connUsed > 0.5 * r.sql.connCap)) {
    return buy('pooler');
  }
  // NoSQL offload once LOOKUP volume is worth it, then keep headroom
  if (infra.kvNodes === 0 && r.demandRps > 3000) return buy('kv');
  if (infra.kvNodes > 0 && r.perType.lookup.demand > 0.7 * infra.kvNodes * S.KV_OPS
      && infra.kvNodes < Content.MAX_KV) return buy('kv');
  // cache scales the read side — but only when the workload repeats itself,
  // and never ahead of capacity on write-heavy runs (writes can't be cached).
  // On analytics-heavy runs, replicas/warehouse outrank it: greedy $150 cache
  // buys would otherwise starve the saved-up purchases that fix the real load.
  const writeHeavy = state.mix.write > 0.3;
  const analyticsHeavy = state.mix.analytics > 0.12;
  const cacheWorth = state.mix.read * state.repetition > 0.25;
  const cacheCap = writeHeavy ? 2 : 6;
  const pressure = Math.max(r.sql.primaryUtil, r.sql.connUsed / Math.max(1, r.sql.connCap));
  // in a firefight, buy capacity, not accessories — greedy cheap cache buys
  // would eat every dollar before a tier/replica/shard could be saved up
  const firefight = pressure > 0.85;
  const tryCache = () => !firefight
    && cacheWorth && r.sql.primaryUtil > 0.5 && infra.cacheNodes < cacheCap && buy('cache');
  if (!analyticsHeavy && tryCache()) return true;
  // get reports off the OLTP path once they are a real share of the load
  if (!infra.warehouse && (infra.shards >= 4 || r.sql.analyticsUnits > 0.3 * r.sql.primaryCapTotal)) {
    if (buy('warehouse')) return true;
  }
  // replicas only when they would do READ work — a replica that is busy
  // replaying writes (high replayFrac) is run-rate on fire, not capacity
  if (r.sql.primaryUtil > 0.55 && infra.replicas < 1
      && state.mix.read + state.mix.analytics > 0.3) return buy('replica');
  if (r.sql.replicaUtil > 0.75 && r.sql.replayFrac < 0.5
      && infra.replicas < Content.MAX_REPLICAS) return buy('replica');
  if (analyticsHeavy && tryCache()) return true;
  // write queue before the write-heavy late game
  if (!infra.writeQueue && r.demandRps > 30000) return buy('queue');
  // capacity. Write-heavy workloads shard early — only shards scale writes,
  // and a shard split beats the top of the vertical price ladder. Everyone
  // else rides vertical to the wall first. Keep a cash buffer so the
  // migration dip can't bankrupt the run.
  const shardAtTier = writeHeavy ? 3 : 6;
  if (pressure > 0.55 && infra.tier < shardAtTier) return buy('tier');
  if (pressure > 0.55 && !state.migration && infra.shards < Content.MAX_SHARDS) {
    const price = Engine.shopItem('shard').price(state);
    if (state.cash > price + 45 * Engine.expenses(state)) return buy('shard');
  }
  if (pressure > 0.55 && infra.tier < 6) return buy('tier');
  // spare cash late: more cache toward the 92% cap
  if (cacheWorth && state.cash > 5000 && infra.cacheNodes < Content.MAX_CACHE
      && r.sql.primaryUtil > 0.5) return buy('cache');
  return false;
}

function botAct(state) {
  for (let i = 0; i < 3; i++) {
    if (!botBuyOne(state)) return;
  }
}

module.exports = { botAct, botBuyOne };
