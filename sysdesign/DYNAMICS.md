# LOAD BEARING — a systems architecture simulator

You are handed a service to build and an empty board. Draw the system this
workload needs, press **Go Live**, and keep it inside its service level
objectives while it grows. When the run ends you get the architecture review.

Inspired by `../dbdesign` (HUG OF DEATH), which is the same emotional loop
scoped to one database. This generalizes it: everything dbdesign's shop sold is
now a set of upgrades *inside* the relational box, and the board around it is
the rest of the architecture. Component coverage follows Donne Martin's
[system-design-primer](https://github.com/donnemartin/system-design-primer),
with the parts of the job that postdate it — edge compute, streaming and change
data capture, autoscaling and load shedding, and model serving — folded in.

## Theme

**You are operating it, not sketching it.** Nothing here is hypothetical: the
traffic is real, the pager is real, the bill arrives every second. The question
the game asks over and over is whether you can name the constraint before it
names you — which component is currently load-bearing, and what happens to it
when tomorrow is twice as big as today.

The interview-prep value is a consequence rather than the framing. The
architecture review at the end is the one you would get at work; its seven lines
happen to be the seven things a system design interview is listening for, and the
field notes you collect are written in the words you would use to explain them
out loud. But you get there by running a system, not by drawing one.

## Key Drivers

1. **Readable Consequences** — you must be able to *see* where the system hurts:
   which box is filling, which class of traffic is filling it, whether the
   database died of CPU or of connections, why p99 moved when nothing else did.
2. **Escalating Commitment** — success causes load. Fast responses grow the user
   base; the user base generates the traffic that breaks the architecture. Every
   crisis is triggered by one of your own victories.
3. **Scarcity of Agency** — money. Every component has a purchase price and a
   run-rate, and every one is double-edged, so spending on the wrong fix is a
   real loss and not just a slower win.

## Key Mechanics (one per driver)

- **The board is the struct** (readable consequences). Every box on the map is a
  station with a live utilization bar, a node count and an arrow for every class
  of traffic that actually reached it this tick. Arrows come from what the engine
  routed, not from what you own — so a component you bought and never sent
  anything to has no arrow, which is itself the diagnosis.
- **The brief and the error budget** (escalating commitment). The scenario names
  a target rate, a p99, an availability figure, a cost ceiling, a consistency
  requirement and a durability requirement. The availability figure becomes a
  spendable **error budget**: 99.9% is not a promise never to fail, it is
  permission to fail one request in a thousand, and the bar showing how much of
  that you have burned is the run's real health meter.
- **Fixed cost and marginal cost** (scarcity of agency). Every subsystem bills in
  two parts: a **fixed** amount the moment you own any of it — the team who knows
  it, the dashboards, the on-call rotation — plus a small amount per node. The
  first node of anything is expensive; the tenth is cheap. That step function is
  the entire argument against "let's just add one more database for this one
  feature", and it is why the guru refuses to adopt a system whose fixed cost is
  more than about a third of current revenue.

## Eight boxes, and no service uses all eight

A finished system design is **five to seven components**. More than that is a
shopping list, not a design. So the board holds only things that answer a
question about what the system *does*:

| box | the question it answers |
|---|---|
| **CDN / EDGE** | what can be served without reaching us at all? |
| **APP SERVERS** | where does our code run? |
| **CACHE** | what do we remember quickly? |
| **DATABASE** | what do we remember truthfully? |
| **MESSAGE QUEUE** | what happens later rather than now? |
| **OBJECT STORE** | where do the big files live? |
| **SEARCH & ANALYTICS** | what answers a query the store of record answers badly? |
| **INFERENCE** | what answers with a model? |

Load balancers, DNS, connection routing, socket gateways and the rest of the
plumbing are real and are **not decisions** — they are folded into the box they
belong to. A load balancer is how an app tier has more than one instance, not
a component you choose.

Two things that used to be boxes are now **engines inside** one. A key-value
store is a query-shape decision inside the database ("do key lookups belong on
a relational engine?"), and search, analytics and vector retrieval are three
engines sharing one derived-store fleet ("what needs its own copy of the data,
shaped differently?"). Drawing those as separate rectangles answers the
interesting question before it has been asked.

**The board only draws boxes this workload could use**, and a finished design
uses fewer still. Across the eight services the board is 6–7 boxes and the built
design is 5–7 — measured, not asserted; `test/sim.js` reports both.

## The design phase

You start with **nothing built**. No app tier, no database, no clock, no
traffic, and no bill. You spend seed cash drawing an architecture — and the
money bar already shows what it will cost, which is the number people discover
last — and then press **Go Live**.

The button is disabled until there is somewhere to run code and somewhere to
keep data, because those two are not judgement calls. Everything else is: build
too much and you burn runway before there is revenue; build too little and the
first milestone event finds out.

The guru has a rule for this phase, and it is the most useful thing it says all
run: it reads the workload mix back to you and names what each shape of work is
going to want.

## The Simulation

One idea, and everything else is a consequence of it:

> A **class** of traffic walks a **route** of hops through **stations**.

A hop consumes `units` of a station's capacity, may **absorb** a fraction of the
traffic there (a cache hit, a CDN hit), and may **ack** — meaning the user gets
their answer at that hop and everything after it is asynchronous.

`Engine.tick` is four steps over that:

| step | what happens |
|---|---|
| **pass 1** | walk every route to find how much work each station is *asked* for. Nothing is decided. |
| **shed** | if load shedding is armed, compute the exact excess and throw it away at the front door, before it costs anything downstream. |
| **admit** | each station decides what fraction of arrivals it can take. |
| **pass 2** | walk the routes again applying admissions, accumulating latency, and recording where each request was answered. |

Latency is **additive along the walk**, and each hop pays the queueing tax
`service ÷ (1 − utilization)`. Nothing asserts the hockey stick; it falls out.
p99 is a real percentile over the paths requests actually took, which is why a
cache hit and a cache miss are visibly different experiences and why a 2% class
that is slow can own your tail latency all by itself.

Only one station is not generic. The relational database has the parts an
interview is actually about — connections that are *held* rather than consumed,
replicas that can only take reads, a write-replay debt, and a backlog that turns
failure into staleness — so `sqlAdmission` is written out in full and documented
as the exception.

### Traffic classes

| class | shape | its home |
|---|---|---|
| READ | small, hot, repeated | cache, then edge |
| WRITE | unique, uncacheable, unreplicable | more primaries, or a log in front |
| LOOKUP | huge rate, no joins ever | key-value store |
| MEDIA | almost pure bytes | object storage behind a CDN |
| SEARCH | a scan on a row store, a lookup on an index | inverted index |
| ANALYTICS | 1% of requests, 60× the work each | columnar lakehouse |
| REALTIME | sockets, not requests | realtime gateway + queue |
| INFERENCE | two orders of magnitude more expensive than anything else | anything that avoids the call |

Request counts lie; work is what fills a cluster. Analytics is under 3% of
requests in every brief and can still be most of the database.

## Services (the level design)

One is rolled per run, with jitter on the mix. The brief decides which
architecture wins — this is "the first question you ask in the interview", made
mechanical.

| brief | signature | target | p99 | the shape that wins |
|---|---|---|---|---|
| URL shortener | LOOKUP 82% | 900k/s | 60ms | a redirect is a key lookup with total repetition; cache and KV carry it and the database is nearly a bystander |
| Social photo feed | READ 44% · MEDIA 30% | 700k/s | 240ms | two workloads in one — bytes on a CDN over object storage, rows in a cache over shards |
| Chat / messaging | REALTIME 52% · WRITE 24% | 600k/s | 110ms | connections, not requests: push delivery, a queue to fan out, key-value lookups for presence |
| Video streaming | MEDIA 86% | 260k/s | 320ms | almost pure egress — the CDN hit ratio is the P&L, not a performance number |
| Ride-hailing dispatch | WRITE 52% | 550k/s | 130ms | a write firehose with a geographic key; sharding is mandatory and hot cells are the catch |
| Ad exchange | LOOKUP 64% | 1.0M/s | 45ms | the deadline is the design: everything must be a key lookup and anything slow must be dropped, not waited for |
| Flash-sale commerce | READ 44% · WRITE 28% | 420k/s | 240ms | browsing caches and checkout does not; a queue in front of the write path is a trap without idempotent consumers |
| AI assistant (RAG) | INFERENCE 50% | 24k/s | 2600ms | unit economics *are* the architecture — semantic cache, small-model routing, retrieval |

Two profile-scoped numbers make the differences bite: **repetition** caps the
achievable cache hit rate (a cache on telemetry is RAM-shaped cash on fire), and
**revenue per request** differs by business, so the budget curve is shaped by the
workload rather than by the clock.

## Components

Thirty-two purchases across the eight boxes plus two cross-cutting concerns.
Each is one decision, and each is double-edged.

**CDN / EDGE** CDN points of presence · edge compute
**APP SERVERS** instances · autoscaling · push delivery · load shedding · rate limiting
**CACHE** nodes · request coalescing · hot-key replication · semantic cache
**MESSAGE QUEUE** queue partitions · idempotent consumers · change data capture
**DATABASE** indexes · connection pooler · key-value engine · box size (tiers 1–12) · read replicas · shard splits · multi-AZ failover
**OBJECT STORE** object storage · pre-signed direct transfer
**SEARCH & ANALYTICS** fleet nodes · inverted index · columnar copy · vector index
**INFERENCE** self-hosted accelerators · continuous batching · small-model routing
**CROSS-CUTTING** telemetry · additional regions

Three structural rules hold the shop together:

- **Fleets double.** Every horizontal component is bought by doubling it. Click
  count stays logarithmic, and it matches how capacity actually arrives: in
  chunks, priced by what you already have.
- **Ceilings are absurd on purpose.** Up to 128 shards, 16k service instances,
  512 accelerators. Over-provisioning has to be *reachable* for its cost to teach
  anything — you should be able to find out that a cache stopped paying by buying
  one that does.
- **Everything scales back down, and nothing is refunded.** What you get back is
  the run-rate. Sharding is the one-way door.

### Two decisions worth calling out

**Rent or own the model.** With no accelerators, inference goes to a hosted API:
zero fixed cost, a hard provider quota, and a price per request. Self-hosting is
a large fixed cost, real operational weight, and a much lower marginal price —
but only if you can keep it busy, which is what batching, routing and semantic
caching are for. The first order is sixteen accelerators rather than one,
deliberately: it must be an economic decision, not a capacity cliff.

**Telemetry gates the probe.** Hovering any box asks it the four golden signals.
With no telemetry you learn what is arriving and what it bills, and nothing about
why it hurts. Metrics add saturation and errors; tracing adds where the
milliseconds go. "What would you monitor?" is really "do you know what constrains
this?", and here you find out by not having bought it.

## Events

Milestone events fire once at a fraction of the brief's target and are guaranteed
story beats: **front page of everything** (4× traffic), **launch day**, **peak
hour**. The rest is weather: connection storms from a bad deploy, a hot key that
does not spread across nodes, a cold cache and its thundering herd, a bad CDN
purge, a lagging replica, quarter-end reporting on production, a lost
availability zone, a scraper flood, an accelerator shortage, a degraded region.

Two of those — the zone and region failures — are gated behind scale. A zone
failure at nine hundred requests per second is not a lesson about redundancy, it
is a coin flip landing on a startup that could not have afforded a second node
yet.

## Pace

**`GROWTH_RATE` is the single most important number in the game.** At reputation
100 the user base doubles every ~28 seconds, which makes a full run six to nine
minutes. That interval is the reaction window between a gauge going amber and it
pegging, so it has to be long enough to read a probe, think, and decide. At the
original 14 seconds the only viable play was pattern-matching, which is not the
skill the game exists to build.

Speed controls (2×, 4×, pause) exist because a simulator that respects your time
is different from one that moves fast. Skip the quiet stretches; slow down when
something is filling up.

## Win / lose

- **Win** — hold the service's target rate with under 1% errors *and* p99 inside
  the target, for 30 consecutive seconds.
- **Lose** — bankruptcy, or the users bleed out after error churn does its work.

Either way you get the scorecard. Losing is not a dead end: a post-mortem that
names the component that started the spiral is most of what the run was for.

## The architecture review (this is the point)

Seven dimensions, graded from accumulators kept *while the run happened* rather
than from the final screenshot — a system that was right for the last ten seconds
and wrong for the previous six minutes should not review like a good system,
because in the incident channel it did not behave like one.

The review closes by naming **what the workload actually wanted**, which is the
sentence the whole run was a long way of asking for.

| line | the question |
|---|---|
| Requirements met | did it do what the brief asked, at the scale and latency it named? |
| Capacity planning | did you provision ahead of the wall, or arrive after it? |
| Component fit | is each class of traffic served by the thing shaped for it? |
| Bottleneck handling | when it broke, did you find the constraint and clear it quickly? |
| Tradeoffs named | did you meet — and survive — the decisions that have two sides? |
| Operability | could you see it, and could it survive losing a piece of itself? |
| Cost discipline | would the business have signed off on this bill? |

These are, deliberately, the seven things a system design interview listens for.
A run that reviews well is an answer that would read well out loud.

Component fit is measured in **units of work landing on the wrong box**, not in
purchases, because buying a search cluster you never route to is not the same as
using one — and because declining to adopt a system for a rounding error of
traffic is the correct answer, not a gap.

## The Guru

A live diagnosis of the board, ordered by urgency. It leads with where the
database's work is actually going, then up to four ranked cards: headline,
explanation, recommended action, and a button that makes the purchase.

Thirty-three rules in six bands, and the band order is itself a claim about
system design:

0. **nothing is built yet** — read the workload, name what it wants
1. **the run ends here** — runway
2. **acute failure** — single points of failure, connection starvation, unindexed reads
3. **work in the wrong place** — moving it is cheaper than buying capacity to do it badly, so these outrank every "widen the tier" rule
4. **the box is full** — and *which* fix depends on **what** filled it
5. **fast enough is a requirement too** — latency shaping
6. **the cheap moves, while they are cheap** — proactive offload, telemetry, coalescing

The same "the database is pegged" situation produces different advice depending
on the diagnosis: write-dominant says shard, because caches and replicas cannot
take a write; analytics-dominant says move reporting off and note that sharding
makes fan-out worse; the top of the vertical ladder says money has stopped being
the answer. When nothing is wrong the last rule predicts the next wall.

Two things the guru knows that a shop button cannot express: **affordability is
three questions** (can I pay the price, can I carry the run-rate forever, and am
I adopting a system or widening one I already run), and **some advice is to turn
something off** — the batching that is costing you latency you are not using, the
subsystem eating a runway you no longer have.

*The headless bot in `test/sim.js` plays from exactly these rules.* The advice is
not a separate opinion about the game: if the guru is wrong, the bot stops
winning and the sim says so.

## Management memos

Insight cards explain how systems work; memos say what you should have done, in
the voice of the people who sign the invoices and answer the phones. Fourteen
triggers watch for specific mistakes — media in the database, search as a table
scan, a cache stuck under a 35% hit rate, a tier on one node, no telemetry at
scale, a duplicate-charging queue on a strong-consistency brief, sixty seconds of
doing nothing while the graphs are red — plus one backhanded-praise trigger so
success is not silent.

Each memo composes from three `Flourish` decks (sender × subject × barb). Decks
draw without replacement and reshuffle only when exhausted, because the failure
mode of a plain random pick is hearing the same joke twice in a row. Memos never
pause the game; management interrupting a fire is the joke, and making you click
through it would not be.

## Files

```
content.js   SIM constants, bands, stations, traffic classes, briefs, the shop
catalog.js   events, insight cards, the rubric      (extends Content)
memos.js     management memo triggers and decks     (extends Content)
engine.js    the simulation. No DOM. Engine.tick(state) → state.report
guru.js      ranked diagnosis rules; also the bot's brain
score.js     run log → rubric grades → the scorecard
ui.js        everything on screen. Reads state and report, writes neither
index.js     bootstrap and game loop
```

Load order is a single chain: `content → catalog → memos → engine → guru →
score → ui → index`. Classic `<script>` tags, no modules, so `index.html` opens
by double-clicking. `Content`, `Flourish`, `Fmt` and `Engine` are declared with
`var` rather than `const` on purpose — the require-guards in the Node path
redeclare them, and a lexical global would collide the moment both load as
classic scripts.

## Verifying

```
node test/sim.js               every service, bot-played, must win   (asserted)
                               ...and reports board size and design size per service
node test/sim.js --seeds 4     ...across four seeds
node test/sim.js feed --verbose one service with a purchase log
node test/trace.js feed --rich  the tuning instrument: money and stations over time
node test/trace.js --golden     every brief, diffed byte-for-byte against the golden
node test/trace.js --golden --save   re-record a deliberate balance change
node test/smoke.js             boot the real UI headlessly and drive all of it
node test/screenshot.js        the same, in a real browser, with screenshots
```

Two things `sim.js` asserts and that must stay true:

1. sensible play wins **every** service
2. the same play **without** the connection pooler does not

`trace.js --golden` is the line between *retuning* and *breaking*. A refactor
must leave it byte-identical; a deliberate balance change is `--save`, and the
diff in that commit is an exact record of what the change did to the game.

`screenshot.js` needs a working headless Chrome; it cannot run in the current
sandbox (no libglib), so browser verification is a local step.

## Tuning notes

- Every number is a first guess at a real-world magnitude — Postgres-ish
  (~6k query-units/s and 200 connections at tier 1), Redis-ish (~120k ops/s per
  cache node), an accelerator at ~55 requests/s before batching. Halve and double
  from playtests.
- Revenue is set so the bare-minimum stack breaks even at a few hundred
  requests/second and a good build at target earns roughly 2.5× its cost ceiling.
  This ratio is the most sensitive knob in the game: too tight and the early
  economy becomes a knife-edge where one purchase decides the run.
- The autoscaler targets ~50% busy and reacts in 12 seconds. Both matter more than
  they look, and both are relative to `GROWTH_RATE`: at a 20-second time constant
  against 14-second doublings the app tier is permanently behind, which pins
  the board red and makes every other lesson invisible behind it. Change the pace
  and these two have to move with it.
- Bump the `?v=` query strings in `index.html` whenever CSS or JS changes, or a
  cached asset will be served instead.

## Deferred

- **No save/restore.** Prototype: state is not persisted and there is no
  versioning.
- **Microservices as an axis.** Splitting the app tier into independently
  scaled services — a real interview topic, with a real cost in hops and
  operational surface — is not modelled.
- **Multi-region is thin.** Regions currently buy availability and cost; they do
  not yet model geographic latency for distant users, or the write-conflict
  question that active-active actually forces.
- **Shard keys.** Sharding is a count, not a choice of key, so hot-shard skew is
  only represented through the hot-key event rather than through a bad key
  decision you made earlier and have to live with.
