Prompt Design for Legal Citation Extraction

*Process and Decision-Making*

The Problem

A user needed to extract every citation to legal authority from a
Supreme Court brief, identified by page number and the text of the
citation. The task sounds mechanical, but previous attempts with LLMs
had failed in a specific and predictable way: the models could not
distinguish between *citations* to legal authority and *references* to
legal authority. They flagged every mention of a case, statute, or legal
concept as a citation, whether or not it included the formal locator
information that makes a citation a citation.

This failure was not a surprise to the user. As they put it, the models
"were unable to distinguish between citations to legal authority and
mere references to legal authority---they identified all references as
citations whether they were or not." The user diagnosed this as a
reasoning failure: the models were performing surface-level pattern
matching (does this text mention a legal authority?) rather than
functional analysis (what is this text *doing* with the authority?).

Identifying the Core Distinction

The first challenge was articulating the distinction clearly enough to
serve as a prompt instruction. Every lawyer intuitively knows the
difference between citing a case and mentioning a case, but the
knowledge is tacit---it lives in professional practice, not in explicit
rules. Formalizing it required identifying the functional criterion that
separates the two categories.

We arrived at a test grounded in speech act theory: a citation performs
the act of *directing the reader to a findable source*, while a
reference performs the act of *invoking an authority's name or concept*.
The practical test is whether someone could walk into a law library and
locate the source from the text alone. "*Miranda v. Arizona*, 384 U.S.
436 (1966)" passes this test. "The *Miranda* rule" does not.

This framing resolved the ambiguity that had tripped up prior attempts,
but it introduced edge cases of its own. Short-form citations like *Id.
at 211* contain locator information, but only by back-reference to an
earlier full citation. Are they citations? Yes---they resolve to a
locator, just indirectly. What about *supra, p. 10*, which refers the
reader to an earlier page of the same brief? That is a structural
cross-reference, not a citation to external legal authority. These edge
cases needed explicit treatment in the prompt.

Designing the Classification System

Rather than forcing a binary classification that the model would get
wrong, we adopted a three-bucket system. The first bucket, CITATION,
captures every mention that contains or resolves to locator
information---full citations, short-form citations, pinpoint cites, and
*Id.* references. The second bucket, OTHER, captures narrative
references that invoke an authority by name without providing a way to
find it. The third bucket, REVIEW, captures genuinely ambiguous cases
where reasonable lawyers could disagree: record references like *App.
47* that have locator information but cite the record rather than
independent legal authority, citations to litigation filings like amicus
briefs, and internal cross-references within the same document.

This three-bucket approach was a deliberate design choice. The prior
attempts had failed because they asked the model to make a binary
judgment it was not equipped to make. By introducing the REVIEW
category, we converted the hardest classification decisions into an
explicit triage step, allowing a human to make the final call on the
cases where the model's judgment is least reliable. The system
acknowledges the limits of automated classification rather than
pretending they do not exist.

Prompt Architecture

The prompt is structured in layers. It opens with the task definition,
then immediately foregrounds the citation-versus-reference distinction
as the central intellectual challenge. The functional test is stated in
multiple ways: as a definition, as a practical heuristic ("could you
walk into a library and find it?"), and through the speech-act framing
(directing versus invoking). Redundancy here is intentional. The
distinction is subtle enough that a single formulation may not anchor
the model's behavior; multiple framings of the same concept increase the
chance that at least one will activate the right reasoning pattern.

The prompt then provides extensive pattern lists for each category.
These serve as surface-level heuristics that complement the deeper
functional test. A full case citation has a recognizable shape (*Party
v. Party, \[vol\] \[reporter\] \[page\] (\[court\] \[year\])*), and
giving the model these templates helps it identify citations quickly.
But the patterns alone are insufficient---which is exactly why previous
attempts failed. The patterns must be subordinate to the functional
test, not a replacement for it.

The most important section of the prompt is the ten worked examples.
These are deliberately constructed as contrastive pairs: the same
authority (*Miranda*) appears as a full citation, a narrative reference,
and a short-form *Id.* cite, each classified differently with an
explicit explanation of why. This technique---few-shot learning with
contrastive examples---is the single most effective lever for teaching a
model to make fine-grained distinctions. The model cannot fall back on
"this mentions a legal authority, so it's a citation" when the examples
demonstrate that the same authority is classified differently depending
on context.

Guarding Against Known Failure Modes

Several elements of the prompt are defensive measures against specific
failure modes observed in prior attempts. The mandatory "Basis for
Classification" column forces the model to articulate its reasoning for
every single row, making silent misclassifications visible. The
instruction that "'It's a citation' is not acceptable" as a basis forces
genuine engagement with the criteria rather than post-hoc
rationalization. The quality control checklist at the end asks the model
to verify its own output against the classification criteria, creating a
self-review step.

The prompt also addresses the *supra* trap specifically, because *supra*
references serve two different functions depending on whether they point
to the same brief or to a previously cited external authority. Without
explicit guidance, a model will likely classify all *supra* references
the same way, missing the functional difference.

What We Expect to Happen

The prompt was developed with a realistic expectation of partial
success. The clear cases---full citations with reporter volumes and page
numbers, bare case names used as adjectives---should be classified
correctly. The interesting question is whether the contrastive examples
and the functional test are sufficient to handle the middle ground: a
case name followed by a pinpoint cite several words later in the
sentence, or a statute named by its popular title in a context where the
public law number appeared two sentences earlier. These are the cases
where the model must reason about what the text is doing, not just what
it contains.

The REVIEW bucket exists as an acknowledgment that some classification
decisions require legal judgment that exceeds what any prompt can
reliably encode. The goal is not to eliminate human review, but to focus
it on the cases that genuinely need it---and to ensure that the
automated classification is trustworthy enough that a human can filter
on CITATION with confidence that the results are real citations, not a
mix of citations and references that happened to mention a legal
authority.
