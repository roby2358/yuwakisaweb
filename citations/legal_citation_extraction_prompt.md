# Legal Citation Extraction Prompt

## For use with Claude Code or any LLM-based extraction pipeline

---

## TASK

You are given a legal brief filed in a court proceeding. Your job is to identify **every mention of any legal authority** in the body of the brief, and classify each mention into one of three categories: **CITATION**, **OTHER**, or **REVIEW**.

The output should be a structured spreadsheet (XLSX) with one row per mention, ordered by page of appearance.

---

## THE CRITICAL DISTINCTION: CITATION vs. REFERENCE

This is the core intellectual challenge of this task. LLMs consistently fail here by treating all mentions of legal authority as "citations." They are not. There is a functional difference between **citing** an authority and **referring to** an authority, and you must distinguish between them.

### What is a CITATION?

A citation requires **two things, both of which must be present:**

1. **Intent to cite**: The author is **invoking the authority as support for a legal proposition** — deploying it as evidence, precedent, or justification for an argument. The authority is doing legal work in the sentence.
2. **Locator information**: The text contains **sufficient information to find the source** — a volume/reporter/page, code section, public law number, or equivalent.

**Neither element alone is sufficient.** A locator without citational intent is just an identifying parenthetical attached to a narrative reference (see the critical trap below). An invocation of authority without a locator is a reference, not a citation.

The primary test is always: **What is the author DOING with this authority in this sentence?** Is the author marshaling it as support for a proposition? Or is the author mentioning it as part of a narrative, a historical account, or a description of what happened?

A citation's locator information includes some combination of:
- A volume number and reporter abbreviation (e.g., `480 U.S. 202`, `36 F.3d 1325`, `658 F.2d 310`)
- A title and section of a code (e.g., `25 U.S.C. § 2702(1)`, `Tex. Occ. Code Ann. § 2001.001`)
- A public law number and/or Statutes at Large reference (e.g., `Pub. L. No. 100-89, 101 Stat. 666`)
- A Congressional Record volume and page (e.g., `133 Cong. Rec. 22,114 (1987)`)
- A report number and page (e.g., `S. Rep. No. 100-446, at 5 (1988)`, `H.R. Rep. No. 99-440, at 2–3`)
- A hearing citation with committee, congress number, and page
- A Westlaw or Lexis citation (e.g., `2016 WL 3039991`)
- A dictionary or treatise with edition and year (e.g., `Black's Law Dictionary (11th ed. 2019)`)

**Short-form citations are also CITATIONS.** These include:
- `Id.` and `Id. at [page]` — these refer back to the immediately preceding citation
- `[Case name], [vol] [reporter] at [page]` — e.g., `Bryan, 426 U.S. at 392`
- `[Statute] § [section]` when referring back to a previously cited title — e.g., `id. § 2710(d)`
- `supra, p. [X]` or `supra, Part I.C` — internal cross-references to earlier pages/sections of the same brief

Short-form citations ARE citations because they resolve to a locator through back-reference. `Id. at 211` means "the same source I just cited, at page 211." A reader can trace the chain back to the full citation and find the source.

### What is a REFERENCE (classified as "OTHER")?

A reference is a **mention of a legal authority where the author's intent is narrative, historical, or contextual rather than citational.** The author is telling a story, describing a sequence of events, or providing background — not invoking the authority as support for a legal proposition.

References usually lack locator information, but **the presence of a locator does not automatically make something a citation.** Authors sometimes attach identifying information (including full case citations) to authorities they are merely narrating about, as a courtesy to the reader. The locator is decorative, not functional — it identifies the authority but the author is not deploying it as support for a proposition.

Examples of references (NOT citations):
- "this Court's landmark decision in *Cabazon Band*" — the case is named but no reporter, volume, or page is given
- "under the Restoration Act" — the statute is named but no public law number, code section, or Statutes at Large reference is given
- "consistent with Public Law 280" — named but not cited
- "Congress enacted IGRA" — the statute is invoked by acronym with no locator
- "the *Cabazon Band* framework" — the case name is used as a conceptual label
- "the Fifth Circuit in *Ysleta I*" — a case is named without locator information
- "as this Court held in *Bryan* and *Cabazon Band*" — two cases are named narratively
- "the prohibitory/regulatory framework from this Court's decision" — conceptual invocation of a holding without naming or citing it

**CRITICAL: The narrative-with-locator trap.** This is the pattern most likely to cause misclassification:

> "Agreeing with the 'prohibitory/regulatory' framework originally adopted by the Fifth Circuit in *Seminole Tribe of Florida v. Butterworth*, 658 F.2d 310 (5th Cir. Unit B 1981), and applied by the Ninth Circuit in the decision under review, the Court held..."

This has a full locator — volume, reporter, page, court, year. But the author is **narrating the history of a legal doctrine**, not citing Seminole Tribe as authority for a proposition. Seminole Tribe appears as a historical waypoint in the story of how the Cabazon Band framework developed. The full citation is an identifying parenthetical, not a deployment of authority. **This is OTHER, not CITATION.**

Compare with a true citation of the same case:

> "Texas's bingo laws were held to be regulatory. *See Cabazon Band*, 480 U.S. at 210–11; *Seminole Tribe*, 658 F.2d at 314–15."

Here the author IS deploying Seminole Tribe as support for the proposition that bingo laws are regulatory. **This is CITATION.**

The difference is not in the locator (both have one). The difference is in what the author is doing: narrating history vs. marshaling authority.

### The key functional test (TWO-STEP)

**Step 1 — Intent (primary):** Ask: **What is the author DOING with this authority?**

- Is the author **marshaling the authority as support** for a legal proposition, rule, or argument? → Candidate for CITATION
- Is the author **narrating, describing, or providing historical context** about the authority? → OTHER, regardless of whether a locator is present
- Is the author **using the authority's name as a conceptual label** (e.g., "the *Chevron* framework")? → OTHER

**Step 2 — Locator (secondary, applies only if Step 1 = candidate for CITATION):** Ask: **Does the text include locator information?**

- Locator present (volume/reporter/page, code section, etc.) → CITATION
- No locator, but resolves via back-reference (*Id.*, short-form, *supra*) → CITATION
- No locator and no back-reference → OTHER

**Intent always governs.** If the author is narrating and a locator happens to be present, the mention is still OTHER. The locator is necessary for a CITATION but never sufficient on its own.

This is a question about the **purpose** of the mention, not its **content**. The same authority can appear as a citation in one sentence and a reference in the next:

> "In *California v. Cabazon Band of Mission Indians*, 480 U.S. 202 (1987), this Court held that states could not regulate tribal gaming." ← **CITATION** (author is invoking Cabazon Band as authority for the proposition about state regulatory power; full locator present)

> "The Restoration Act clearly codifies the *Cabazon Band* framework." ← **OTHER** (name invoked conceptually as a label; no locator; narrative intent)

> "*Id.* at 209." ← **CITATION** (short-form with pinpoint, used to support a proposition; resolves to Cabazon Band via back-reference)

### What is REVIEW?

REVIEW is for mentions that are genuinely ambiguous — where reasonable lawyers could disagree about whether the mention constitutes a citation to "legal authority." These include:

- **Record references** such as `App. 122` (Appendix), `Petition Appendix 1–17` — these cite the litigation record, not independent legal authority. Most users would exclude them, but they are locator-equipped.
- **Citations to litigation filings** such as `Brief for the United States as Amicus Curiae 10` or `Brief of Appellee at 20` or `Conditional Cross-Petition at 9` — these are filings in the case, not independent legal authority, but they do contain locator information and may carry persuasive weight.
- **Internal cross-references** like `supra, p. 10` or `supra, Part I.C` that refer to other parts of the same brief rather than to an external legal authority.

Tag these as REVIEW so a human can make the final call.

---

## WHAT COUNTS AS "LEGAL AUTHORITY"

Cast a wide net. Legal authority includes:
- **Cases** (judicial opinions at any level)
- **Statutes** (federal, state, public laws, session laws)
- **Constitutional provisions**
- **Regulations** (C.F.R., state regulatory codes)
- **Court rules** (Fed. R. Civ. P., local rules)
- **Legislative history** (committee reports, hearing transcripts, floor statements, Congressional Record entries)
- **Secondary sources** (treatises, dictionaries, law review articles, Restatements, legal encyclopedias)
- **Executive orders, AG opinions, administrative decisions**

When in doubt about whether something is "legal authority," include it and classify it. It is better to over-include and let the human filter than to silently omit.

---

## WHAT TO EXCLUDE

- **The Table of Authorities** (usually near the front of the brief). This is itself a citation index; extracting it would be circular.
- **The cover page, table of contents, and signature block** — structural elements, not argument.
- **Quotations from authorities that happen to mention other authorities** — if the brief quotes a court opinion that itself cites another case, you are extracting the brief's citation to the opinion it quotes, not the internal citations within the quotation. However, if the brief independently cites a case that also appears inside a quotation, that independent citation should be captured.

---

## OUTPUT FORMAT

Create an XLSX spreadsheet with the following columns, in this order:

| Column | Name | Description |
|--------|------|-------------|
| A | Brief Page | The page number as printed in the brief (may be roman numerals for front matter) |
| B | PDF Page | The corresponding PDF page number for cross-reference |
| C | Classification | One of: CITATION, OTHER, REVIEW |
| D | Citation/Reference Text | The actual text of the mention as it appears in the brief |
| E | Authority (Normalized) | A normalized/standardized name for the authority (for grouping — e.g., all mentions of *Cabazon Band* should share the same normalized name regardless of whether they are citations or references) |
| F | Type of Authority | Category: Case, Statute, Legislative History, Secondary Source, Filing, Record, Internal, Constitutional Provision, Regulation, etc. |
| G | Basis for Classification | A brief explanation of WHY this mention was classified as CITATION, OTHER, or REVIEW. This is the most important column for quality control. |

### Formatting requirements:
- Color-code the Classification column: green for CITATION, orange for OTHER, yellow for REVIEW
- Enable autofilter on the header row
- Freeze the header row
- Add a Summary tab with counts by classification and by authority type
- Add a Legend tab explaining the methodology and classification criteria

---

## PROCESS

Work through the brief page by page, in order. For each page:

1. Read the entire page.
2. Identify every mention of any legal authority — whether cited formally or referenced by name.
3. For each mention, apply the two-step functional test: (a) Is the author marshaling this authority as support for a proposition, or narrating/describing? (b) If citational intent, is a locator present or resolvable? Classify accordingly.
4. Record the mention with all required fields.
5. Move to the next page.

### Common patterns to watch for:

**Full citations** (CITATION if intent is citational; OTHER if intent is narrative — see Step 1):
- `[Party] v. [Party], [vol] [reporter] [page] ([court] [year])`
- `[Title] U.S.C. § [section]`
- `Pub. L. No. [number], [vol] Stat. [page]`
- `[vol] Cong. Rec. [page] ([year])`
- `S. Rep. No. [number], at [page] ([year])`
- `[Code] Ann. § [section]`

**WARNING:** The presence of these patterns does NOT automatically mean CITATION. You must still apply the intent test. A full case citation embedded in a narrative passage ("the framework originally adopted by the Fifth Circuit in *Seminole Tribe of Florida v. Butterworth*, 658 F.2d 310 (5th Cir. Unit B 1981)") is OTHER because the author is narrating, not citing.

**Short-form citations** (CITATION when the author is deploying the authority for a proposition):
- `Id.` / `Id. at [page]`
- `[Short case name], [vol] [reporter] at [page]`
- `id. § [section]`
- `supra, p. [X]` / `supra, Part [X]`
- `[Short name] at [page]` (e.g., `CVSG Br. 21–22`, `S. Rep. at 10`)

**Narrative references** (always OTHER):
- A case name in italics mid-sentence with no volume, reporter, or page anywhere nearby
- A statute referred to by popular name only (e.g., "the Restoration Act," "IGRA," "Public Law 280") without any accompanying code section, public law number, or Statutes at Large reference
- Conceptual invocations like "the *Cabazon Band* framework" or "the *Bryan* analysis"
- Phrases like "this Court's decision in [case name]" where no locator follows

**Ambiguous / REVIEW:**
- `App. [page]` — record cite
- Citations to briefs or filings in the same case
- `supra` references to the same brief (internal, not external authority)

### A special note on `supra` references:

`supra` can serve two different functions:
1. **Cross-reference to the same brief**: `supra, p. 10` or `supra, Part I.C` — this refers the reader to an earlier page of the document you're reading. Classify as REVIEW (it's structural, not a citation to authority).
2. **Back-reference to a previously cited authority**: `Conditional Cross-Petition, supra, at 8` — this uses `supra` to refer back to a full citation given earlier. Classify as CITATION (it resolves to a locator via the earlier cite). However, note the underlying authority may itself be a filing (REVIEW-worthy on the "is this legal authority?" axis).

---

## QUALITY CONTROL CHECKLIST

Before delivering the output, verify:

- [ ] Every mention on every page has been captured (err on the side of over-inclusion)
- [ ] No mention has been classified as CITATION unless the author's intent is citational (marshaling authority for a proposition) AND locator information is present or resolvable
- [ ] Mentions with locators but narrative intent (historical accounts, background descriptions, identifying parentheticals) have been classified as OTHER, not CITATION
- [ ] No mention has been classified as OTHER if the author is deploying it as support for a proposition and locator information is present
- [ ] The Basis for Classification column explains BOTH the intent determination and the locator determination for every single row
- [ ] Normalized authority names are consistent (the same authority always gets the same normalized name)
- [ ] The Table of Authorities has been excluded
- [ ] Page numbers are accurate

---

## EXAMPLE EXTRACTIONS

Here are worked examples from a hypothetical brief to calibrate your judgment:

### Example 1: Full citation → CITATION
> "In *Miranda v. Arizona*, 384 U.S. 436 (1966), this Court held..."

| Classification | Text | Basis |
|---|---|---|
| CITATION | Miranda v. Arizona, 384 U.S. 436 (1966) | Author is invoking Miranda as authority for a legal holding; full case citation with reporter and page |

### Example 2: Narrative reference → OTHER
> "The *Miranda* rule requires that..."

| Classification | Text | Basis |
|---|---|---|
| OTHER | Miranda | Case name invoked without locator; used as conceptual shorthand |

### Example 3: Short-form citation → CITATION
> "Id. at 444."

| Classification | Text | Basis |
|---|---|---|
| CITATION | Id. at 444 | Short-form back-reference with pinpoint page; resolves to Miranda; used in a citation sentence deploying the authority |

### Example 4: Statute by name only → OTHER
> "Congress later enacted the Civil Rights Act to address..."

| Classification | Text | Basis |
|---|---|---|
| OTHER | the Civil Rights Act | Statute named without public law number, code section, or Statutes at Large cite |

### Example 5: Statute with code section → CITATION
> "42 U.S.C. § 1983 provides a cause of action."

| Classification | Text | Basis |
|---|---|---|
| CITATION | 42 U.S.C. § 1983 | Author is stating a legal proposition about what the statute provides; full code citation with title and section |

### Example 6: Appendix reference → REVIEW
> "The district court found that the defendant had actual knowledge. App. 47."

| Classification | Text | Basis |
|---|---|---|
| REVIEW | App. 47 | Appendix/record reference — locator present but cites the record, not independent legal authority |

### Example 7: Amicus brief → REVIEW
> "As the United States explained, Brief for the United States as Amicus Curiae 10..."

| Classification | Text | Basis |
|---|---|---|
| REVIEW | Brief for the United States as Amicus Curiae 10 | Citation to litigation filing — locator present but may not constitute independent legal authority |

### Example 8: Case name used as adjective → OTHER
> "Under the *Chevron* framework, courts must defer..."

| Classification | Text | Basis |
|---|---|---|
| OTHER | Chevron | Case name used as conceptual modifier; no locator |

### Example 9: Multiple authorities in a string cite → each is a separate CITATION
> "*See Smith v. Jones*, 500 U.S. 100, 105 (1990); *Brown v. Green*, 450 U.S. 200, 210 (1985)."

Each case in the string cite gets its own row. Both are CITATIONS.

### Example 10: Authority mentioned inside a parenthetical → CITATION
> "*Smith*, 500 U.S. at 105 (citing *Brown v. Green*, 450 U.S. 200, 210 (1985))."

Both are CITATIONS — *Smith* as a short-form, and *Brown* as a full cite within the parenthetical. The author is deploying both as authority for a proposition.

### Example 11: CRITICAL — Full citation in a narrative passage → OTHER
> "Agreeing with the 'prohibitory/regulatory' framework originally adopted by the Fifth Circuit in *Seminole Tribe of Florida v. Butterworth*, 658 F.2d 310 (5th Cir. Unit B 1981), and applied by the Ninth Circuit in the decision under review, the Court held that..."

| Classification | Text | Basis |
|---|---|---|
| OTHER | Seminole Tribe of Florida v. Butterworth, 658 F.2d 310 (5th Cir. Unit B 1981) | Locator present, but the author is narrating the doctrinal history of the Cabazon Band framework, not deploying Seminole Tribe as authority for a proposition. The full cite is an identifying parenthetical within a historical account. Intent is narrative, not citational. |

**This is the pattern that most commonly causes misclassification.** The locator is right there — volume, reporter, page, court, year. A mechanical test would call it a citation. But the author is telling a story about how the law developed, and Seminole Tribe is a character in that story, not a source being marshaled for a legal argument.

### Example 12: The SAME authority as a true citation → CITATION
> "Texas's bingo laws are regulatory, not prohibitory, and thus do not apply on the reservation. *See Cabazon Band*, 480 U.S. at 210–11; *Seminole Tribe*, 658 F.2d at 314–15."

| Classification | Text | Basis |
|---|---|---|
| CITATION | Seminole Tribe, 658 F.2d at 314–15 | Author is deploying Seminole Tribe as authority supporting the proposition that bingo laws are regulatory. Locator present (reporter pinpoint). Intent is citational. |

Notice: the same case (*Seminole Tribe*), classified differently in Examples 11 and 12. **The authority doesn't change. The author's intent changes.**

---

## IMPORTANT REMINDERS

1. **Every mention gets its own row.** If *Cabazon Band* appears 30 times in the brief, it gets 30 rows. Do not deduplicate.

2. **The same authority can be a CITATION on one page and OTHER on a different page.** Classification depends on what the author is doing with the authority in that specific instance.

3. **When in doubt, include it.** Over-inclusion is far preferable to silent omission. If you're unsure whether something is a mention of legal authority at all, include it and classify as REVIEW.

4. **The "Basis for Classification" column is mandatory and must be substantive.** "It's a citation" is not acceptable. For every CITATION, explain both the citational intent AND what locator is present. For every OTHER, explain that the intent is narrative/conceptual AND whether a locator is absent or present-but-decorative. "Full case citation with reporter and page" is insufficient — you must also confirm that the author is deploying the authority for a proposition.

5. **A locator does not make a citation.** This is the single most important principle in this prompt. Authors frequently attach full case citations, complete with volume, reporter, page, court, and year, to authorities they are merely narrating about — describing what happened, recounting doctrinal history, or providing context. A locator attached to a narrative mention is an identifying label, not a citation. Always ask: is the author telling a story, or making an argument?

6. **Do not confuse the content of an authority with the act of citing it.** A sentence can discuss a case at length without ever citing it. Conversely, a bare `Id.` with no surrounding discussion is a citation.

7. **Watch for authorities that are introduced with a full citation early in the brief and then referenced by name only for the rest of the document.** The initial full citation is a CITATION (assuming citational intent). Every subsequent name-only mention is OTHER. Every subsequent short-form with a pinpoint (e.g., `480 U.S. at 209`) used to support a proposition is a CITATION.
