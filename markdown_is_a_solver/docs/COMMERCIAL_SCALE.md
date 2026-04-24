# Commercial Scale

An opinionated read of where this technology wins in market, and a path from "one record per run" to production throughput.

## What the examples reveal

The nine built-in examples are not just demos — they're market probes. Read across them and a pattern shows up.

The puzzle examples (`easy`, `budget`, `scheduling`) exercise the solver but don't sell anything. They're a teaching ladder. The real commercial signal is in the six domain examples:

- `compliance` (a security-group rule) and `intake` (an order record) look like the same shape: a piece of structured configuration judged against a written policy. The technology is a *policy-as-code engine that happens to take Markdown*.
- `physical` (a clinical checkup) and `fhir` (a pediatric dosing safety check) are the same shape in medicine: a patient or medication record judged against a clinical reasonableness or safety rule. This is *clinical decision support and data quality*, but delivered without a vendor holding the data.
- `longitudinal` (a research panel wave) and `social` (account + post abuse triage) are the same shape in data science: a training record judged against feature-plausibility and skip-logic rules *before* the ML pipeline sees it. This is *pre-training data validation*, a category ML shops currently hand-roll in Python.

Three commercial shapes fall out:

1. **Policy-as-code** over JSON documents (configuration, records, events). Splits into a *hot* sub-market around infrastructure compliance (cloud, Kubernetes, IaC — budget-approved, active procurement) and a *mature* sub-market around enterprise business rules (orders, invoices, trades — entrenched incumbents). Ranked separately below.
2. **Clinical / regulated data quality** where the no-server property is load-bearing.
3. **ML training-set validation** where rules live alongside the feature engineering code.

Each is a real market. They rank differently.

## Ranked commercial prospects

### Tier 1 — best-fit, defensible

**1. Compliance-as-code for cloud infrastructure.** The closest analogues are Open Policy Agent / Rego, AWS Config, HashiCorp Sentinel, Checkov, and the Kubernetes admission-controller ecosystem. Policy engines have product-market fit; the market spends real money on them. The MIAS angle is surface-level: Markdown + JSON is dramatically more readable than Rego to humans *and* to LLMs, and the browser-native evaluator lets security teams author and test rules without a server round-trip. The risk is that incumbents (especially OPA) have mindshare; the opportunity is that their authoring experience is genuinely bad, and LLM-assisted policy authoring is a fresh lane.

**2. Clinical data validation at ingest.** EHR integration engines (Rhapsody, Mirth Connect) and registry-submission tools validate FHIR and HL7 records before acceptance. The market is real and budget-approved. MIAS's defining advantage here is **no PHI leaves the browser**, which collapses a large chunk of the HIPAA/BAA compliance surface for pilot customers. The `fhir` example is close to a demoable pilot once unsat-core surfacing lands (see open questions below). The risk is sales cycle length in healthcare; the opportunity is that the cross-origin-isolated, client-only story is genuinely differentiated and lands hard with compliance officers.

**3. Pre-ML training-set validation.** Every serious ML shop has a `validate.py` that hand-rolls range checks, skip-logic, sentinel rejection, and derived-field tolerance. The `longitudinal` example encodes in 30 lines what a research shop typically spreads across 300. Market ranges from academic social-science consortia (small budgets, high pain) to pharma biostats (large budgets, slow procurement). Feature-store vendors (Tecton, Feast) are complementary rather than competing — MIAS as a validation step *upstream* of the feature store. The shape to aim at is a polars/pandas/DuckDB UDF or a Great Expectations alternative.

### Tier 2 — strong fit, crowded market

**4. Business rule validation (orders, invoices, trades).** The `intake` example is a direct shot at what Drools, IBM ODM, and FICO Blaze Advisor do. The market is large but the incumbents are entrenched and the decision-maker (enterprise architecture) is slow. Attractive as a bottom-up adoption play via LLM-authored rules, less attractive as a head-on replacement.

**5. Trust & safety / abuse signals.** The `social` example is recognizable to any T&S team. Rules change faster than code deploys can keep up with, and a Markdown-native DSL that ops teams can edit without engineering review is genuinely useful. Market is niche per-customer but recurring; buyers include content platforms, fraud-adjacent fintechs, and marketplaces. Less defensible than Tier 1 because most large platforms will build in-house.

### Tier 3 — speculative

**6. Insurance underwriting and claims validation** — big pockets, very slow to adopt new tooling, dominated by Guidewire / Duck Creek. Realistically a 3-year sales cycle unless there's a wedge via a specialty carrier.

**7. Education / credentialing** — transcript verification, graduation-requirement checks. Interesting fit with QF_LIRA, but schools don't buy.

**8. Legal contract validation** — SLA breach detection and clause consistency look tempting but legal reasoning rarely compresses into linear arithmetic cleanly. Would need a very careful scoping exercise before investing.

### Ranking axes

Each tier was weighed on five dimensions:

| Axis | Weight | Notes |
|---|---|---|
| Market size | high | is there budget? |
| Incumbent moat | high | how entrenched is the status quo? |
| Regulatory pull | medium | compliance-driven spend is more reliable than discretionary |
| No-server uplift | medium | MIAS's unique property — worth a premium only in regulated/privacy-sensitive domains |
| Adoption friction | high | does a buyer have to change three other things to use it? |

Compliance-as-code and clinical validation score well on all five. Insurance scores well on the first two and poorly on the last. Legal scores poorly on the fit-to-technology axis.

## Scaling from one record to production throughput

The current surface is one JSON object + one Markdown rule set per browser Run. Every commercial prospect above needs volume — thousands to hundreds of millions of records judged per day. The path from where we are to where we need to be is straightforward but unbuilt.

### Five tiers, one pipeline

The same parser and compiler serve every tier; what changes is the glue around them and the record throughput each tier targets. The existing parser and compiler already run unchanged in Node — they were validated this way during development. The solver is the only browser-specific dependency, and z3-solver ships Node support out of the box. Nothing about the core pipeline is browser-bound; what's browser-bound is the *UI*.

| Tier | Audience | Volume | Shape | Backend? |
|---|---|---|---|---|
| 1. **Author-and-share** (current) | individual policy authors, demo tire-kickers | 1–10 records, hand-edited | static site, URL-shareable state | no |
| 2. **Drag-and-drop batch** | pilot teams, compliance reviewers | 10–10K records, client-side only | static site + file input + aggregate pane | no |
| 3. **CLI / library** | data engineers, research ops, CI pipelines | 10K–10M records per invocation | `npx mias validate` / Node + Python importable | no |
| 4. **Managed validation service** | enterprise buyers | 10M+ records/day, multi-tenant | hosted API, audit log, rule versioning | yes |
| 5. **On-prem / VPC** | healthcare, finance, government | same as 4, inside customer boundary | containerized service | yes, customer-hosted |

Tiers 1–3 require no server and no per-customer operational work. Tier 4 is where the business captures value. Tier 5 is the regulated-industry table stakes. Architecturally, tiers 2–5 run the same evaluation loop; they differ only in how records arrive and where verdicts go.

### Architecture changes to get past tier 1

Three moves carry the pipeline from "one record per Run" through tier 5:

**1. Separate rule compilation from record evaluation.** Currently `compile(program, ctx)` builds constants, asserts JSON equalities, asserts Markdown constraints, and returns a solver — all at once, per Run. For volume, compile the Markdown *rule set* once into a reusable structure, then for each record build a fresh solver scope, assert the record's JSON equalities, apply the pre-compiled rule assertions, and solve. This is a 10–100× speedup because rule compilation dominates over solve time for simple records.

**2. Use push / pop (or fresh solvers) between records.** Z3 supports scoped assertion with `solver.push()` / `solver.pop()`; between records you pop the previous record's assertions, push fresh ones, and solve. No context teardown. The alternative — fresh solver per record — is simpler but pays constant re-declaration cost. Push/pop is the high-throughput path.

**3. Parallelize at the record level.** Each record is independent. In the browser, a small `Worker` pool processes records from a queue. In Node or serverless, processes or invocations scale horizontally with no coordination overhead. The only shared state is the rule set itself, which can be broadcast on startup.

### Bottlenecks and their characters

- **Z3 WASM cold-start** is ~500ms–1s and involves fetching a ~32 MB artifact. In steady-state batch processing this cost amortizes to zero. In request-per-invocation serverless it is the dominant cost and argues for keeping the runtime warm (Cloudflare Workers Smart Placement, Lambda provisioned concurrency, long-running containers).
- **Per-record solve** for the v1 subset (QF_LIRA + Bool + String equality) is typically under 10 ms for a record with tens of constraints. The solver is not the throughput bottleneck at any realistic scale.
- **Memory** depends on the runtime. In the browser, the ~32 MB WASM linear memory is shared across pthread workers via SharedArrayBuffer — a worker pool does not multiply the cost. In Node or a container, each *process* loads its own WASM, so a 16-process pool pays ~16 × 32 MB ≈ 500 MB. Per-context state inside a shared runtime adds kilobytes to low megabytes depending on rule complexity.
- **Record parse** (JSON → declarations) is pure JS and fast; not a concern below a billion records.

### Record scale versus rule-set scale

Two different things to scale, and they scale differently:

- **More records, same rule set** — the throughput problem. Compile-once, parallelize, amortize cold-start. Linear in records.
- **Larger rule sets against the same records** — the authoring problem. A 500-line policy takes longer to solve per record than a 30-line one, but both compile once. The pain here is *human*, not machine: rule maintenance, conflict detection, coverage reporting. Eventually the tooling grows: rule modules, inheritance, test suites for policies themselves.

### Open questions worth deciding before scaling

- **Unsat-core surfacing.** At tier 2 and above, "unsat" is useless without "which rule fired." Z3 supports unsat cores, but the compiler has to opt in: each rule assertion needs `solver.assert_and_track(expr, label)` with a tracking literal, and unsat runs call `solver.unsat_core()` to get the set of fired labels. Non-negotiable before batch.
- **Record identity.** For audit logs and deduplication, every record needs an addressable identifier; today the JSON is anonymous. Conventionally a top-level `id` field; worth encoding in the spec.
- **Rule versioning.** Once the same rule set runs against years of records, verdict reproducibility requires rule hashes in the audit record. Content-addressable rules are the natural shape.
- **Error taxonomy.** Parse error, compile error, undeclared symbol, sort mismatch, solver timeout, unsat — all currently surface as opaque strings. Structured error codes are a precondition for programmatic consumers at tier 3+.
- **Result caching.** For idempotent workloads, hashing (record + rule-set) → verdict saves recomputation on re-runs. Trivial to add when the audit log exists.
- **Multi-tenant isolation (tier 4+).** One tenant's rule set is another tenant's IP; one tenant's records are another tenant's liability. Separate Z3 contexts per tenant are cheap; harder questions are rule-set provenance, audit separation, and solver-timeout budgets that prevent one tenant's pathological rule from starving the worker pool. Worth designing before the first paid pilot, not after.

## What to build next, in order

1. **Unsat core display** — lowest effort, highest leverage, needed for *any* batch use. Requires switching the compiler to `assert_and_track` and labeling each Markdown assertion by source line.
2. **Batch-in-browser UI** — drag JSONL, render aggregate + flagged-record list. Sellable pilot for compliance and clinical.
3. **Node CLI** — reuses the same parser/compiler; new file is a thin streaming wrapper. Unlocks tier 3 customers.
4. **Audit log primitives** — record IDs, rule-set hashes, verdict timestamps, structured errors.
5. **Managed service** — only once 1–4 are solid. Everything above this line is foundational; everything below is go-to-market.

## Pitch

"Why not just write this in Python or TypeScript?" is the question every engineering review asks, and it deserves a direct answer. Every built-in example — the compliance rule, the FHIR dose check, the longitudinal panel validation — is absolutely codeable as a handful of `if` statements in any general-purpose language. The case for MIAS isn't that you *can't* do it in code. It's that code is the wrong place for the logic to live, for five specific reasons.

**Rules stop being code.** Markdown assertions are readable by the person who owns the policy — the compliance officer, the clinician, the research PI, the T&S analyst — not just the engineer who wrote the validator. A `if (request.dose_mg * request.frequency > 4000) ...` check is invisible to everyone outside engineering. ``<=(total_daily_mg, `4000`)`` is visible to every stakeholder on the project. Policy-as-code only pays off when the "code" crosses the engineer/stakeholder line; Markdown is what lets it cross.

**Unsat cores explain failures for free.** A hand-rolled validator either returns the first error or you write your own "collect all errors" machinery; either way, you're designing the explanation by hand. An SMT solver produces a minimal explanation — the specific set of rules whose conjunction made the record infeasible — as a built-in feature. For a record that trips several constraints at once, that is the difference between actionable feedback and noise.

**Satisfiability-checking catches contradictions at authoring time.** You can ask the solver "can any record satisfy this rule set?" *before* any records run against it. If the answer is unsat, the rules contradict each other — a class of bug that in a procedural validator only surfaces at runtime on the one record that hits both branches. SMT makes the rule set a formal object; a Python file is not a formal object.

**The surface is narrow by design.** A Markdown-plus-JSON constraint cannot loop forever, cannot hit the network, cannot mutate shared state, cannot import arbitrary code. It is sat, unsat, or unknown, in bounded time. That is not a performance claim — it is an *audit* claim. A tier-5 on-prem healthcare customer reviewing what can happen inside the evaluator has to convince themselves of a narrow formal thing, not a Turing-complete thing. Nothing in Python or TypeScript gives you that property.

**LLMs write the surface well.** The vocabulary is a couple dozen operators and four sorts. A language model given a rule-in-English produces a Markdown constraint block that a human can read, review, and merge. The same model given "write me a Python validator" produces code that runs but carries several bugs per file, needs tests, and bit-rots the moment the schema changes. The authoring economics favor the restricted DSL.

**When TS or Python is still the right call.** Regex-heavy text processing, rules that genuinely need network lookups, workflows that mutate state across steps, anything that depends on floating-point transcendentals or the full numeric tower. MIAS is a constraint engine, not a scripting language. The moment a rule needs to call a service to ask "is this IP on the block list," you are in imperative territory and should stay there. The pitch is not that MIAS replaces general-purpose code — it is that *declarative constraint logic belongs in a constraint engine*, and MIAS is what that looks like when the surface is Markdown.
