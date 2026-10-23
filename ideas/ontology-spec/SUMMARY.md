# Design docs should describe the problem, not the code

A design doc written in the vocabulary of implementation is a second, worse copy of
your program. A design doc written in the vocabulary of the *problem* is a different
kind of artifact — and for thirty years it was impractical, because a human had to
carry it across to working code by hand. Language models do that crossing for free.
That single change makes the problem-space document the most durable thing in a
repository.

Three claims.

---

## 1. The ontology defines the problem space, not the code space

The clearest way to see this is why UML modeling collapsed.

A UML class diagram nominally models a domain. In practice it's drawn in
implementation vocabulary — classes, fields, visibility modifiers, associations with
multiplicities that are foreign keys wearing a hat. It is a picture of the code you
intend to write. Two fatal properties follow:

- **Redundant the moment the code exists.** Anything the diagram says, the code says
  too, more precisely and executably. Maintaining it is duplicate work, so people
  stopped. Correctly.
- **Never independently checkable.** You can't ask "is this diagram true?" — only
  "does the code match it?" And when the answer is no, nothing tells you which one
  is wrong.

An ontology makes claims about the problem instead. *"A song has exactly one credited
artist."* That's a statement about music, true or false about the world rather than
about the repo. Which buys you:

- **Review by someone who can't read the code.** The designer can check it on its own
  terms. This is what makes a provenance tag meaningful — marking which claims are the
  designer's only makes sense if the doc is about the problem. Nobody needs approval
  to rename a variable; everybody needs it to decide whether a song can have two artists.
- **Survival through refactoring.** Refactoring changes the code space by definition
  and the problem space not at all. Problem-space docs decay slower than anything
  code-shaped.
- **Disagreements in the right place.** Two parts of a system contradicting each other
  is usually two beliefs about the domain. Better settled once as a design question
  than patched twice as a bug.

## 2. The mapping onto code is now free

This is what actually changed.

The problem/code gap was always real — it just wasn't affordable. A human had to
translate, slowly and lossily, exactly once. Given that, you may as well skip a step
and write the spec in implementation terms. That tradeoff was *correct*.

Models are very good at this specific crossing. The word is **analogical**: not
compiling, but finding a structure-preserving mapping from the shape of a domain onto
the shape of a framework. Consequences:

- **The mapping re-runs.** One problem-space doc lands on vanilla JS, on Spring Boot,
  on something that doesn't exist yet. A code-space spec can't re-target — it already
  committed to one analogy and discarded the source.
- **A code-vocabulary spec wastes the model.** It pre-decides the part models are best
  at, while leaving underspecified the parts they're worst at: what the thing is *for*,
  which numbers are load-bearing, what must never happen. The division of labor that
  falls out is clean — humans own the problem and the purpose, models own the mapping.

The common intuition is that AI coding makes specs matter less, because code is cheap
now. It's backwards. When code becomes cheap and regenerable, code stops being the
asset and becomes the build output — and the spec becomes the thing you own. Specs
matter *more* in this world, and problem-space specs most of all, because they're the
only kind the cheap-regeneration property applies to.

## 3. Lasting value: map, touchstone, updating guide

Three jobs that get run together and shouldn't be.

**Map.** Code tells you what exists and is terrible at telling you where anything is
or why it's arranged that way. The payoff that's measurable today: a problem-space doc
is what you load *instead of* the codebase. It's the highest value-per-token artifact
in the repo. A session that starts by reading it is oriented in a few thousand tokens;
one that starts by grepping is still guessing twenty tool calls later.

**Touchstone.** When two readings are possible, one place settles it. What keeps this
from being rhetoric is pairing every rule with `input → expect` rows, so "is this
right?" is answered by running something instead of by arguing — and writing down the
alternatives considered, so "why not X?" has an answer on file rather than a
re-litigation. This saves the most time on long projects and is the function people
most reliably skip, because its value is invisible until month six.

**Updating guide.** Stable IDs mean a change arrives as "D-17 is wrong," and that ID
locates the rule, its test cases, and every line of code citing it. History lives in a
separate log so the reference never silts up with "formerly" and "reversed in March."
And tagging what each thing *serves* is the only reason anything ever gets cut —
without it, nothing in a codebase can be shown to be dead.

---

## What it costs

Not naming the price would make this a sales pitch.

- Real overhead, front-loaded, before anything runs.
- Wrong for small CRUD work. Five entities and two rules don't need this.
- Fails silently if docs and code drift — the exact failure that reintroduces the UML
  problem. The mitigation (test cases own the rules, code cites IDs) has to be true in
  practice, not just on paper.

It pays when the thing will be tuned, when the numbers are uncertain, when more than
one person or session touches it, or when it outlives your memory of writing it.

## What I'd want argued

- Is the UML comparison fair, or is the real lesson just "all docs rot"?
- Is "models cross the gap for free" load-bearing, or does it only hold for domains
  that already resemble their frameworks?
- What's the smallest honest evidence this works? "It feels better" isn't a claim.
- Is this OWL with extra steps? "Ontology" has been a computer-science term since
  Gruber in 1993, with a whole Semantic Web stack behind it, so the comparison is
  owed an answer rather than a dismissal. Mine: those ontologies exist to be
  *computed over* — subsumption, classification, inference — and this one exists to
  be *read and crossed by a model*. Different consumer, so OWL's ceilings are beside
  the point rather than obstacles. Is that a real distinction or a convenient one?
