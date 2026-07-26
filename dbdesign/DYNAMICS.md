# HUG OF DEATH — a database scaling game

Scale your startup's relational database from 10 requests/second to 1,000,000.
Survive the traffic. Collect the insights. Ace the interview.

## Theme

**The dread of success.** Every good day brings more users, and more users break
the thing that made yesterday good. You are the database architect watching the
graph climb, knowing the current architecture has a ceiling, feeling the exact
moment the queue starts to pile up. The emotional core is *watching a bottleneck
form in real time and knowing which lever fixes it* — that is precisely the
intuition the game exists to build.

## Key Drivers

1. **Readable Consequences** — the whole point. The player must *see* where the
   system hurts: which component's queue is growing, whether the DB died from
   CPU or connections, why latency exploded at 90% utilization.
2. **Escalating Commitment** — success causes load. Fast responses grow the user
   base; the user base generates the traffic that breaks the architecture. The
   player's own victories trigger every crisis.
3. **Scarcity of Agency** — cash. Infrastructure has purchase costs and run-rate.
   Every upgrade is double-edged (replicas add lag, indexes tax writes, shards
   tax cross-shard queries), so money spent on the wrong fix is a real loss.

## Key Mechanics (one per driver)

- **Visible pipeline** (Readable Consequences): every request is a particle
  flowing left-to-right through the architecture; each component shows a live
  utilization bar, queue stack, and connection gauge, and failures flash red at
  the exact component that dropped them.
- **Reputation loop** (Escalating Commitment): served-fast requests raise
  reputation, reputation grows users exponentially, users generate demand.
  Errors churn users *directly and fast*, and reputation tracks
  `successFrac³` — so growth demands near-perfect service: a clean system
  doubles every ~11s, 10% errors halve that rate, 20% reverses it, and past
  30% the user base halves in ~12s. Reputation crashes fast and rebuilds
  slowly, so a meltdown leaves a scar.

  **This curve is also the game's stabilizer.** Error rate is a real brake on
  demand: when you are underwater, the traffic causing the pain leaves, demand
  falls to what you *can* serve, and you get room to recover. Without that,
  demand outruns anything you can buy and the player is pinned watching red
  gauges with no move available — which is exactly what playtesting found when
  growth still outpaced churn at a 30% error rate.
- **Runway and burn** (Scarcity of Agency): you start with seed runway and no
  revenue. Each served request earns; every subsystem burns per second in two
  parts — a **fixed** cost the instant you own any of it (the team, the
  monitoring, the on-call rotation) plus a small **marginal** cost per node.
  Operational cost is a step function, not a slope: the first KV node is
  expensive, the tenth is cheap. Anything can be scaled back down to stop
  paying for it, and nothing is refunded.

## The Simulation Truths (what the game teaches)

These are real systems facts, encoded as mechanics, surfaced as collectible
**Insight cards** the first time the player experiences each one:

1. **The Hockey Stick** — latency ≈ service_time / (1 − utilization). 80% busy
   feels fine; 95% is 20× slower. The latency chart makes this visceral.
2. **Little's Law** — concurrent connections = arrival rate × seconds held.
   Shown on the DB connection gauge.
3. **Connection starvation** — without a pooler, clients hold connections
   ~10× longer than the query takes, so the DB dies at ~30% CPU. The pooler
   is cheap and fixes it — the classic interview beat.
4. **Cache math** — 90% hit rate = 10× less DB read traffic. Writes invalidate,
   so write-heavy mixes blunt the cache.
5. **Replicas scale reads, not writes** — every replica replays every write, so
   replication eats replica capacity as write volume grows.
6. **Replication lag** — an overloaded replica serves stale reads; users notice.
7. **Indexes** — reads get ~10× cheaper, writes ~20% costlier. Buy them first.
8. **Vertical scaling ends** — each bigger box costs ~2.5× for 2× capacity, and
   the biggest box is still not 1M RPS. Forces the horizontal turn.
9. **Sharding scales writes** — N shards ≈ N× write capacity. Cross-shard
   analytics pays *coordination* (touch every shard, wait for the slowest,
   merge), not N× the scanning — each shard reads only its slice — so a report
   at 64 shards costs ~8× one at a single shard. The migration window degrades
   capacity, so reshard *before* you're at 90%.
10. **NoSQL contrast** — the KV store scales linearly and cheaply for key
    lookups, but joins/analytics can't go there. It's an offload, not a
    replacement.
11. **Queues turn failure into debt** — the write queue absorbs bursts instead
    of erroring, but backlog is staleness the player watches drain.
12. **Thundering herd** — a cache node reboot sends the full read load to the
    DB at once. Survive it warm or die cold.

## Request Mix (the traffic is the level design)

| Type | Color | Path | Notes |
|---|---|---|---|
| READ | blue | cache → SQL on miss | repeated content fetches — cacheable to the extent the workload repeats |
| WRITE | orange | SQL primary (owning shard) | unique mutations; invalidates cache; only shards scale it |
| LOOKUP | green | KV store if built, else SQL | sessions, flags — NoSQL-able |
| ANALYTICS | purple | SQL replicas preferred | joins/scans; fan-out on shards; never cacheable, never KV-able |

Events reshape the mix (report day quadruples ANALYTICS; a viral post is pure
READ; a signup storm is WRITE-heavy).

### Workload profiles — a new hand every run

Each run rolls one of five business archetypes (with ±20% jitter), shown as a
stacked proportion bar under the top stats; hovering a segment describes that
class along the axes that matter (rate, size, repeated vs unique, latency
expectation). The bar shows **five** display classes, not four: READ splits into
*repeated* (bright blue, the only traffic a cache can absorb) and *unique* (dark
blue, always lands on the database), sized by the profile's repetition factor.
The classes are ordered by the architecture that answers them — WRITE (shards),
READ·unique (replicas/shards), READ·repeated (cache), LOOKUP (KV), ANALYTICS
(warehouse) — so reading the bar left to right is reading your build order.
The profile decides which architecture carries the game — this is the "first
question you ask in the interview" made mechanical:

| Profile | Signature (share of requests) | Dominant share of *work* | Repetition | $/req | Winning shape |
|---|---|---|---|---|---|
| Social photo feed | READ 74% | reads 36% | 1.0 | .006 | cache is the game |
| Flash-sale commerce | WRITE 32% | writes 51% | 0.8 | .009 | cache browsing, shard checkout |
| IoT telemetry ingest | WRITE 61% | writes 63% | 0.4 | .010 | shard early; cache is a cash sink |
| Ad-tech exchange | LOOKUP 57% | writes 30% / lookups 29% | 0.7 | .006 | NoSQL KV carries it |
| B2B analytics SaaS | ANALYTICS 10% | analytics 78% | 0.6 | .013 | replicas then warehouse |

Note the two share columns: **analytics is a tiny fraction of requests but a
large fraction of work**, because each report costs 60× a point read. Request
counts lie; work is what fills a cluster. This is also a balance tripwire —
playtesting caught analytics at 5–22% of requests, which made it 62–90% of
cluster work in *every* profile, so the warehouse was silently the only correct
answer everywhere and the workload differentiation stopped existing.

Two profile-scoped mechanics make the differences bite:

- **Repetition** scales the achievable cache hit rate. High-repetition feeds
  reach the 92% cap; unique-read telemetry caps near 35% — the cache becomes
  run-rate on fire, and a dedicated insight card (`cacheroi`) fires when the
  player learns this the expensive way.
- **Revenue per request** differs by business (unit economics): a B2B dashboard
  hit earns ~2× a telemetry ping, which is what funds the heavier queries those
  workloads demand. Driver: scarcity of agency — the budget curve is shaped by
  the workload, so the same shop reads differently every run. (Also the
  replayability driver: variable reinforcement across runs, not just within.)

## Components (the shop — each is one interview talking point)

| Purchase | Effect | Trade-off (double edge) | Fixed $/s | Marginal |
|---|---|---|---|---|
| Add indexes | read cost 10u → 1u | write cost +20% | 0.5 | — |
| Connection pooler | connections held only for query duration | none — that's the lesson: it's the free win people forget | 2 | — |
| Bigger primary (tiers 1–6) | 2× query units & connections per tier | price ×2.5 per tier; hard ceiling at tier 6 | 4 | per node, by tier |
| Read replica (per shard) | adds a read-serving node | replays all writes; lags when hot → stale reads | 3 | nodes billed above |
| Cache node | +hit rate (caps ~92% × repetition), +ops capacity | invalidated by writes; herd risk on reboot | 8 | 2/node |
| KV store node (NoSQL) | LOOKUP traffic offloaded, linear scale | can't serve JOINs — ANALYTICS stays on SQL | **28** | 1.5/node |
| Shard split (×2, up to 64) | ~2× write & read capacity | ANALYTICS coordination cost climbs per shard; 20s migration at reduced capacity | 6 | 2/shard |
| Analytics warehouse (OLAP) | reports leave the transaction path | reports take ~2s; a data team to run it | 24 | — |
| Write queue | write overflow becomes backlog, not errors | backlog = visible staleness debt | 12 | — |

The fixed column is the point. A KV store costs $28/s before it serves a single
request, and $1.50 per node after — so "just add Redis for this one feature" is
a question about headcount, not hosting. Every subsystem can be scaled back
down (nodes retired, boxes downgraded, whole systems decommissioned) with
nothing refunded; **sharding is the one-way door** you cannot walk back.

### Component probes (observability as a mechanic)

Hovering any component opens a panel interrogating it in the vocabulary of the
job: **TRAFFIC** (rate in, by request class), **LATENCY** (p50/p99, and what
this component contributes), **ERRORS** (count *and cause* — connection
refused vs out of capacity vs client timeout), **SATURATION** (CPU, connections
held vs limit, cache hit rate against its repetition ceiling, replication lag,
queue depth), and **COST** (run-rate, fixed and marginal).

Every box answers the same four questions, which is the discipline itself:
Google SRE's golden signals, with RED (Rate/Errors/Duration) framing the
client-facing views and USE (Utilization/Saturation/Errors) framing the
resources. The SQL probe additionally breaks work into query units by kind —
reads, writes, analytics, write-replay — which is the single most useful view
in the game, because "41% of your cluster is write replay" answers *what to
buy* in a way that a CPU percentage never can. An insight card teaches the
framework once the system is complex enough to need it.

**What counts as bad is a design decision, not a rendering detail.** Every
gauge, probe row and status colour classifies its reading against one shared
table (`Content.BANDS`, applied by `Fmt.level`), so the CPU bar on the canvas
cannot disagree with the CPU row in the panel beside it. The CPU band is
deliberately tighter than the point where things break — amber at 70%, red at
85% — because latency is service ÷ (1 − utilization), so 85% is already 6.7×
the service time. The game goes amber where you should *buy*, not where you
have already lost.

`node test/probes.js [component...] [--profile iot]` renders these panels as
text for eyeballing without a browser.

*Serves: readable consequences (every mechanic is inspectable at its source),
and it teaches "what would you monitor?" — an interview question that is really
asking "do you know what constrains this?"*

### The Guru (advice on demand)

A button in the lower right opens a live-updating diagnosis of the board. It
answers the question players actually have — *"CPU is pegged; do I buy a bigger
box or shard again?"* — by looking at **where the work is going**, not just how
much of it there is. The panel leads with a load breakdown bar (reads / writes /
analytics / write-replay as fractions of cluster work), then up to four ranked
cards: headline, explanation, recommended action.

Nineteen rules, ordered by urgency, each reading live numbers. (The
`needReplica` rule exists because playtesting found the gap: a player pegged on
a read-heavy workload with zero replicas was told "bigger box" when the answer
was the classic first horizontal move. Adding one replica dropped CPU 86%→66%
*and* connections 266%→94%, because node count raises both ceilings — a lesson
the game now teaches with its own insight card the first time you buy one.) The same "CPU
pegged" situation produces different advice depending on the diagnosis:
analytics-dominant says *buy a warehouse, and note that sharding again makes
fan-out worse*; write-dominant says *shard, because caches and replicas cannot
take writes*; tier 6 says *vertical scaling has ended, there is no tier 7*;
anything below tier 6 says *bigger box is simplest and needs no redesign, but
plan the split*. When nothing is wrong, the last rule predicts the next wall
("roughly 42s before utilization reaches 85%").

The panel does not pause the game and updates four times a second, so buying
the recommended fix visibly changes the advice — the feedback loop is the
lesson. *Serves: readable consequences (naming the bottleneck and the reason),
and it is the game's answer to "I don't know what I don't know".*

### Management memos (the normative voice)

Insight cards explain *how systems work*; memos say *what you should have done*,
in the voice of people who sign the invoices. Thirteen triggers watch for
specific mistakes and specific hesitation — a bigger box bought at 12%
utilization, a cache stuck under a 35% hit rate, a second datastore adopted for
a rounding error of traffic, resharding mid-fire, sixty seconds of doing nothing
while the graphs are red — plus one backhanded-praise trigger so success is not
silent.

Each memo composes from three `Flourish` decks (sender × subject × barb),
giving ~4,650 distinct panels from ~130 hand-written lines. `Flourish` draws
without replacement and reshuffles only when exhausted, because the failure
mode of a plain random pick is hearing the same joke twice in a row. Decks are
per-game so runs stay seeded and reproducible.

Memos never pause the game — they slide in as paper memos over the map, three
at a time, auto-dismissing. Management interrupting a fire is the joke; making
the player click through it would not be. A 📣/🔇 toggle mutes them.

*Serves: readable consequences (naming the specific mistake at the moment it is
made), comedy (the release valve for a run going badly), and escalating
commitment (memos about hesitation push the player to act rather than turtle).*

### Money bar

A stacked bar above the charts shows burn broken down per subsystem against a
revenue marker: segments left of the marker are covered by revenue, anything
past it is runway being spent. Hovering a segment names what its fixed cost
actually buys ("a SECOND datastore: new expertise, new oncall, new failure
modes"). When burn exceeds revenue it shows the runway clock. *Serves: readable
consequences (you can see which subsystem is eating the company), loss
aversion (the runway counter).*

## Events (Variable Reinforcement)

Milestone-triggered (guaranteed story beats) and random (weather):

- **Hacker News frontpage** (~1k RPS): 5× traffic, 30s — the original hug of death.
- **Bad deploy: connection storm**: app servers reconnect, 10× connection demand, 15s.
- **Celebrity signup: hot key**: cache effectively one node for 20s (hot keys don't shard).
- **Report day**: ANALYTICS share ×4 for 20s.
- **Cache node reboot**: hit rate → 0 for 5s; thundering herd.
- **Replica falls behind**: one replica out, 20s.
- **Black Friday** (~100k RPS): 3× traffic, 60s.

## Win / Lose

- **Win**: sustain ≥ 1,000,000 served RPS with < 1% errors for 30 consecutive
  seconds → IPO screen, replaying all collected Insights as a crib sheet.
- **Lose**: bankruptcy (cash below zero with negative income), or busto —
  users bleed out (below 5% of peak, or near-zero outright) after error churn
  does its work. The post-mortem names the component that started the death
  spiral. (Near-Miss Architecture: the post-mortem shows the chart of your
  final minutes and the moment it tipped.)

## Strategies

- **Early game**: indexes first (huge cheap win), pooler before ~500 RPS or the
  connection storm event kills you at low CPU. Teaches: cheap software fixes
  before hardware.
- **Mid game**: cache + a replica carry reads to ~50k RPS; vertical tiers buy
  time. Tension: replicas vs cache money. Write growth quietly erodes replica
  headroom (they replay writes) — the player who only watches reads gets
  surprised. KV offload is the cheap 15% relief valve.
- **Late game**: vertical scaling hits the tier-6 wall; only sharding scales
  writes. Resharding costs a capacity dip, so the recurring tension is *reshard
  early (pay now, safely) vs late (pay under fire)*. ANALYTICS fan-out punishes
  over-sharding — 32 shards make report day scary, so shard count is a real
  decision, not a monotone ladder.
- **Anti-strategy: turtle on one big box** — prevented mechanically: tier 6 max
  capacity is far below 1M RPS demand; growth doesn't stop.
- **Anti-strategy: cache everything and forget writes** — prevented: WRITE and
  ANALYTICS are uncacheable and grow with the same user curve; cache hit caps
  at 92%.
- **Anti-strategy: ignore events, buy only steady-state capacity** — prevented:
  milestone events are guaranteed and sized (5×) to exceed steady-state
  headroom; error-driven reputation loss compounds.
- **Anti-strategy: buy everything instantly** — prevented by run-rate: idle
  capacity burns cash; overbuying early bankrupts (income scales with served
  traffic).

## State Model (fits in a struct)

```js
{
  t, users, peakUsers, cash, reputation,        // scalars
  infra: { tier, indexes, pooler, replicas,     // player-built architecture
           cacheNodes, kvNodes, shards, writeQueue },
  migration: { ticksLeft } | null,              // shard split window
  backlog,                                      // queued write units
  event: { key, ticksLeft } | null,
  prevLatency: { read, write, lookup, analytics }, // for Little's law gate
  insights: { [key]: true },                    // collected cards
  history: [ {t, rps, served, errors, p50, p99, cash} ],  // charts
  outcome: null | 'won' | 'lost'
}
```

Every mechanic above reads/writes only these fields.

## Tuning Notes

- All capacity numbers live in `content.js` and are first-guesses at real-world
  magnitudes (Postgres-ish: ~5k query-units/s and 200 connections at tier 1,
  Redis-ish: ~100k ops/s per cache node). Halve/double from playtests.
- The headless bot in `test/sim.js` must be able to win with sensible play and
  must lose when it skips the pooler — both are asserted, so tuning changes
  that break the teaching beats fail the sim.
- `node test/trace.js` is the line between *retuning* and *breaking*. It runs a
  scripted build-out across every profile and diffs the result against
  `test/trace.golden.txt`. A refactor must leave it byte-identical; a
  deliberate balance change is `--save`, and the diff in that commit is an
  exact record of what the change did to the game.
