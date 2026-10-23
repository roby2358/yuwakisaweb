# PLAN.md — Consolidating the Ontology-Spec Practice

**Thesis:** a design doc should describe the *problem*, not the code. That was
impractical for thirty years because a human had to carry the problem description
across to an implementation by hand, and the crossing was expensive enough that
everyone gave up and wrote specs in code vocabulary instead. Language models cross
it for free. That one change makes the problem-space document the most durable and
highest-leverage artifact in a repository — and it means the way we write design
docs should change to suit.

This project consolidates that practice: what the doc set is for, why it's shaped
the way it is, and what good looks like.

---

## §0 Purpose

**G-1** Make the case for problem-space design docs well enough to hold up under
pushback — from a colleague, from a future self, from a reviewer who thinks this is
just UML with extra steps.

**G-2** Turn the `ontology_spec` skill from something that produces documents into
something that produces *the same* documents reliably, with a worked reference
example to point at.

**G-3** Keep it honest. Name the cost, name the cases where this is the wrong
choice, and don't claim benefits that haven't actually shown up in practice.

---

## §1 The value proposition

### 1. The ontology defines the problem space, not the code space [D]

This is the load-bearing claim, and the cleanest way to see it is to look at why
UML modeling collapsed.

A UML class diagram nominally models a domain. In practice it is drawn in the
vocabulary of implementation: classes, fields, visibility modifiers, inheritance
arrows, associations with multiplicities that are foreign keys wearing a hat. It
is a **picture of the code you intend to write**. Which produces two fatal
properties:

- **It is redundant the moment the code exists.** Anything the diagram says, the
  code says too, more precisely and executably. You are maintaining a second copy
  of your program in a worse language. The rational response is to stop maintaining
  it, and that is exactly what the industry did.
- **It was never independently checkable.** You cannot ask "is this diagram true?"
  You can only ask "does the code match it?" — and when the answer is no, there's no
  principled way to decide which one is wrong.

An ontology makes claims about the problem instead. *"A song has exactly one
credited artist."* *"A duet is a song with two or more performers."* These are
statements about music. They are true or false about the world, not about the
repository. From which everything else follows:

- **They're falsifiable by someone who can't read the code.** The designer can
  review the spec on its own terms. This is precisely why the `[D]`/`[P]` tags
  work: they assign epistemic authority over claims about the problem space, and
  that only makes sense if the doc is about the problem. Nobody needs the
  designer's approval to rename a local variable; everybody needs it to decide
  whether a song can have two artists.
- **They survive refactoring.** Refactoring changes the code space by definition
  and the problem space not at all. A problem-space doc has a *slower decay rate*
  than any code-space artifact — it only changes when the product changes, which
  is deliberate, visible, and comparatively rare.
- **Disagreements land in the right place.** Two parts of a system that contradict
  each other are usually two different beliefs about the domain. A problem-space
  doc surfaces that as a design disagreement to be settled once, rather than as a
  bug to be patched twice.

The borrowing from OWL is the *stance*, not the standard: describe what exists and
what must hold, in the domain's own words. OWL itself stops short — it has no
notion of time, action, or arithmetic, so it can't express rules, commands, or
events, which real software problems are full of. ONTOLOGY.md takes the stance and
extends past OWL's static ceiling. We keep the discipline (every entity explicitly
related, every rule stated, every number named) and skip the formalism.

### 2. Models stretch the problem space onto the code framework by analogy [D]

Here is what actually changed, and why this is worth doing *now* when it wasn't
worth doing in 2005.

The problem-space/code-space gap was always real. It just wasn't *affordable*. A
human had to translate, the translation was slow and lossy, and it happened exactly
once — so you may as well skip a step and write the spec in implementation terms.
That tradeoff was correct given the cost of translation.

Language models are very good at that specific crossing. Hand one "a duet is a song
with two or more performers, and the credit line lists them in billing order" and
you get the struct, the validation, the test case, and a reasonable UI affordance,
in whatever framework you name. The right word is **analogical**: the model is not
compiling, it is finding a structure-preserving mapping from the shape of the
domain onto the shape of the framework. Which has consequences worth stating
plainly:

- **The mapping is re-runnable.** The same ONTOLOGY.md lands on vanilla JS and
  jQuery here, on Spring Boot, on a Durable Object, on something that doesn't exist
  yet. A code-space spec can't re-target — it has already committed to one analogy
  and thrown away the source.
- **A code-vocabulary spec wastes the model.** It pre-decides the part the model is
  best at, and typically leaves underspecified the parts it is worst at: what the
  thing is *for*, which numbers are load-bearing, what must never happen. The
  division of labor that falls out of this is clean — **the human owns the problem
  space and the purpose; the model owns the mapping** — and specs should be written
  to that division rather than against it.
- **Failures become visible instead of silent.** When the ontology is ambiguous, the
  ambiguity shows up as a wrong guess in generated code rather than as slow drift.
  The `[P]` tag makes it auditable: the model's inferences arrive marked as
  inferences, awaiting review, instead of quietly becoming requirements.

The common intuition is that AI coding makes specifications *less* important,
because code is cheap now. It's backwards. When code becomes cheap and
regenerable, code stops being the asset and becomes the build output — and the
specification becomes the thing you actually own. Specs matter more in this world,
not less, and problem-space specs matter most of all, because they're the only
kind that the cheap-regeneration property actually applies to.

### 3. The doc set is a map, a touchstone, and an updating guide [D]

Three distinct jobs that get run together and shouldn't be.

**Map — orientation.** Code tells you what exists; it is terrible at telling you
where anything is or why it's arranged that way. §0 purpose plus `Serves:` tags
mean you can start from a goal and find the parts of the system responsible for it,
which is not a question a codebase can answer at all. For AI-assisted work this has
a second, very concrete payoff: **ONTOLOGY.md is what you load instead of the
codebase.** It is the highest value-per-token artifact in the repo. A session that
starts by reading it is oriented in a few thousand tokens; a session that starts by
grepping is still guessing twenty tool calls later. That benefit is measurable
today, and it is the one most likely to convince a skeptic.

**Touchstone — adjudication.** When two readings are possible, there's one place
that settles it, and the tags say who gets to settle it. CRITERIA is what keeps
this from being rhetoric: every rule arrives with `input → expect` rows, so
"is this right?" is answered by running something rather than by arguing. RATIONALE
keeps settled questions settled — the alternatives considered are written down, so
"why not X?" has an answer on file instead of a re-litigation. This is the function
that saves the most time on a long project and the one people most reliably skip,
because its value is invisible until the sixth month.

**Updating guide — change management.** This is where the stable IDs earn out. A
change arrives as "D-17 is wrong," and `D-17` locates the rule, its criteria rows,
its test directory, and every line of code that cites it. ARCHITECTURE_LOG keeps
the history *out* of the current-state docs, so the reference never silts up with
"formerly," "originally named," "reversed in March" — a reader should never have to
subtract history to find the truth. And the teleology review (does each thing still
do what it's for?) is only possible because `Serves:` exists. Without it nothing in
a codebase is ever cut, because nothing can be *shown* to be dead.

---

## §2 What it costs, and when not to do this [P]

A value proposition that won't name its price isn't one.

- It is **real overhead**, front-loaded, before anything runs.
- It is **wrong for small CRUD work.** The skill already says so: use SPEC.md and
  borrow these properties as sections. Five entities and two rules don't need four
  files.
- It **fails silently if the docs and code diverge** — the one failure mode that
  reintroduces exactly the UML problem. Mitigation is that criteria rows own test
  directories and code cites IDs, so divergence shows up as a failing test rather
  than as a stale diagram. This needs to be true in practice, not just in the
  skill.
- The `[D]`/`[P]` distinction **only works if it's enforced.** A `[P]` that gets
  silently promoted to a rule has destroyed the one property that makes the doc
  trustworthy.

It pays when the thing will be tuned, when the numbers are uncertain, when more
than one person or session touches it, or when it will outlive your memory of
writing it. Games, rule engines, protocols, simulations, anything with emergent
behavior. That's the honest boundary.

---

## §3 What consolidation produces [P]

Open for direction — the value proposition above was the ask, and this part
shouldn't be settled unilaterally.

1. **A worked reference example.** One real doc set, complete and consistent,
   that the skill can point to. Candidate: pull an existing yuwakisagpt app
   backwards into the format and see what the format catches. The lyrics app or
   the shared model-selector contract are both plausible; something already built
   is better than something hypothetical, because the conversion is where the
   format either proves itself or doesn't.
2. **Skill refinements driven by that example.** Whatever the conversion exposes as
   underspecified in `ontology_spec` gets fixed there, not patched in the example.
3. **This document, kept current**, as the argument for the practice.

Explicitly *not* planned: generating OWL, or any tooling, until the markdown
practice is solid. Markdown is the right call for now and the last conversation
settled why.

---

## §4 Open questions

- **Q-1** Which app becomes the reference example? Converting something already
  built tests the format harder than authoring fresh, but it also risks
  documenting accidents as if they were decisions.
- **Q-2** Does PLAN.md live here permanently as the practice's rationale, or does
  it fold into a RATIONALE.md once the doc set exists? Keeping both risks two
  places making the same argument.
- **Q-3** What's the smallest honest evidence that this works? "It feels better"
  is not a claim. Candidates: tokens-to-orientation for a cold session, or count
  of design bugs caught during doc-writing rather than during implementation.
- **Q-4** Does the practice need a short "reading an ontology doc set" page for
  someone encountering one for the first time, or is the format self-evident
  enough to skip it?
