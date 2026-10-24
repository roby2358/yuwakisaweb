# TOOLING.md — Tools for an Ontology-Driven Development Cycle

**Scope.** PLAN.md says explicitly: no tooling until the markdown practice is solid.
This document does not reverse that. It is the candidate catalog — what tooling
*would* be relevant, what failure each piece prevents, and what it costs — so that
when the practice is solid there is a ranked list instead of a brainstorm.
Everything here is **[P]** unless marked otherwise. Q-numbers continue PLAN.md's
namespace (PLAN holds Q-1…Q-4 and Q-10; this doc holds Q-5…Q-9).

**Organizing principle.** A tool earns its place by catching a *specific named
failure* the practice is already known to have. The `ontology_spec` skill's
Pitfalls section is therefore the real requirements document for this one, and
every entry below cites the failure it exists for. A tool that doesn't trace to a
pitfall is tooling for its own sake.

**The boundary that matters most.** Models do the analogical crossing from problem
space to code space; tools do the *bookkeeping* around it. Nothing here generates
implementation from docs. That would re-commit the error PLAN's problem-space claim identifies — baking
one analogy into a pipeline — and it would take the one job the model is best at and
hand it to a worse mechanism. Tools check consistency, project a single source into
derived views, and re-run measurements. They do not write code.

---

## §1 What exists today [D]

One tool, in one project: `ideas/hexandcounter/test/coverage.js`, 41 lines, zero
dependencies, run as part of `node test/run.js`. It parses `CRITERIA.md`, builds an
`ID → Instrument` map, and fails when:

- an ID appears twice in the table;
- an Instrument cell isn't one of the four legal forms;
- an `automated` R-row has no `test/R-n/` containing a `.js` file;
- a `test/R-n/` directory exists for a row that's missing or not `automated`.

Nothing else in the repository reads the design docs. That's the honest baseline.

It is worth naming what `coverage.js` proves, because it's the argument for
everything below: **the doc-set's structural promises are mechanically checkable at
trivial cost.** Forty-one lines closes the "test lists in two places" and
"untestable criteria" pitfalls permanently, and it closes them by *failing the
normal test command* rather than by asking anyone to remember.

It is also worth naming what it doesn't do: it checks the table against the
directory tree, and nothing about ONTOLOGY or the log.

---

## §2 Checkers [P]

Cheap, mechanical, run in the normal test command. Each one is a consistency
property of the doc set that a human currently has to hold in their head.

### 2.1 Criteria coverage — *built*
**Catches:** test lists drifting from CRITERIA; criteria with no instrument.
See §1.

### 2.2 ID integrity
**Catches:** renumbered or reused IDs — the failure that destroys every citation at
once, and the one the practice most loudly promises not to have.
**Checks:** every `G-n`/`D-n`/`Q-n`/`R-n`/`U-n`/`X-n` is defined exactly once across
the set; a retired criterion has a `retired` tombstone row rather than a hole; no ID
is cited anywhere that isn't defined somewhere.
**Cost:** one pass over the markdown, two regexes. Small.

### 2.3 Citation linter
**Catches:** the "section-number back-reference" pitfall, which is stated as a known
accumulating failure and currently has no detector at all.
**Checks:** flags `§n.n`-style references in docs, code comments, tests and commit
templates; flags citations of IDs that don't resolve; flags a cross-app ID used
unqualified (`D-9` where `auth/ D-9` was meant — detectable because the local set
doesn't define it, which falls out of 2.2 for free).
**Cost:** small, but needs a repo-wide grep, so it wants to live once rather than
per project. See Q-5.

### 2.4 Constant single-source check
**Catches:** "duplicated numbers" — the same constant in five docs, so every tuning
change becomes a hunt.
**Checks:** every name in ONTOLOGY §6 resolves to a code constant of that name;
values agree; and no doc outside §6 states a bare numeric literal that matches a
named constant's value. The last check is the one with teeth, and the one most
likely to false-positive on coincidental numbers. See §4 on the false-positive tax.
**Cost:** medium — it needs to read constants out of code, which is the first place
language-specificity leaks in. See Q-8.

### 2.5 Serves-tag orphan check
**Catches:** two failures at once, in both directions. An item that serves nothing
is a cut candidate (the skill's claim that nothing in a codebase can be *shown* to
be dead without this). A goal nothing serves is an unmet goal.
**Checks:** every entity and rule has a `Serves:` line; every Serves target resolves
to a §0 goal or a named quality; every goal and quality is named
by at least one Serves.
**Cost:** small. This is the highest insight-per-line checker on the list — it
answers a question no codebase can answer, which is PLAN's "map" claim made
executable.

### 2.6 History-leak check
**Catches:** "history in the current-state docs," the pitfall that ends with a
reader unable to tell what's true now.
**Checks:** flags `formerly`, `originally`, `previously`, `used to`, `reversed in`,
`was N, now M`, `(resolves the former Q-n)` in every doc except
`ARCHITECTURE_LOG.md`.
**Cost:** trivial — a word list. Highest ratio of pitfall-closed to lines-written of
anything here.

### 2.7 Log-entry-per-change check
**Catches:** the log written after the fact, which the skill says isn't a log.
**Checks:** if a commit touches `ONTOLOGY.md` or `CRITERIA.md` and doesn't touch
`ARCHITECTURE_LOG.md`, fail.
**Cost:** small; the design question is where it runs. See Q-7.

### 2.8 Unbuilt-tag check
**Catches:** `[D, unbuilt]` quietly becoming invisible — design that stays in the
reference but loses its gap marker.
**Checks:** every `[D, unbuilt]` item has a CRITERIA row marked `not yet covered`.
**Cost:** trivial once 2.2 can resolve IDs.

---

## §3 Generators [P]

The rule for this section: **one source, projected into derived views.** A generator
that invents content isn't a generator.

### 3.1 Numbers table from code constants
The skill already asks for this ("ideally a small script regenerates this table from
code"). The code constant is the source; ONTOLOGY §6 is the view. Shares all the
language-specificity problems of 2.4 and should be the same tool read two ways:
generate the table, or diff it and fail.

### 3.2 ID index
`ID → defining doc and line, criteria rows, test directory, every code line citing
it.` This is PLAN's "updating guide" function made mechanical: "D-17 is wrong"
becomes a file list instead of a search. Falls out of 2.2's parse almost for free,
which is the argument for doing 2.2 first and well.

### 3.3 What not to build
- **No code generation from ONTOLOGY.** See the boundary note above.
- **No OWL emission.** PLAN settled this; the markdown practice isn't solid yet,
  and OWL can't express rules, commands or events anyway.
- **No doc-site build.** Rendering markdown prettier does not catch a single pitfall.

---

## §4 Measurement harnesses [D, as practice]

Distinct from everything above: these are *per-project* and already standard
practice here — `test/sim.js` for headless rule simulation, `test/trace.js --golden`
for pinned traces, `test/smoke.js` with a DOM stub for booting the real UI in Node,
econ or bot drivers for long-horizon pacing. `dbdesign` and `systemdesign` carry
the full `sim`/`trace --golden`/`smoke` + `domstub` set; `alienbadlands` and `field`
carry `sim.js` plus bot and screenshot drivers; `hexandcounter` carries the R-row
suite and its integration walkthrough behind one `run.js`.

They matter here because they are the **only source of the log's Evidence lines.**
The rule is already in force: a harness that produced a finding gets committed to the
project's `test/` directory and re-run across sessions. It is never a scratchpad
script, because the finding is only as durable as the thing that produced it.

Two generic gaps:

### 4.1 Evidence re-runner
**Catches:** silent drift between a logged claim and current behavior — precisely
the failure PLAN's cost section names as the one that reintroduces the UML problem.
**Checks:** parse every `Measured by: <command> → <result>` line, run the command,
flag lines whose result has changed. A log entry then either still holds or
fails out loud.
**Cost:** medium, and the risk isn't the code — it's whether those commands stay
runnable for months. See Q-6. If they do, this is the most valuable unbuilt tool on
the list, because it converts a documentation claim into a test.

### 4.2 Controlled-comparison sweep
**Catches:** confounded attribution — "three numbers changed together, so the
attribution is confounded" is currently a discipline, enforced by remembering.
**Checks:** vary one named constant across a range, hold the rest, report the metric
per value. Makes one-variable-at-a-time the path of least resistance instead of an
act of restraint, and feeds the teleology review's "toggle it, halve it, double it"
step directly.
**Cost:** medium, and necessarily per-project, since only the project knows its
metric. The shared part is the convention, not the code.

---

## §5 Where tooling is the wrong answer [P]

Worth stating, because the failure mode of a tooling document is to propose tools for
properties that aren't mechanical.

- **Orientation needs no tool.** "Load ONTOLOGY instead of the codebase" is the
  single measurable benefit available today, and it requires only that the doc be
  worth loading. A docs-index or search tool here would feel like progress and
  deliver none.
- **Provenance can't be automated.** The `[D]`/`[P]` distinction is an authority
  claim. A tool can check that a tag *exists* (2.5's sibling check) but not that it's
  honest, and a tool that guessed would destroy the property it was checking.
- **Reasoning quality can't be automated.** "Writing down the alternatives is what
  finds bugs" is a claim about the writing, not the artifact. A checker that demanded
  an `Alternatives:` line would get a line, not an alternative.

---

## §6 Priority, ranked by failure prevented [P]

| # | Tool | Failure it prevents | Cost | Status |
|---|---|---|---|---|
| 1 | Criteria coverage (2.1) | tests drift from criteria | small | built, one project |
| 2 | History-leak check (2.6) | docs become unreadable over time | trivial | — |
| 3 | ID integrity (2.2) | every citation breaks at once | small | — |
| 4 | Serves orphan check (2.5) | dead items survive; goals go unmet | small | — |
| 5 | Log-entry check (2.7) | the log stops being a log | small | — |
| 6 | Citation linter (2.3) | §-references rot silently | small | — |
| 7 | Evidence re-runner (4.1) | logged claims go stale unnoticed | medium | — |
| 8 | Constants single-source (2.4 / 3.1) | tuning becomes a hunt | medium | — |
| 9 | ID index (3.2) | change requests don't resolve to files | medium | — |
| 10 | Sweep runner (4.2) | confounded attribution | medium | per-project |

The ordering is deliberately not by value. It's by **value divided by the chance the
tool gets abandoned**, which is the thing that actually killed UML.

---

## §7 The cost, and the size budget

Every checker is itself an artifact to maintain, and a checker that false-positives
gets disabled. That is the same dynamic that killed UML diagrams — not that they were
wrong, but that maintaining them stopped paying — and a disabled checker is worse
than no checker, because its presence implies a guarantee that isn't being enforced.

So, a budget, and it is the real content of this section:

- **Under ~50 lines, zero dependencies, runs in the normal test command.**
  `coverage.js` at 41 lines is the reference size. A checker that needs a package, a
  config file, or a CI service does not get built.
- **Zero tolerated false positives.** A checker that cries wolf once gets fixed or
  deleted that day. 2.4's literal-matching check is the one most at risk here and
  should ship behind an explicit allow-list or not at all.
- **It must fail where the work happens** — the test command or the commit — not in a
  dashboard nobody opens.

---

## §8 Open questions

- **Q-5** Do the checkers live per-project (copied, drifts) or once in
  `ontology-spec/tools/` with each project's `test/run.js` requiring them
  (shared, couples 38 prototypes to one directory)? *Recommendation:* shared, with
  the per-project `run.js` passing in paths — the checkers are about the format, and
  the format is the thing being consolidated. Copies would each drift into a
  different dialect of the format, which is the one outcome the project exists to
  prevent.
- **Q-6** Is the evidence re-runner (4.1) real? It assumes `Measured by:` commands
  stay runnable for months. If they don't in practice, the honest version is a
  staleness *date* on each Evidence line rather than a re-run, which is much weaker.
  Needs one project's history checked before building.
- **Q-7** Does the log-entry check (2.7) run as a pre-commit hook or as a test? A
  hook blocks the commit, which is the point, but hooks get bypassed and are
  per-machine. A test blocks the suite but the suite runs after the commit is
  already written. *Recommendation:* test, because the test command is the one thing
  guaranteed to run.
- **Q-8** The constants check (2.4) and generator (3.1) need to read constants out of
  code. One convention across vanilla-JS prototypes *and* a Spring Boot service, or a
  per-language adapter? A convention is cheaper and makes the doc set's claim to be
  framework-independent slightly less true.
- **Q-9** Should `ontology_spec` ship the checkers, so a new doc set arrives with
  them already wired, or does shipping tooling inside a skill overreach what a skill
  is for? This is the question that decides whether §2 is a one-time build or a
  per-project chore.
