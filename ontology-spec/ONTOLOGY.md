# ONTOLOGY.md — The Ontology-Spec Site

This is the implementation reference for the four-page site in this directory. It
describes the *presentation*, not the practice: what the pages are, what each one owes
the reader, and what must always hold across them. The practice itself is argued in
PLAN.md and TOOLING.md, which own all of the detail.

**Tags.** **[D]** decided by the designer · **[P]** proposed, pending review ·
**[T]** tunable, expected to change.

**Namespace.** Plain `G-n`/`D-n` in this file belong to the *site*. The practice's own
goals and questions live in PLAN.md and are always qualified here as `PLAN G-1`,
`PLAN Q-3`. The two sets share a directory and must never share an identifier.

**Status [D].** There is deliberately no CRITERIA.md and no test directory: this is a
static site of four pages, and the overhead wouldn't pay. The invariants below are
therefore *stated, not enforced* — they hold because someone checked, which is the
honest description. TOOLING.md's checkers are where they would move if the site grew.

---

## §0 Purpose [D]

The site exists to make the case for problem-space design docs to a reader who arrives
skeptical, and to hand that reader something they can use the same day.

*Serves:* `PLAN G-1` (hold up under pushback) and `PLAN G-2` (a worked reference to
point at). The site is also the answer to `PLAN Q-1` — it is the first complete thing
built under the practice, and a presentation is a hard test, because it's exactly the
kind of artifact people normally spec after the fact.

### Qualities the reader should experience

- **Earns the next page.** Each page ends by naming a reason to continue, not a menu.
- **Nothing on faith.** Every claim either carries its argument on the page or names
  the source that holds it.
- **Operational.** The reader can start the same day, not after a reading list.
- **Visibly honest.** The cost and the open questions are on the site, not omitted from
  it. A reader who finds the weak spot should find we got there first.
- **Gently presented.** The reader is being introduced to an idea, not reminded of one
  they already hold. Explain, don't announce. Short sentences, plain words, few
  em-dashes, and no paragraph that ends by delivering a verdict ("That's the real
  lesson", "This is the point"). Where something is uncertain, say so in the first
  person rather than asserting it flatly.

### Goals, in priority order

- **G-1 Survive informed pushback.** A reader who knows UML's history, or who knows
  "ontology" as a Semantic Web term, finds their objection stated in their own
  vocabulary and answered — or conceded.
- **G-2 Convince a skeptical practitioner** that the thesis is right, or give them
  enough to show it isn't.
- **G-3 Make it startable.** The prompts page is usable without reading the others.
- **G-4 Stay cheap.** No build step, no second copy of the markdown's detail.

**Priority when they conflict:** G-1 over G-2. A page that persuades but can't take a
question is worse than no page, because it spends credibility that the practice then
has to earn back. G-4 yields to everything except G-1.

### Non-goals (for now)

- Not a tutorial. `practice.html` is a reference card, not a course.
- Not a doc viewer. The markdown is read in the repo, not rendered here.
- No build step, no framework, no analytics. JavaScript is limited to copy buttons.
- Not the owner of detail. Every number and every full argument lives in a Source.

---

## §1 Entities

### Page
*Serves:* G-1, G-2, G-3.

| Field | Type | Notes |
|---|---|---|
| `file` | filename | One of exactly `PAGE_COUNT` files at this directory's root |
| `title` | string | The reader-facing name, in the nav |
| `role` | enum | `case` \| `reference` \| `operational` \| `defense` |
| `thesis` | one sentence | What the page is for; appears near the top as a standfirst |
| `sections` | list of Section | Heading plus body |
| `exit` | string | The named reason to go to a specific next page |
| `sources` | list of Source | Which markdown owns this page's detail |

### Claim
*Serves:* G-2, and the "nothing on faith" quality.

| Field | Type | Notes |
|---|---|---|
| `text` | string | An assertion a reader could dispute |
| `page` | Page | Where it appears |
| `support` | enum | `argued-here` (the reasoning is on the page) or `sourced` (names the file that holds it) |
| `source_ref` | Source + named target | Required when `support = sourced`. Named target, never a section number |

### Objection
*Serves:* G-1.

| Field | Type | Notes |
|---|---|---|
| `text` | string | Stated in the skeptic's vocabulary, not a straw version |
| `answer` | string | The response |
| `disposition` | enum | `answered` \| `conceded` \| `open` |

### Prompt
*Serves:* G-3.

| Field | Type | Notes |
|---|---|---|
| `phase` | enum | `orient` \| `start` \| `convert` \| `build` \| `review` \| `reconcile` \| `measure` \| `audit` |
| `text` | string | Copyable verbatim; no placeholders beyond `<app>` / `<idea>` |
| `good_output` | string | What a good response looks like, so the reader can tell |
| `failure_prevented` | string | The specific failure this prompt exists to stop |

### Source

| Field | Type | Notes |
|---|---|---|
| `file` | filename | `PLAN.md`, `SUMMARY.md`, `TOOLING.md`, `ONTOLOGY.md` |
| `owns` | string | The detail this file is authoritative for |

### Nav
The fixed link set carried identically by every page: one entry per Page, the current
one marked and not a link.

---

## §2 Relations and invariants

- There are exactly `PAGE_COUNT` pages. Adding a fifth is a design decision, not an
  edit.
- **Every page carries the full Nav.** Any page is reachable from any other in one
  click; there are no dead ends and no back-button-only paths.
- `index.html` is the site's only entry point from the repository root page.
- **Every Claim has support.** No assertion appears with neither its argument nor a
  named source.
- **No page states a number that a Source doesn't.** Numbers are cited by name where
  the practice names them.
- **No page cites a Source by section number.** Named targets only — the one rule this
  project has already broken once, when inserting PLAN's prior-art section silently
  invalidated four `PLAN §n` citations in TOOLING.md.
- **No page restates a Source section in full.** Pages are shorter and differently
  shaped than the markdown: scannable for a browsing reader, where the markdown is
  structured for an implementer. This is what keeps four HTML pages from being a second
  copy of the argument (`PLAN Q-2`, one level up).
- **At least one Objection is `conceded` or `open`.** A defense page where every
  objection is answered is advocacy, and a reader can tell.
- **Every Prompt has all three parts** — text, good output, failure prevented. A prompt
  without its failure is decoration.
- **Every page opens from `file://`.** No build, no modules, no network fetches; the
  stylesheet is a plain `<link>` and the only script is inline.
- Styling follows the Yuwakisa house style: `COLUMN` width, the `ACCENT_FROM` →
  `ACCENT_TO` gradient on white cards, Segoe UI / Arial.

---

## §3 The four pages

| `file` | `title` | `role` | `thesis` |
|---|---|---|---|
| `index.html` | The case | `case` | Design docs should describe the problem, because the one thing that made that impractical for thirty years stopped being true. |
| `practice.html` | The doc set | `reference` | Four documents, four readers, four paces — and the mechanisms that keep them from rotting. |
| `prompts.html` | Prompts | `operational` | The cycle as things you type, each with the failure it prevents. |
| `objections.html` | Objections and costs | `defense` | What this costs, when not to do it, and the two strongest arguments against it. |

**Sources.** `index.html` and `objections.html` draw on PLAN.md and SUMMARY.md;
`practice.html` draws on the `ontology_spec` skill, which has no public home in this
repository; `prompts.html` is net-new — its content exists only in the skill, so the
page duplicates nothing here. That asymmetry is why the prompts page is the one that
most clearly earns its place.

---

## §4 Rules

### Page composition
*Serves:* G-1, G-2, "earns the next page".

```
render(page):
  nav(all pages, current = page)      # identical on every page
  standfirst(page.thesis)
  for section in page.sections: heading + body
  exit(page.exit)                     # names the next page and why
  footer(link back to repo root, link to the markdown sources)
```

### Claim admission
*Serves:* "nothing on faith".

```
admit(claim):
  if claim.support == 'argued-here': require reasoning present on the page
  if claim.support == 'sourced':     require named target in a Source
  if claim states a number:          require that number to exist in a Source
  else: reject                       # cut it, or go argue it in the markdown first
```

### Objection handling
*Serves:* G-1.

```
present(objection):
  state it in the skeptic's own words, at its strongest
  answer it, concede it, or mark it open — never soften the statement to fit the answer
  if all objections on the page are 'answered': the page is advocacy; find the real one
```

### Tone
*Serves:* the "gently presented" quality.

```
write(paragraph):
  prefer the short sentence to the stacked one
  if it ends on a verdict ('which is the real lesson', 'that is the point'): cut the verdict
  if it asserts something uncertain: say 'I think' or name the doubt
  if a word is doing rhetorical work only ('exactly', 'precisely', 'fatal'): drop it
  address the reader as 'you'; introduce the idea rather than confirm it
```

### Prompt entry
*Serves:* G-3.

```
entry(prompt):
  show prompt.text verbatim, copyable in one click
  show prompt.good_output      # so the reader can judge the response
  show prompt.failure_prevented
  if any part missing: the entry doesn't ship
```

---

## §6 Numbers [T]

| Name | Value | Unit | Notes |
|---|---|---|---|
| `PAGE_COUNT` | 4 | pages | `[D]` — a fifth page is a design decision |
| `PROMPT_COUNT` | 9 | entries | `[T]` — nine across the eight phases; `start` carries two |
| `COLUMN` | 60 | rem | House style, from the Principle Benchmark page |
| `ACCENT_FROM` | `#32CD32` | hex | House gradient start |
| `ACCENT_TO` | `#00BFFF` | hex | House gradient end |
| `PAGE_BG` | `#fafafa` | hex | House background |
| `READ_TARGET` | 3 | minutes | `[T]` — per page; the ceiling that keeps pages from becoming the markdown |

---

## §7 The interface

A static site's interface is its navigation plus its one action.

**Navigation.** Every page links to the other three and to the repository root. The
current page appears in the nav as plain text, not a link.

| From | To | Why |
|---|---|---|
| any | any other | Nav, identical everywhere |
| `index.html` | `prompts.html` | The exit: convinced, now start |
| `index.html` | `objections.html` | The exit for the unconvinced reader |
| `practice.html` | `prompts.html` | Knowing the shape, now run the cycle |
| `objections.html` | `index.html` | Objections answered, back to the case |

**Commands.**

| Command | Legal when | Effect | Side effects |
|---|---|---|---|
| `copy(prompt)` | On `prompts.html`, clipboard available | Prompt text to the clipboard | Button confirms for a moment, then reverts |

**Client contract.** No state is persisted, nothing is fetched, nothing is measured. If
the clipboard API is unavailable the prompt text is still selectable on the page, so
`copy` is an affordance and never a requirement.
