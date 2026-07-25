# SOLVER.md — Proposal: solver-assisted planning for the sharded-queue migration

*Draft technical proposal. Not interview material — this is what I'd put on the table once I'm in the building and the numbers below stop being placeholders.*

## Summary

"Migrate thousands of job classes onto sharded queues" ends in a combinatorial assignment problem, and that problem is being solved today whether or not anyone names it — by spreadsheet, tribal knowledge, and incident retro. The incidents are the error messages. This proposal: state the constraints explicitly, let a solver (Z3 / OR-Tools / any ILP) produce the full layout — shard count, queue placement, worker attachment, job routing — and get the infeasibilities from the solver at planning time instead of from a bank cutoff at 2am. Nothing on the hot path changes — the solver runs offline and emits a routing table.

---

## 0. A concrete example before the formalism

**The landscape, in one paragraph.** Sidekiq is Ruby's standard background-job system, and its layers nest like this: a **job class** is application code (`PaymentDispatchJob` — "send this payment"). Enqueuing one pushes a record onto a **queue**, which is a named list living inside **Redis**, an in-memory datastore. **Worker pools** — fleets of Ruby processes — pull from those queues and execute the jobs. One Redis instance normally hosts *all* the queues, and Redis is single-threaded, so one CPU core is the ceiling on total queue traffic; outgrow it and you must split the queues across multiple Redis instances — the **shards** of this migration. Properties like a latency SLO ("this job must start within 5 seconds of enqueue") belong to job classes and their queues; capacity limits belong to shards. The whole game is packing the former onto the latter without any limit breaking.

**The one coupling to hold onto while reading.** The headline decision is where job *records* get sent — which shard each job class enqueues to. But worker pools attach to shards, so that same decision simultaneously fixes which workloads share a Redis core *and* which can ever share worker capacity: workers on shard A cannot help drain shard B, no matter how idle they are. Choosing where jobs go drags the entire worker topology along with it — and moving workers has its own price, since every worker process carries its own Redis connections and fetch traffic. That welding — one assignment fixing the capacity-sharing structure of the whole system — is what makes each placement decision heavy, and the migration a planning problem rather than a config change. (§1 breaks the "one assignment" into its four coupled variable families.)

*(Numbers illustrative — swap in real ones from Datadog.)*

**The decision as it happens today.** A team ships `QuarterlyFilingRecalcJob`: fans out per-tenant, ~40k jobs in a burst at quarter close, p99 service time 90 seconds, hits Postgres hard. It needs a queue, and the queue needs a shard. The engineer opens the Redis dashboard, sees shard 2 has the most free memory, and routes it there. Review approves — nothing in the diff looks wrong, because the constraint that matters isn't *in* the diff.

**Why that goes wrong.** Shard 2 also hosts `PaymentDispatchJob`, which has a 5-second queue-latency SLO tied to bank cutoff windows. Free memory was never the binding constraint — Redis command throughput and worker-pool contention were. At the next quarter close, the recalc burst saturates shard 2's single Redis core; `PaymentDispatchJob`'s dequeue latency climbs; payments miss a cutoff window. The retro concludes "we should be more careful about queue placement," which is a vibe, not a control. Nothing prevents the next team from making the same class of mistake on shard 5 — the knowledge lives in the heads of whoever attended that retro.

Note what failed: not effort, not competence. The engineer checked the constraint they could *see*. The placement decision actually depends on six or so interacting constraints across every shard — memory, command rate, latency-class separation, ordering affinity, tenant blast radius, downstream connection budgets — and no human holds that product in their head while shipping a feature. Every placement made this way is a guess that happens to have worked so far.

**The same decision with a solver.** The new job class is one row of parameters: arrival shape (40k burst at quarter close), p99 service time, payload size, no ordering dependencies, latency class "batch." Re-solve with minimize-moves. Three possible answers, all better than the dashboard glance:

- **"Shard 4."** — with every stated constraint checked against every shard, including the ones the shipping engineer never heard of. The certificate is the code review.
- **"Shard 4, and move `NightlyLedgerSyncJob` from 4 to 1."** — the burst fits nowhere as-is, but one cheap move creates room. A human never finds this answer; the solver returns it by default.
- **UNSAT: no placement satisfies the stated constraints without more capacity.** — the fight about adding a shard happens *now*, in planning, instead of at quarter close as a payments incident.

Same decision, same inputs someone was already eyeballing — but checked against all of the constraints instead of the one visible on a dashboard, with the answer reviewable and the reasoning kept. Now generalize from one placement to thousands, under a live migration. That's the rest of this doc.

---

## 1. Problem statement

**Four families of decisions, one problem.** What looks like "pick a shard for each job" is really four coupled families of variables: (1) **shard topology** — how many Redis instances, at what size; (2) **queue → shard placement** — which queues live together on which instance; (3) **worker assignment** — which pools attach to which shard, and processes × threads for each; (4) **job class → queue mapping** — mostly dictated by semantics (SLA class, ordering requirements), but a genuine choice wherever multiple compatible queues exist. The temptation is to treat these as four problems and solve them in order. They aren't separable: the binding constraints cross the layers — SLO feasibility alone ties arrival rates (family 4) to queue placement (2) to worker counts (3) to Redis headroom (1) in a single inequality. Solve them sequentially and layer 3's answer breaks layer 2's assumptions; that iteration loop is where whiteboard planning dies at this scale. A solver takes the couplings jointly — which is most of the argument for using one. (*Jointly* constrains the model, not the architecture: a decomposition that alternates queue placement and worker sizing with feasibility cuts between them is still joint planning. What's ruled out is solving the families independently and hoping. Whether one formulation or an iterating pair performs better is an engineering call to make against real data, not in this doc.)

**Given:** thousands of Sidekiq job classes, dozens-to-hundreds of tenants of wildly different sizes, a worker fleet, and N sharded Redis instances (N itself a decision variable).

**Produce:** an assignment across all four families — shard count, queue placement, worker attachment and sizing, job routing — such that every operational constraint holds, before production discovers a violation for us.

The constraints exist whether or not anyone writes them down:

- **Capacity:** per-shard command throughput ≤ what one Redis core sustains (the single-threaded ceiling is a *number*, not a vibe). Per-shard memory ≤ instance memory, given queue-depth × payload-size worst cases.
- **Latency-class isolation — two constraints, not one:** job classes with a 5-second queue-latency SLO don't share a *worker pool* with 2-hour batch jobs (head-of-line blocking, priority inversion), and separately may not share a *shard* with them (Redis command contention). These are different levers with different costs: two queues can share a Redis instance on separate worker pools — no head-of-line blocking, but still competing for the shard's single core — so the model states pool isolation and shard isolation independently instead of fusing them into one prohibition.
  *Head-of-line blocking: with a shared worker pool, the 5-second jobs end up waiting behind 2-hour jobs that got there first — nothing is broken, the urgent work just can't get a worker. Priority inversion is the same disease by its formal name: low-priority work holding the resource that high-priority work needs.*
- **Affinity:** job classes with mutual ordering requirements must co-locate.
- **Anti-affinity:** known noisy tenants/job classes must not co-locate (blast radius, noisy neighbor).
- **Demotion paths:** queues that bulk-move jobs into each other as incident remediation must co-locate. Today, when someone dumps 40k accounting jobs into the 5-minute queue, the escape valve is demoting the flood to the 30-minute queue — on a single Redis that's a cheap same-instance list operation. Put those two queues on different shards and the valve becomes a non-atomic cross-shard bulk transfer, performed mid-incident, with new tooling. This constraint only matters during an incident, which is exactly why hand-planning forgets it.
- **Downstream limits:** Σ(worker processes × threads) per database ≤ connection pool capacity. Scaling workers to drain a shard faster must not knock over Postgres.
- **Worker-side Redis load:** workers aren't free riders on the shard they poll. Every Sidekiq process holds a fistful of Redis connections, and its fetch traffic is configuration-dependent — blocking fetch, `super_fetch`'s scanning, and queue weighting all produce different command loads — so the model budgets *measured* command load per worker configuration rather than assuming a universal polling formula. Σ(connections + fetch traffic) per shard is bounded either way: a shard can be sunk by its own consumers, not just by its job traffic — worker sizing is a Redis capacity constraint, not just an SLO lever.
- **SLO feasibility — scenario-based, not average-rate:** the tempting formulation is Little's law as an inequality per queue, and it's wrong here. Little's law relates long-run *averages*; it cannot bound a p99, and it's blind to exactly the case that motivates this doc — a queue receiving one job per second steadily and one receiving 3,600 at the top of the hour have identical averages and nothing else in common. So the constraint is temporal: over time buckets, `backlog[q,t+1] ≥ backlog[q,t] + arrivals[q,t] − service_capacity[q,t]`, with arrivals drawn from *named scenarios* — ordinary peak hour, quarter-close burst, tenant fan-out, one worker pool down, elevated retries, degraded Redis latency — and SLO queues required to clear their backlog within the allowed window under every scenario. This also scopes the claim honestly: the solver proves the assignment satisfies the *encoded scenarios and capacity assumptions* — not that the SLO can never be missed.

Plus soft objectives: minimize shard count (cost), balance load, and — critically for an incremental migration — **minimize moves from the current assignment**, where "moves" covers both queue relocations and worker re-attachments; §2 explains why both are priced.

**A related problem this proposal deliberately does not include:** the redelivery-safety audit — which of thousands of job classes are actually idempotent under Sidekiq's at-least-once delivery. It looks adjacent and shares the LLM-proposes / solver-certifies pattern, but it's an independent verification program with different inputs, models, success criteria, and failure modes, and bundling it would attach a speculative target to a concrete proposal. It lives in a companion doc: `SOLVER-B.md`.

---

## 2. Proposed approach

### Shard assignment (SMT/ILP — this is bin packing with side constraints)

**Division of labor — the LLM-proposes / solver-certifies pattern:**

1. **Input assembly (three categories, three sources):** *measured facts* — arrival distributions, service-time distributions, payload sizes, retry rates, queue depths, Redis command load, database connections — come from telemetry; Datadog is the source of record, not a cross-check on anything. *Declared semantics* — latency class, ordering requirements, approved demotion paths, tenant-isolation rules — come from configuration and owner-reviewed metadata. *Inferred hypotheses* — undocumented affinities, likely external effects — are where the LLM sweep earns its keep: reading 3,000 job classes and flagging what nobody wrote down. Inferred claims enter the model as unverified until an owner confirms them, and every parameter carries provenance — `value: 90s · source: Datadog p99, trailing 30d · confidence: measured · owner: Accounting Platform · last_verified: 2026-07-20` — because without source and freshness, the solver manufactures authoritative-looking output from stale inputs.
2. **Normalization (finding the real unit of assignment):** job classes are the unit of *code*, not of *placement*. Three hundred classes sharing a queue, a latency class, and an affinity profile are one workload group, not three hundred variables; conversely, a single class may need splitting where its largest tenant behaves nothing like its median. The assignment unit is the smallest operationally meaningful combination — roughly (queue semantics × latency class × tenant class × resource profile). This step also carries the tractability load: the scenario-indexed constraints multiply the model by scenarios × time buckets, and aggregation is what keeps that product structured — solvability is a property of structure and symmetry, not raw variable count.
3. **Formulation (one-time human work):** decision variables for all four families — shard count `N`, `place[queue] = shard`, `attach[pool] = shard` with `size[pool] = processes × threads`, and `route[workload_group] = queue`; the constraints above as inequalities over the cross-products, with capacity and SLO constraints indexed by scenario and time bucket; objectives as a weighted sum or lexicographic ordering.
4. **Solve (Z3 / OR-Tools CP-SAT / any ILP solver):** output is a shard map satisfying every encoded constraint under every named scenario — or **infeasibility with an explanation**. The explanation is a product requirement, not a solver freebie: a raw unsat core reads `constraint_482, constraint_711, constraint_923`, and turning that into "tenant-isolation + ≤ 8 shards + this SLO set — pick two" means designing it in — every hard constraint carries an owner and a human-readable label, related inequalities roll up into policy groups, and infeasibility is minimized and reported at the policy-group level (assumption tracking in Z3, assumption literals in CP-SAT, an IIS from an ILP; each needs its own plumbing). One more distinction the tooling must not blur: **INFEASIBLE** ("no solution exists") and **UNKNOWN** ("no solution found before timeout") are different findings, and collapsing them turns a solver limitation into a fake impossibility result.
5. **Execute:** the shard map compiles to a routing table — a hash lookup. Nothing on the hot path calls a solver, ever.

What a "move" actually costs: reassigning a queue to a different shard isn't a config flip. New enqueues cut over to the new shard while workers drain what remains on the old one, and until the drain finishes the queue lives in two places — ordering guarantees are at risk, and a mistake strands or double-runs jobs. That procedure is a **drain-and-cutover**, and every one of them is a small production event.

Worker moves aren't free either. Re-attaching pools en masse is a connection storm: hundreds of processes disconnecting, reconnecting, and re-polling at once can tip over the very Redis instance the move was meant to relieve. So worker re-attachments carry their own cost in the objective, and the ones that do happen execute as throttled ramps, not flips.

**The killer feature for a live migration — incremental re-solve:** as load evolves, re-solve with `minimize(total move cost — queue relocations and worker re-attachments both)` as the objective. Humans re-planning by hand either churn everything or freeze; the solver returns the three moves that restore feasibility and provably leaves the rest alone. Each move is a small production event in its own right, so "fewest moves" isn't elegance — it's directly minimizing operational risk.

---

## 3. What this buys us — implications of having the mapping

The output is easy to underestimate: it's "just" a table — job class → queue → shard, plus a worker attachment plan. The implications aren't in the table — they're in what changes once the table is *certified* and *reproducible*.

**The mapping becomes an artifact, not a decision.** A hand-built shard plan lives in a spreadsheet and someone's head; the reasoning that produced it evaporates the day it ships. A solver-built plan is the output of (constraints + data), both checked into git. We can diff it, review it, regenerate it, and — the important one — *interrogate* it: "why is `PayrollRunJob` on shard 3?" has an answer derivable from the constraints, not "because Dana thought so in Q2."

**Failures change category.** When a hand-built plan melts down, the lesson is "we missed something" — unactionable. When a solver-built plan melts down, exactly one of two things is true: a constraint was stated wrong (bad number, missed dependency), or a constraint wasn't stated at all. Either way the fix is one line in the model, and the re-solve propagates it everywhere at once. The incident retro produces a constraint, not a vibe. Over time the model *accumulates* the org's operational knowledge in checkable form — that's the compounding asset, more than any single shard map.

**Infeasibility becomes visible before production finds it.** This is the implication people miss. A human planner who can't find a valid layout keeps shuffling and eventually ships the least-bad guess. A solver returns UNSAT *with a core*: "tenant-isolation + ≤ 8 shards + this SLO set — pick two." That converts a doomed migration into a negotiation between named constraints, held *before* the drain-and-cutover, with evidence. Nobody gets that from a spreadsheet, because a spreadsheet can't prove a negative.

**Planning becomes a repeatable operation instead of an event.** The migration isn't one shard map; it's a shard map per phase, re-planned as load shifts and tenants grow. With minimize-moves as the objective, every re-plan is a minimal diff against the current world — "move these three job classes, touch nothing else." Capacity planning stops being a quarterly war room and becomes: update the arrival rates, re-run, review the diff like a PR.

**What does *not* change:** the runtime. Workers, Redis, and the enqueue path never know the solver exists — they see a hash lookup that could have been written by hand. All of the above is leverage on the *planning* loop, which is where the actual risk in a sharding migration lives.

Compressed: *the table is the boring part — the point is that the reasoning behind the table becomes explicit, checkable, and re-runnable, so incidents turn into constraint updates instead of folklore.*

---

## 4. Risks, limits, and when to shelve this

**Solve-time vs serve-time — the throughput objection dissolves.** "Do we have time for a CSP at our throughput?" confuses two clocks. The solver runs at *planning* time and emits an artifact; the hot path runs a hash lookup. Forty minutes of solve time against a migration measured in quarters is nothing. High throughput raises the stakes of the plan without raising the deadline for planning — millions of jobs a day is a rounding error to route and a catastrophe to route wrong.

**The solver certifies the model, not the world.** Garbage rates in, provably-optimal garbage out — and there are two distinct ways to rot. Bad *inputs*: the three-category input scheme in §2 concentrates this risk deliberately — numeric facts come from Datadog and semantics from owners, so what remains is the affinity nobody declared and the LLM didn't flag; provenance and freshness fields exist so stale numbers announce themselves instead of hiding. Bad *model form*: a constraint can be honestly sourced and still encode the wrong property — Little's-law-as-average is the canonical trap (§1), which is why the SLO constraints are scenario-based rather than average-rate. The boring oracles — tests, canary shard, dark-launch diff, and above all the incident backtest in §5 — are what close the model-to-world gap. This limitation is load-bearing — the proposal stands or falls on treating it seriously.

**Where a solver does NOT go:** anything real-time. Admission control, dynamic routing under a spike — those get the solver's *precomputed policy*, not the solver. Same division of labor throughout: expensive smart thing offline, cheap dumb thing at line rate.

**When this is overkill:** if the real constraint count is small — say 6 shards, 4 latency classes, a handful of noisy tenants — a competent staff engineer does this on a whiteboard in an afternoon, and the solver is ceremony. The solver earns its keep when (a) the variable count defeats eyeballs, (b) constraints genuinely conflict and we need UNSAT cores to negotiate SLOs, or (c) re-planning is recurring and minimize-moves matters. "Thousands of job classes" reads like the solver-worthy regime, but the honest move is to check the real numbers first and shelve this doc if they're small.

**Cost asymmetry, compressed:** solver time is cheap and offline. A shard-map mistake is discovered as a noisy-neighbor incident, a missed bank cutoff, or a re-migration — and each re-migration move is a drain-and-cutover with its own risk. In a payroll shop the asymmetry isn't subtle.

---

## 5. Cheapest first step: dry-run against the current state — then keep it running

Before anyone commits to solver-driven planning, run it in *check* mode against the world as it already is:

1. Formalize the constraints we claim to care about (a week of interviews and Datadog queries, no code changes).
2. Feed the solver the **current** assignment as a fixed input and ask only: *does today's layout satisfy today's stated constraints?*
3. Two possible outcomes, both useful: **SAT** — today's layout is consistent with today's encoding. Necessary, not sufficient: a model that omits half the real constraints will bless anything, so SAT proves consistency, not predictive power — calibration comes from the backtest below. **Violations found** — each one is a testable prediction ("shard 2 breaches its Redis ceiling if tenant X's batch window shifts an hour"), checkable against history and canary-able.

No routing change ships, no migration depends on it, and the output either builds the case for the full proposal or kills it cheaply. Either result is worth a week.

**Calibration is a backtest, not a SAT result.** The test that earns belief in the model: pick several historical incidents and several known-healthy periods; reconstruct the telemetry as it stood *before* each incident; run the checker blind to the outcome; ask whether it would have warned, how often it false-alarms across the healthy stretches, and whether its predicted capacity margins track observed queue latency and Redis saturation. The demonstration that sells the entire proposal is one sentence long: *"using only data available six hours before the incident, the model flagged shard 2's payment SLO as infeasible under the quarter-close scenario."* And if the checker can't retrodict a single real incident, that's the cheap kill this section promised — better learned in week two than after the first migration wave.

**The dry run never retires — it becomes the nightly health check.** The same check-mode run, on a schedule — with one division of labor that matters: yesterday's Datadog data *updates the measured parameters* (arrival rates, service times, per-configuration fetch load), but feasibility is checked against the *scenario envelopes*, not just yesterday's traffic — yesterday cannot warn about a quarter-close that didn't happen yesterday. Most nights the answer is "still SAT," with margins reported — and that's drift detection: tenant growth eating a shard's headroom gets caught weeks before it becomes an incident, across every constraint at once, including the ones that only matter mid-incident (demotion paths). When the answer is "feasibility at risk," minimize-moves returns the smallest set of moves that restores it — a diff, reviewed like a PR, executed in a quiet window.

The distinction that keeps this sane: *running* the solver nightly and *moving queues or workers* nightly are different things. Computing the map is nearly free; acting on it costs drain-and-cutovers. With the current assignment as baseline and moves as the cost, a nightly re-solve on a healthy system proposes zero moves. The mapping ends up managed like a lockfile — regenerated freely, committed deliberately. And the solver itself never touches the enqueue path; it runs as an ordinary scheduled batch job — fittingly, a low-priority queue job like any other.

## Background

This follows the same LLM-proposes / deterministic-verifier-gates pattern as my Z3/SMT constraint-validation work — the instinct that LLM extraction at scale plus solver certification covers each side's weakness. That work is where the confidence in the inferred-hypotheses lane of step 1 comes from — and it carries directly into the companion redelivery-audit proposal (`SOLVER-B.md`).
