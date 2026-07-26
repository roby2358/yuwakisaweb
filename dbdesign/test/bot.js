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
  const costs = Engine.costBreakdown(state);
  const runningCost = k => costs.find(c => c.key === k).total;

  // Every purchase adds run-rate FOREVER, while income is only what traffic is
  // doing this second. So a commitment needs cash reserves to survive the next
  // dip AND has to leave total burn under a fraction of revenue. Committing to
  // permanent cost on a traffic spike is how a startup bankrupts itself.
  const canCarry = key => {
    const after = Engine.costIfBought(state, key);
    const delta = after - runningCost(key);
    return state.cash > 25 * after && r.spend + delta < 0.6 * r.income;
  };

  // Shed dead weight first — the cheapest capacity is the capacity you stop
  // paying for. A cache that cannot hit is pure burn.
  if (infra.cacheNodes > 0 && r.cache.hitRate < 0.3) {
    return Engine.scaleDown(state, 'cache').ok;
  }

  // --- free-ish wins -------------------------------------------------------
  if (!infra.indexes) return buy('indexes');
  if (!infra.pooler && (r.demandRps > 150 || r.sql.connUsed > 0.5 * r.sql.connCap)) {
    return buy('pooler');
  }

  // --- workload-shaped offloads -------------------------------------------
  const writeHeavy = state.mix.write > 0.3;
  const analyticsHeavy = state.mix.analytics > 0.12;
  const cacheWorth = state.mix.read * state.repetition > 0.25;
  const cacheCap = writeHeavy ? 2 : 6;
  const pressure = Math.max(r.sql.primaryUtil, r.sql.connUsed / Math.max(1, r.sql.connCap));
  // in a firefight, buy capacity, not accessories
  const firefight = pressure > 0.85;
  const tryCache = () => !firefight && cacheWorth && r.sql.primaryUtil > 0.5
    && infra.cacheNodes < cacheCap && canCarry('cache') && buy('cache');

  // NoSQL offload once LOOKUP volume is worth its very expensive first node
  if (infra.kvNodes === 0 && r.demandRps > 3000 && canCarry('kv')) return buy('kv');
  if (infra.kvNodes > 0 && infra.kvNodes < Content.MAX_KV && canCarry('kv')
      && r.perType.lookup.demand > 0.7 * infra.kvNodes * S.KV_OPS) return buy('kv');

  // cache carries the read side on repeat-heavy workloads; on analytics-heavy
  // ones it queues behind the capacity that actually serves the reports
  if (!analyticsHeavy && tryCache()) return true;

  // Get reports off the OLTP path. Once fan-out makes analytics a big slice of
  // cluster work, the warehouse is not an accessory — it is the cheapest
  // capacity on the board, because it deletes load instead of adding nodes.
  // So it is exempt from the run-rate budget, gated on cash reserves instead.
  if (!infra.warehouse) {
    const item = Engine.shopItem('warehouse');
    const reportsEatingCluster = r.sql.analyticsUnits > 0.35 * r.sql.primaryCapTotal;
    // ...but only once revenue is big enough to grow into the fixed cost, and
    // with reserves left over. A tiny cluster is "eaten" by any report at all.
    const canGrowInto = r.income > 1.5 * item.fixed;
    const reserved = state.cash > item.price(state) + 40 * r.spend;
    if ((reportsEatingCluster || infra.shards >= 4) && canGrowInto && reserved) {
      if (buy('warehouse')) return true;
    }
  }

  // replicas only when they would do READ work. Every replica multiplies the
  // node bill for the whole cluster while replaying every write, so a
  // write-heavy workload gets one at most — past that they are run-rate on
  // fire, and the money belongs in shards.
  const replicaCap = writeHeavy ? 1 : Content.MAX_REPLICAS;
  if (r.sql.primaryUtil > 0.55 && infra.replicas < 1
      && state.mix.read + state.mix.analytics > 0.3) return buy('replica');
  if (r.sql.replicaUtil > 0.75 && r.sql.replayFrac < 0.5
      && infra.replicas < replicaCap) return buy('replica');

  if (!infra.writeQueue && r.demandRps > 30000 && canCarry('queue')) return buy('queue');

  // --- capacity: this is what actually serves traffic, so it outranks the
  // accessories above. Write-heavy workloads shard early (only shards scale
  // writes); everyone else rides vertical to the wall first. Keep a cash
  // buffer so the migration dip cannot bankrupt the run.
  // Capacity is what serves traffic, so it outranks accessories — but it still
  // commits run-rate forever. Check what burn becomes AFTER the purchase (a
  // shard split doubles the nodes the cluster bills for), and keep enough cash
  // to pay that through the next dip.
  const affordable = key => {
    const price = Engine.shopItem(key).price(state);
    if (price === null || state.cash < price) return false;
    return state.cash - price > 20 * Engine.expensesIfBought(state, key);
  };
  const shardAtTier = writeHeavy ? 3 : 6;
  if (pressure > 0.55 && infra.tier < shardAtTier && affordable('tier')) return buy('tier');
  if (pressure > 0.55 && !state.migration && infra.shards < Content.MAX_SHARDS
      && affordable('shard')) return buy('shard');
  if (pressure > 0.55 && infra.tier < 6 && affordable('tier')) return buy('tier');

  // --- spare capacity for the read side, once the real load is handled -----
  if (analyticsHeavy && tryCache()) return true;
  if (cacheWorth && state.cash > 5000 && infra.cacheNodes < Content.MAX_CACHE
      && r.sql.primaryUtil > 0.5 && canCarry('cache')) return buy('cache');
  return false;
}

function botAct(state) {
  for (let i = 0; i < 3; i++) {
    if (!botBuyOne(state)) return;
  }
}

module.exports = { botAct, botBuyOne };
