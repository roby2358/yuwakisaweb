# QueueShard — Technical Specification

## Purpose

QueueShard is a browser-based demonstration of the solver-assisted shard-planning approach described in `SOLVER.md`. It applies the LLM-proposes / solver-certifies pattern to a fixed sample dataset of 30 Sidekiq-style job class definitions (plus one held out for the demo's second act): the constraints are stated explicitly, a solver (Z3, running as WebAssembly in the browser) produces the full layout — shard count, queue placement, worker attachment, job routing — and the results are presented graphically so the certified shard map, the minimize-moves re-solve, and the readable infeasibility explanation are each intuitive to a viewer who has not read the proposal.

The app is a planning-time demo. Nothing simulates a hot path; the output of every solve is a routing table and worker plan, rendered visually.

QueueShard reuses the in-browser Z3 integration proven by the sibling project Markdown Is A Solver (MIAS): a vendored classic-script Z3 wrapper bundle, WASM hosted on Cloudflare R2, and cross-origin isolation via path-scoped headers. Unlike MIAS, QueueShard's constraint model is compiled directly from structured job-definition data — there is no user-authored constraint language.

## UI Layout

```
+----------------------------------------------------------------------+
| QueueShard          [Z3 status]                     [Re-solve]       |
+----------------------------------------------------------------------+
| [Stage: 1 Baseline plan | 2 Add a job | 3 Infeasibility]             |
| [stage narration — one short paragraph explaining what this stage    |
|  demonstrates and what the solver was asked]                         |
+----------------------------------------------------------------------+
| +------------------+  +--------------------------------------------+ |
| | Workloads panel  |  | [scenario selector]     [latency legend]   | |
| |                  |  | Shard map (SVG)                            | |
| | queue groups     |  |  +---------+  +---------+  +---------+     | |
| |  - job classes   |  |  | shard 0 |  | shard 1 |  | shard 2 | ... | |
| | constraint list  |  |  |  queues |  |  queues |  |  queues |     | |
| |  by policy group |  |  |  pools  |  |  pools  |  |  pools  |     | |
| |                  |  |  |  bars   |  |  bars   |  |  bars   |     | |
| +------------------+  |  +---------+  +---------+  +---------+     | |
|                       | [db connection bars]   [queue detail]      | |
|                       +--------------------------------------------+ |
+----------------------------------------------------------------------+
| Result panel: verdict (SAT / INFEASIBLE / UNKNOWN), solve time,      |
| move list (stage 2), policy-group conflict explanation (stage 3)     |
+----------------------------------------------------------------------+
```

On viewports narrower than 900 pixels the app MUST show a notice that the demo is desktop-only and hide the main interface.

## Functional Requirements

### Sample Dataset

- The application MUST ship a fixed dataset of 30 baseline job class definitions with realistic payroll-domain names (payment dispatch, payroll run, ledger sync, tax form rendering, webhook delivery, fraud scoring, and similar).
- Each job class definition MUST carry:
  - a name and a one-line description;
  - a latency class, one of: `urgent` (seconds-scale queue-latency SLO), `fast` (sub-minute), `default` (minutes), `batch` (hours);
  - arrival rates (jobs per second) for each named scenario;
  - a p99 service time and an average payload size;
  - a worst-case backlog depth assumption for memory accounting;
  - the downstream database it touches (for connection budgeting), or none;
  - zero or more ordering-affinity group memberships;
  - a tenant profile, including whether it is flagged as a noisy tenant workload.
- The dataset MUST include at least: one urgent job class with a bank-cutoff-style SLO; one large fan-out batch job; one noisy-tenant workload; two job classes related by an ordering affinity; and one declared demotion path between two queues.
- The dataset MUST define named scenarios — at minimum `steady`, `peak-hour`, and `quarter-close` — each supplying per-job-class arrival rates. Scenario arrival rates MUST differ enough that averages and peaks lead to different placements (the "averages lie" point from SOLVER.md).
- The dataset MUST define the normalization from job classes to queues: each job class maps to exactly one queue, and multiple compatible job classes share a queue. The 30 baseline job classes group into 12 queues; the held-out stage-2 job class maps to a 13th. Queues are the unit of placement; the app MUST display the job-class → queue grouping so the normalization step is visible.
- Numeric parameters SHOULD carry provenance annotations (source, freshness, confidence, and owner, in the style of SOLVER.md §2 step 1) shown in detail views, to demonstrate the provenance discipline even though the demo data is synthetic.
- One additional job class — a quarter-close fan-out recalc job modeled on `QuarterlyFilingRecalcJob` from SOLVER.md §0 — MUST be defined but excluded from the baseline dataset; it is introduced by stage 2.

### Constraint Model

- The model MUST cover the four decision families from SOLVER.md §1: shard count (a fleet of six identical candidate shards, further capped per stage), queue → shard placement, worker attachment and sizing per shard, and job → queue routing (fixed by the dataset's normalization; displayed, not solved).
- Worker pools MUST be modeled per (shard, latency class): a pool exists on a shard exactly when at least one queue of that latency class is placed there. Pool sizes are not an independent objective: the reported size (processes × threads) MUST be the minimal value the SLO constraints admit for the certified placement.
- The following nine constraint policy groups MUST be encoded, each tagged with a human-readable label and a short description:
  - **Shard budget:** every queue MUST be placed on one of the shards permitted by the current stage's cap.
  - **Redis command capacity:** per shard and per scenario, total command load — enqueue traffic from placed queues plus per-worker-thread fetch overhead from attached pools — MUST NOT exceed a stated per-core ceiling.
  - **Memory capacity:** per shard, worst-case backlog depth × payload size summed over placed queues MUST NOT exceed instance memory.
  - **Latency-class isolation, two independent levers:** urgent-class queues MUST NOT share a worker pool with batch-class queues (structural, via per-class pools), and urgent-class queues MUST NOT share a shard with batch-class queues.
  - **Ordering affinity:** queues in the same affinity group MUST be placed on the same shard.
  - **Tenant isolation (anti-affinity):** noisy-tenant workloads MUST NOT share a shard with designated protected workloads; under the strict form (stage 3) the noisy-tenant queue MUST have a dedicated shard shared with nothing.
  - **Demotion paths:** queue pairs declared as demotion paths MUST be placed on the same shard.
  - **Database connection budget:** per downstream database, summed threads of worker pools serving queues that touch the database MUST NOT exceed that database's pool capacity.
  - **SLO feasibility, scenario peak-rate form:** for each shard, latency class, and scenario, attached pool capacity MUST cover the placed queues' peak arrival concurrency with a stated headroom factor, and urgent queues MUST additionally be able to drain the scenario's burst backlog within their SLO window. The model uses per-scenario peak rates, not long-run averages, and does not encode time-bucketed backlog recurrences (deferred; see Future Work).
- The objective MUST be lexicographic: first minimize the number of shards used, then minimize total move cost relative to a baseline assignment (skipped in stage 1, where no baseline exists), then balance peak enqueue command load across used shards. The balance objective measures enqueue command load only; worker fetch overhead is enforced in the capacity constraints but excluded from balance. Queue relocations and worker pool attachments/detachments MUST both carry move costs, with queue moves priced higher (drain-and-cutover vs throttled ramp, per SOLVER.md §2).

### Solver Execution

- The application MUST load Z3 WebAssembly asynchronously at page load and reflect its lifecycle in a status indicator with at least the states `Loading Z3…`, `Z3 ready`, `Z3 failed to load`, and `Solving…`.
- Solve controls MUST be disabled until Z3 is ready and while a solve is in flight.
- The model MUST be built via the solver's direct expression API (the MIAS architectural rule): no SMT-LIB string generation.
- A solve MUST produce exactly one of three verdicts, and the UI MUST distinguish all three: **SAT** (a certified layout, rendered), **INFEASIBLE** (no layout exists under the stated constraints — rendered as a policy-group conflict explanation), and **UNKNOWN** (solver timeout or resource limit — rendered as a solver limitation, never as an impossibility). Collapsing INFEASIBLE and UNKNOWN is explicitly prohibited (SOLVER.md §2 step 4).
- Every solve MUST run under a global time budget, with phase-dependent timeout semantics:
  - a timeout during the initial feasibility check MUST yield UNKNOWN;
  - a timeout during optimization MUST return the best certified layout found so far (still SAT — optimality may be sacrificed, soundness never);
  - a timeout while shrinking an unsat core MUST keep the current conflicting set (INFEASIBLE with a possibly non-minimal core).
- On an infeasible outcome the application MUST identify a conflicting set of policy groups (not raw constraint indices) via solver assumption tracking, and SHOULD reduce it toward a minimal set before display.
- Solve time MUST be displayed with each result.

### Stage 1 — Baseline plan

- On first successful Z3 load the application MUST automatically solve the baseline: place all queues, size all pools, minimize shards used.
- The result MUST render as a shard map (see Visualization) and become the baseline assignment for stage 2.

### Stage 2 — Add a job (minimize-moves re-solve)

- Entering stage 2 MUST introduce the held-out quarter-close recalc job class, mapped to a new queue, and re-solve with the stage 1 result as the move-cost baseline.
- The result panel MUST list the moves the solver chose — the new queue's placement plus any relocations of existing queues or pool re-attachments — as human-readable sentences (e.g. "place recalc queue on shard 3; move nightly-ledger queue from shard 3 to shard 1").
- The shard map MUST render the diff visually: moved queues highlighted with their origin indicated, untouched queues de-emphasized, so "fewest moves" is visible at a glance.
- If the re-solve is infeasible at the current shard maximum, the stage MUST fall through to the infeasibility rendering (this is an acceptable and instructive outcome, but the shipped dataset SHOULD be tuned so stage 2 yields a small non-zero move set).

### Stage 3 — Infeasibility with a readable core

- Entering stage 3 MUST apply the stated tightening fixed by the shipped dataset: the shard cap drops from six to four, and strict tenant isolation is enabled (the noisy tenant's queue requires a dedicated shard). No valid layout exists under this combination, and the dataset is tuned so the minimal conflicting set is exactly three policy groups: shard budget, tenant isolation, and Redis command capacity.
- The result MUST display the conflict as a short set of named policy groups with their descriptions, phrased as a negotiation ("shard budget + tenant isolation + Redis command capacity — pick two"), plus the concrete relaxation the demo suggests: raise the shard cap to five while keeping strict tenant isolation.
- The constraint list in the workloads panel MUST highlight the policy groups that participate in the conflict.
- A control MUST let the viewer apply the suggested relaxation and re-solve to a SAT outcome, closing the loop from infeasibility to negotiated fix.

### Visualization

- The shard map MUST render shards as containers laid out side by side, each showing:
  - its placed queues as blocks sized by peak command load and colored by latency class, labeled with queue name;
  - its worker pools as attached chips labeled with latency class and processes × threads;
  - capacity utilization bars for Redis command load and memory: the bar's fill MUST follow the selected scenario, a tick mark MUST show the worst case across scenarios, and near-limit visual emphasis MUST key on the worst case (a shard that is safe today but critical at quarter-close reads as critical).
- Unused candidate shards MUST be visually distinct (empty/ghosted), making "minimize shards" legible.
- A scenario selector MUST switch the load numbers driving queue block sizes and capacity bars between named scenarios (visualization only — the model always enforces all scenarios).
- Co-location requirements (ordering affinity, demotion paths) MUST be visually indicated on the queues they bind (shared badge, link, or grouping); anti-affinity MUST be indicated on the noisy workload.
- Selecting a queue MUST show its detail: member job classes with their parameters and provenance annotations, and the constraint families that reference it.
- Selecting a job class in the workloads panel MUST highlight its queue in the shard map.
- The database connection budget MUST be rendered as a utilization bar per database, aggregated across shards.

### Workloads Panel

- The panel MUST list queues with their member job classes (the normalization made visible), expandable to job-class detail.
- The panel MUST list the constraint policy groups with human-readable labels and one-line descriptions; each group MUST show whether it is active in the current stage.

## Non-Functional Requirements

### Styling

- Dark slate theme with an emerald accent, consistent with MIAS; latency classes use a small categorical palette that remains distinguishable against the dark background.
- The shard map is the centerpiece; chrome around it stays minimal.

### Code Quality

- Organized as ES modules loaded by `index.html`, with no runtime build step for application code. The only build artifact is the pre-bundled Z3 wrapper, vendored as in MIAS.
- Dataset, model compilation, solver orchestration, and rendering SHOULD be separate modules.
- Per project preference, no unit tests.

### Performance

- The Z3 WASM MUST load asynchronously and MUST NOT block initial page render; the page SHOULD render the dataset and an unsolved shard-map placeholder immediately.
- The model size (candidate shards × queues × scenarios, peak-rate form) MUST be kept small enough that feasible solves complete within a few seconds in the browser; the infeasibility stage MAY take on the order of ten seconds, since minimizing a core is a sequence of impossibility proofs. The solver MUST run under a time budget that ends the solve (with the phase-dependent semantics under Solver Execution) rather than hanging the page.
- Solves MUST NOT block the UI thread (the Z3 integration runs checks on a worker thread via cross-origin isolation).

### Deployment

- Ships as a subpath of the parent yuwakisaweb Cloudflare Pages project (`/queueshard/`), deployed by git push; no app-specific deploy script.
- The parent `_headers` file MUST gain a path-scoped entry for `/queueshard/*` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`, mirroring the MIAS entry.
- The Z3 WASM MUST be fetched from the existing R2 URL already used by MIAS; the WASM MUST NOT be committed. The vendored wrapper bundle MUST be committed.
- A local serve script with the same COOP/COEP headers MUST be provided for development, as in MIAS.

## Dependencies

- `z3-solver` — official Z3 WebAssembly distribution, via the vendored classic-script bundle produced by MIAS's bundling approach; WASM on R2.
- No other runtime dependencies; rendering is hand-rolled SVG/DOM.

## Implementation Notes

- The Z3 loading recipe is copied from MIAS and MUST be followed exactly: classic `<script>` tag for the vendored IIFE bundle (never a module — emscripten pthread workers re-load it as a plain worker script), init called with `locateFile` pointing WASM requests at the R2 URL and `mainScriptUrlOrBlob` pointing at the bundle's own URL, one runtime init per page load, fresh context per solve.
- Solver choice: the finite-domain solver (`QF_FD`) proves this model fast but its SAT engine exhausts the WASM build's memory in the browser (a "memory access out of bounds" crash in its goal-conversion layer that does not reproduce under Node against the identical WASM), and Z3's Optimize facility proved too slow. The app therefore uses the default SMT solver, made fast by encoding and orchestration rather than engine selection.
- Placement encoding is one-hot Boolean — one literal per (queue, shard) with a pseudo-boolean exactly-one row per queue — and capacity, memory, and balance constraints are pseudo-boolean sums over those literals. This is load-bearing: with integer placement variables and equality atoms, the default solver's pseudo-boolean propagation is too weak and bin-packing UNSAT proofs take tens of seconds; over Boolean literals they take milliseconds to seconds.
- Two solvers over one model compilation. A symmetry-broken DIAGNOSIS solver (used shards canonicalized to a contiguous prefix — valid for permutation-invariant questions, invalid once a baseline pins shard identities) answers feasibility, extracts the policy-group unsat core via per-group assumption literals, and walks the shard count up from a load-derived lower bound. An OPTIMIZATION solver — symmetry-broken only when no baseline exists — then runs the remaining lexicographic tightening under the proven-minimal shard count: move cost and balance are each reduced by a value-guided binary search on a pseudo-boolean bound, with each objective's achieved value pinned before the next begins, and the balance search floored at the per-shard-average counting bound.
- Core shrinking runs each deletion test on a fresh solver with the kept groups' constraints asserted directly: assumption-guarded constraints block Z3's preprocessing, making weakened UNSAT re-proofs several times slower (Z3's built-in core minimizer has the same guarded cost). The infeasibility stage is the slowest solve (~10 seconds) because minimizing a core is a sequence of proofs that nothing smaller suffices.
- Pool sizes are solver variables during search but the reported sizes are derived after placement is optimized: per (shard, class), the largest scenario demand of the queues placed there — exactly the least solution the SLO constraints admit, valid because pools appear only with positive coefficients in capacity constraints. Pool sizing is therefore never a search objective.
- Products of decision variables (pool size × per-worker load, conditional on attachment) are the main nonlinearity risk — kept linear by summing per-shard indicator-guarded terms with bounded coefficients.
- Move cost in stage 2 is a pseudo-boolean sum over placement literals only: a queue-move literal is the negation of the queue's baseline-shard placement literal, and pool attach/detach literals are expressed over placement (pool existence is placement-forced), so the objective needs no pool variables.
- The global solve budget (20 seconds) is shared across the feasibility, tightening, and diagnosis phases; each solver call gets a slice of what remains.
- The shard map is SVG generated by DOM construction, re-rendered from a plain layout object produced by each solve; the diff view is computed by comparing two layout objects.
- Job-class → queue normalization is data, not solver output, but it embodies SOLVER.md §2 step 2 — the dataset file groups the 30 baseline classes into 12 queues (the stage-2 job brings a 13th) so the model stays small and the grouping is itself a visible teaching point.
- Provenance annotations are shared templates per parameter kind (arrival rate, command load, p99, payload, backlog, SLO, database budgets), not per job class; the queue detail view renders them.
- Dataset tuning is part of the deliverable: stage 1 uses four of the six candidate shards (minimize-shards visible), stage 2 requires one relocation beyond placing the new queue (the §0 "shard 4, and move NightlyLedgerSyncJob" moment), and stage 3's tightening yields the minimal core {shard budget, tenant isolation, Redis command capacity}. An offline script emits the model as SMT-LIB for named checks so these staged outcomes can be certified against a reference Z3 whenever dataset numbers change — the app itself never generates SMT-LIB.

## Error Handling

- Z3 load failure MUST surface in the status indicator with a message naming the bundle and the WASM URL as the things to check.
- A solve whose feasibility phase exceeds the time budget MUST report UNKNOWN with the elapsed time and a note that this is a solver limit, not an infeasibility proof; a budget exceeded later in the solve degrades gracefully instead (best certified layout, or non-minimal core) per the Solver Execution timeout semantics.
- An unexpected solver error MUST surface in the result panel; the previous successful layout, if any, remains displayed.
- Internal dataset inconsistencies (a job class naming an undefined queue, scenario, affinity group, or database) MUST fail loudly at load with the offending name — never silently drop data.

## Future Work

- **Scenario stress view (noted for the next round):** per-scenario, per-shard load timelines showing SLO queues clearing burst backlog within their windows — the time-bucketed backlog-recurrence formulation from SOLVER.md §1, encoded in the model rather than approximated by peak rates.
- Editable job parameters and constraints with live re-solve (a planning playground rather than a staged demo).
- Nightly-health-check framing: drift a parameter over simulated days and show margins eroding before infeasibility.
- Export of the routing table artifact (job class → queue → shard, worker plan) as JSON.
