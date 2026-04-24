# Commercial Scale

An opinionated read of where this technology wins in market, and a path from "one record per run" to production throughput. Holds both the pitch and the market analysis; marketing materials will be split out of here when there's a real need for them.

## Pitch

**Markdown Is A Solver** is a browser-based constraint engine. You write the data as JSON, you write the rules as Markdown, and a WebAssembly SMT solver returns a verdict — sat, unsat, or unknown — along with a minimal explanation when a record fails a rule. Everything runs in the user's browser. No server sees the data.

"Why not just write this in Python or TypeScript?" is the question every engineering review asks, and it deserves a direct answer. Every built-in example — the compliance rule, the FHIR dose check, the longitudinal panel validation — is absolutely codeable as a handful of `if` statements in any general-purpose language. The case for MIAS isn't that you *can't* do it in code. It's that code is the wrong place for the logic to live, for five specific reasons.

**Rules stop being code.** Markdown assertions are readable by the person who owns the policy — the compliance officer, the clinician, the research PI, the T&S analyst — not just the engineer who wrote the validator. A `if (request.dose_mg * request.frequency > 4000) ...` check is invisible to everyone outside engineering. ``<=(total_daily_mg, `4000`)`` is visible to every stakeholder on the project. Policy-as-code only pays off when the "code" crosses the engineer/stakeholder line; Markdown is what lets it cross.

**Unsat cores explain failures for free.** A hand-rolled validator either returns the first error or you write your own "collect all errors" machinery; either way, you're designing the explanation by hand. An SMT solver produces a minimal explanation — the specific set of rules whose conjunction made the record infeasible — as a built-in feature. For a record that trips several constraints at once, that is the difference between actionable feedback and noise.

**Satisfiability-checking catches contradictions at authoring time.** You can ask the solver "can any record satisfy this rule set?" *before* any records run against it. If the answer is unsat, the rules contradict each other — a class of bug that in a procedural validator only surfaces at runtime on the one record that hits both branches. SMT makes the rule set a formal object; a Python file is not a formal object.

**The surface is narrow by design.** A Markdown-plus-JSON constraint cannot loop forever, cannot hit the network, cannot mutate shared state, cannot import arbitrary code. It is sat, unsat, or unknown, in bounded time. That is not a performance claim — it is an *audit* claim. A regulated-industry customer reviewing what can happen inside the evaluator has to convince themselves of a narrow formal thing, not a Turing-complete thing. Nothing in Python or TypeScript gives you that property.

**LLMs write the surface well.** The vocabulary is a couple dozen operators and four sorts. A language model given a rule-in-English produces a Markdown constraint block that a human can read, review, and merge. The same model given "write me a Python validator" produces code that runs but carries several bugs per file, needs tests, and bit-rots the moment the schema changes. The authoring economics favor the restricted DSL.

**When TS or Python is still the right call.** Regex-heavy text processing, rules that genuinely need network lookups, workflows that mutate state across steps, anything that depends on floating-point transcendentals or the full numeric tower. MIAS is a constraint engine, not a scripting language. The moment a rule needs to call a service to ask "is this IP on the block list," you are in imperative territory and should stay there. The pitch is not that MIAS replaces general-purpose code — it is that *declarative constraint logic belongs in a constraint engine*, and MIAS is what that looks like when the surface is Markdown.

## What the examples reveal

The nine built-in examples are not just demos — they're market probes. Read across them and a pattern shows up.

The puzzle examples (`easy`, `budget`, `scheduling`) exercise the solver but don't sell anything. They're a teaching ladder. The real commercial signal is in the six domain examples:

- `compliance` (a security-group rule) and `intake` (an order record) look like the same shape: a piece of structured configuration judged against a written policy. The technology is a *policy-as-code engine that happens to take Markdown*.
- `physical` (a clinical checkup) and `fhir` (a pediatric dosing safety check) are the same shape in medicine: a patient or medication record judged against a physiological or safety rule. Framed carefully, this is *data-quality validation at ingest* for healthcare records — a cleaner market framing than "clinical decision support," which is a regulated term under FDA guidance (see Tier 1 note below).
- `longitudinal` (a research panel wave) and `social` (account + post abuse triage) are the same shape in data science: a training record judged against feature-plausibility and skip-logic rules *before* the ML pipeline sees it. This is *pre-training data validation*, a category ML shops currently hand-roll in Python — but also a category already served by Great Expectations, Pandera, and Pydantic.

A fourth commercial shape is not directly exercised by the built-in example set but is arguably the strongest wedge the technology points at: **BSA/AML-adjacent transaction monitoring for fintech**. The `intake` example is the nearest cousin (a structured record judged against enumerated status values, arithmetic reconciliation, and a tier-dependent business rule), but per-transaction monitoring deserves its own fixture and is called out under "What to build next."

Four commercial shapes fall out:

1. **Policy-as-code** over JSON documents (configuration, records, events). Splits into a *hot* sub-market around infrastructure compliance (cloud, Kubernetes, IaC — budget-approved, active procurement) and a *mature* sub-market around enterprise business rules (orders, invoices, trades — entrenched incumbents). Ranked separately below.
2. **Transaction monitoring for fintech** — structurally a sub-species of #1 but go-to-market distinct: mandatory regulatory spend, extreme rule-change velocity, and unsat-core-as-alert-reason is the feature. Ranked first below.
3. **Healthcare data-quality validation at ingest** where the no-server property is load-bearing.
4. **ML training-set validation** where rules live alongside the feature engineering code — crowded adjacent space, not a priority.

Each is a real market. They rank differently.

## Ranked commercial prospects

### Tier 1 — best-fit, defensible

**1. Transaction monitoring for fintech.** *Target positioning: "A browser-native evaluator for the custom transaction-monitoring rules your vendor can't express, with LLM-assisted authoring and per-alert explanation — no data leaves your environment."*

Per-transaction rule evaluation is the exact shape this technology was built for. Each transaction arrives as JSON (amount, currency, sender, recipient, timestamps, channel, counterparty metadata, upstream risk scores); the rule set is thresholds and categorical conditions ("amount over $X in currency Y to country Z triggers review"; "any transaction involving a sanctioned counterparty"); and an unsat core *is* the alert reason — "this transaction hit rules R1, R4, and R7" is exactly the triage payload a compliance analyst needs, produced for free by the solver. The rule vocabulary is QF_LIRA plus string equality plus booleans — the v1 subset, no extensions required. Buyers: BaaS platforms, crypto/fiat on-ramps, cross-border remittance, neobanks, and payments fraud teams inside larger fintechs.

The market characteristic that matters most is rule-change velocity. Regulatory guidance updates, FinCEN typology changes, new fraud patterns, and seasonal adjustments produce a constant stream of rule updates, and compliance teams are chronically blocked by engineering release cycles that move in weeks when the policy moves in days. A tool that lets an analyst author a Markdown rule, have compliance review it, and deploy it *independent of the eng release cadence* is load-bearing here in a way it isn't in most other markets.

*The wedge is supplemental, not displacement.* BSA/AML transaction monitoring is dominated by Actimize, SAS, and Oracle Mantas at the enterprise end and by Unit21 and Hummingbird at the modern-fintech end. MIAS will not displace them. The positioning is the supplemental-rules layer: the custom typologies specific to this fintech's product, the rules that don't fit the vendor schema, the fast-iteration tier that sits alongside the vendor baseline. "We use Unit21 for the baseline and MIAS for the custom rules we iterate on weekly" is a shape a compliance lead can authorize without firing a vendor they depend on.

*The honest limitation: v1 is stateless.* A meaningful subset of transaction-monitoring rules is velocity- or pattern-based ("more than 5 transactions in 10 minutes from the same account") and requires reasoning across transactions rather than evaluating one in isolation. MIAS v1 evaluates one record at a time. Two paths handle this: (a) a preprocessing step summarizes recent history into the transaction JSON as fields like `past_hour_count` that the rule can then reference — no MIAS change, handles most velocity rules, at the cost of coupling the rule to an upstream schema — and (b) an explicit windowed-state primitive in a v2. Lead with per-transaction rules in the pitch; acknowledge velocity as a roadmap item, not a current capability.

*The FP-rate story is where this lands.* False-positive rates are the currency of transaction monitoring — every compliance team is measured on "did FPs go down this quarter." Any rule engine pitched into this market will be evaluated on whether it helps: via more precise rules (better authoring), faster triage per alert (better explanation), or better coverage (catching things the vendor misses). Of the three, **better explanation** is where MIAS has the cleanest story, because unsat cores mean every alert ships with the exact subset of rules that fired it. That is a direct productivity gain for the analyst queue and it is measurable.

**2. Compliance-as-code for cloud infrastructure.** The closest analogues are Open Policy Agent / Rego, AWS Config, HashiCorp Sentinel, Checkov, and the Kubernetes admission-controller ecosystem. Policy engines have product-market fit; the market spends real money on them.

*The wedge is not "better syntax."* Every challenger claims the incumbent's syntax is ugly; it rarely wins on its own. OPA has mindshare, a mature GitOps story, Kubernetes admission-controller integration, and a Wasm runtime of its own. The honest MIAS differentiator is **LLM-native rule authoring with client-side preview**. A compliance engineer (or, increasingly, a compliance officer) describes a policy in English, a language model produces Markdown constraints, and the author runs the draft policy against real configuration *in the browser* — no cluster round-trip, no test-fixture scaffolding, no CI policy check to wait on. The no-server property turns "author → preview → iterate" into a laptop-speed loop, which is what LLM-assisted policy work actually needs and what OPA's authoring experience genuinely lacks. That loop is the thing to commit to in the pitch, not the syntax.

**3. Healthcare data-quality validation at ingest.** EHR integration engines (Rhapsody, Mirth Connect) and registry-submission tools validate FHIR and HL7 records before acceptance. The market is real and budget-approved. MIAS's defining advantage here is **no PHI leaves the browser**, which collapses a large chunk of the HIPAA/BAA compliance surface for pilot customers. With unsat cores already naming the conflicting facts and rules, the `fhir` example is demoable today. The risk is sales cycle length in healthcare; the opportunity is that the cross-origin-isolated, client-only story is genuinely differentiated and lands hard with compliance officers.

*Homework before the first clinical pilot.* "Clinical decision support" is a regulated term. Under the FDA's 21st Century Cures Act guidance, software whose output could be used without a clinician independently reviewing the *basis* of the recommendation is treated as a medical device. MIAS probably qualifies as *non-device CDS* because unsat cores literally surface the rules and facts that drove the verdict — the basis is shown to the user by construction — but this is worth understanding before going into a clinical pilot, not after. "Data-quality validation at ingest" is a cleaner framing that lands in the same buyer (EHR integration team, registry-submission team) without the regulatory entanglement, and it's the framing to lead with in early sales conversations.

### Tier 2 — strong fit, crowded market

**4. Business rule validation (orders, invoices, trades).** The `intake` example is a direct shot at what Drools, IBM ODM, and FICO Blaze Advisor do. The market is large but the incumbents are entrenched and the decision-maker (enterprise architecture) is slow. Attractive as a bottom-up adoption play via LLM-authored rules, less attractive as a head-on replacement.

**5. Trust & safety / abuse signals.** The `social` example is recognizable to any T&S team. Rules change faster than code deploys can keep up with, and a Markdown-native DSL that ops teams can edit without engineering review is genuinely useful. Market is niche per-customer but recurring; buyers include content platforms, fraud-adjacent fintechs, and marketplaces. Less defensible than Tier 1 because most large platforms will build in-house.

**6. Pre-ML training-set validation.** Every serious ML shop has a `validate.py` that hand-rolls range checks, skip-logic, sentinel rejection, and derived-field tolerance — the `longitudinal` example encodes in 30 lines what a research shop typically spreads across 300. The catch is that ML shops are engineer-dominant, so "Markdown is readable by non-engineers" doesn't buy as much here as it does in compliance or clinical, and the space is already served by Great Expectations, Pandera, Pydantic, and a dozen adjacent tools. Think of this as a long-tail bottom-up play (academic consortia with pain, pharma biostats with budget) rather than a priority wedge. The shape to aim at if it is pursued is a polars/pandas/DuckDB UDF or a Great Expectations alternative, positioned upstream of the feature store.

### Tier 3 — speculative

**7. Insurance underwriting and claims validation** — big pockets, very slow to adopt new tooling, dominated by Guidewire / Duck Creek. Realistically a 3-year sales cycle unless there's a wedge via a specialty carrier.

**8. Education / credentialing** — transcript verification, graduation-requirement checks. Interesting fit with QF_LIRA, but schools don't buy.

**9. Legal contract validation** — SLA breach detection and clause consistency look tempting but legal reasoning rarely compresses into linear arithmetic cleanly. Would need a very careful scoping exercise before investing.

### Ranking axes

Each tier was weighed on five dimensions:

| Axis | Weight | Notes |
|---|---|---|
| Market size | high | is there budget? |
| Incumbent moat | high | how entrenched is the status quo? |
| Regulatory pull | medium | compliance-driven spend is more reliable than discretionary |
| No-server uplift | medium | MIAS's unique property — worth a premium only in regulated/privacy-sensitive domains |
| Adoption friction | high | does a buyer have to change three other things to use it? |

Transaction monitoring, compliance-as-code, and healthcare data-quality score well on all five; transaction monitoring additionally has the strongest score on regulatory-pull-as-mandatory-spend of any row in the table, which is what moves it to the top of Tier 1. Insurance scores well on the first two and poorly on the last. Legal scores poorly on the fit-to-technology axis.

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

### Tier 4 architecture — the row where the business lives

Tier 4 (managed validation service) hides most of the hard parts of this business in one table row, so it gets its own paragraph. The obvious work is a hosted API, a persistent audit log, and rule-set versioning. The unobvious work — the work that determines whether Tier 4 is a product or a pile of incidents — lives in three places:

- **Multi-tenancy boundaries.** A tenant's rule set is their IP; a tenant's records are their liability. Z3 contexts are cheap enough to create per-tenant-per-request, but shared state lives elsewhere: the cached compiled rule set, the audit log schema, the rate limiter, the WASM linear memory inside a given worker process. Each is a tenancy surface that has to be designed, not inherited from the framework. Rule-set caching across tenants is the obvious performance win *and* the obvious data-leak bug; getting the keying scheme right is a Day-1 decision, not a Day-90 one.
- **Solver-timeout budgets per tenant.** The v1 subset is fast, but an SMT solver is still an open-ended computation, and a customer can (by accident or by malice) write a rule set that takes minutes. In a shared worker pool, one tenant's pathological rule starves every other tenant's verdicts. The answer is a per-tenant CPU-time budget enforced at the solver layer (Z3's `set-option :timeout` plus accounting on the orchestrator side) with fair-share scheduling across tenants, but implementing this *before* the first paying customer writes their first rule set is the only way it ships — retrofitting fair-share scheduling into a running service is a bad week.
- **Audit separation.** Verdict reproducibility requires that an audit record pins the record hash, the rule-set hash, the solver version, and the verdict; tenant isolation requires that one tenant's auditor cannot see another tenant's audit stream. Content-addressable rule storage (rules hashed and referenced by hash) is the natural shape and collapses rule versioning and audit provenance into the same problem.

Tier 5 (on-prem / VPC) is this same service shrink-wrapped, so every multi-tenancy decision made for Tier 4 either transfers or becomes moot at the boundary. Tier 4 is where the money is *and* where the engineering risk is — the one-line table row does not respect either.

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

- **Record identity.** For audit logs and deduplication, every record needs an addressable identifier; today the JSON is anonymous. Conventionally a top-level `id` field; worth encoding in the spec.
- **Rule versioning.** Once the same rule set runs against years of records, verdict reproducibility requires rule hashes in the audit record. Content-addressable rules are the natural shape.
- **Error taxonomy.** Parse error, compile error, undeclared symbol, sort mismatch, solver timeout, unsat — all currently surface as opaque strings. Structured error codes are a precondition for programmatic consumers at tier 3+.
- **Result caching.** For idempotent workloads, hashing (record + rule-set) → verdict saves recomputation on re-runs. Trivial to add when the audit log exists.
- **Multi-tenant isolation (tier 4+).** One tenant's rule set is another tenant's IP; one tenant's records are another tenant's liability. Separate Z3 contexts per tenant are cheap; harder questions are rule-set provenance, audit separation, and solver-timeout budgets that prevent one tenant's pathological rule from starving the worker pool. Worth designing before the first paid pilot, not after.
- **Stateful / windowed rules.** v1 is stateless: one record → one verdict. Many commercial rule sets (transaction-velocity monitoring, skip-logic across survey waves, session-scoped policies) need to reason across records. The near-term answer is preprocessing — summarize recent history into the record JSON as fields like `past_hour_count` that the rule can reference — which avoids any MIAS change at the cost of coupling the rule to a specific upstream schema. The v2 answer is an explicit windowed-state primitive in the language. Worth deciding which path is load-bearing before committing to a customer whose rule set doesn't fit the stateless model.

## What to build next, in order

1. **Batch-in-browser UI, shipped with a transaction-monitoring fixture.** Drag a JSONL file; render an aggregate dashboard and a flagged-record list. Ship the UI with a realistic demo payload — a BaaS cross-border-remittance rule set plus a few hundred synthetic transactions — including a deliberately contradictory rule pair so the sat-check can demonstrate "this rule set is infeasible *before* you deploy it." One build hits four pitches at once: per-transaction evaluation, batch processing (the Tier-2 scale step), unsat-core explanation in context, and contradiction-detection as a feature compliance teams can feel. Sellable pilot for transaction monitoring, compliance, and clinical; also the most shareable artifact the project has (Bluesky-sized demo). Unsat-core surfacing is already in place, so flagged records arrive with their reasons attached.
2. **Node CLI** — reuses the same parser/compiler; new file is a thin streaming wrapper. Unlocks tier 3 customers.
3. **Audit log primitives** — record IDs, rule-set hashes, verdict timestamps, structured errors.
4. **Managed service** — only once 1–3 are solid. Everything above this line is foundational; everything below is go-to-market.

