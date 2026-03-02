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

A citation is a **formal, structured reference that contains sufficient locator information to find the source.** It performs the speech act of **directing the reader to a findable source.** The test is: **could a person walk into a law library and find the source from this text alone?**

A citation includes some combination of:
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

A reference is a **mention of a legal authority by name or concept, without any locator information.** It performs the speech act of **invoking the authority's weight or relevance** without directing the reader to a specific source.

Examples of references (NOT citations):
- "this Court's landmark decision in *Cabazon Band*" — the case is named but no reporter, volume, or page is given
- "under the Restoration Act" — the statute is named but no public law number, code section, or Statutes at Large reference is given
- "consistent with Public Law 280" — named but not cited
- "Congress enacted IGRA" — the statute is invoked by acronym with no locator
- "the Cabazon Band framework" — the case name is used as a conceptual label
- "the Fifth Circuit in *Ysleta I*" — a case is named without locator information
- "as this Court held in *Bryan* and *Cabazon Band*" — two cases are named narratively
- "the prohibitory/regulatory framework from this Court's decision" — conceptual invocation of a holding without naming or citing it

### The key functional test

Ask yourself: **What is the text DOING with this authority?**

- If the text is **pointing the reader to a specific, findable location** → CITATION
- If the text is **invoking the authority's name, concept, or weight** without providing a way to find it → OTHER (reference)

This is a question about the **purpose** of the mention, not its **content**. The same authority can appear as a citation in one sentence and a reference in the next:

> "In *California v. Cabazon Band of Mission Indians*, 480 U.S. 202 (1987), this Court held that states could not regulate tribal gaming." ← **CITATION** (full case name, reporter, page, year)

> "The Restoration Act clearly codifies the *Cabazon Band* framework." ← **OTHER** (name invoked conceptually, no locator)

> "*Id.* at 209." ← **CITATION** (short-form with pinpoint, resolves to Cabazon Band via back-reference)

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
3. For each mention, apply the functional test: is this text providing a locator (CITATION), invoking a name/concept (OTHER), or ambiguous (REVIEW)?
4. Record the mention with all required fields.
5. Move to the next page.

### Common patterns to watch for:

**Full citations** (always CITATION):
- `[Party] v. [Party], [vol] [reporter] [page] ([court] [year])`
- `[Title] U.S.C. § [section]`
- `Pub. L. No. [number], [vol] Stat. [page]`
- `[vol] Cong. Rec. [page] ([year])`
- `S. Rep. No. [number], at [page] ([year])`
- `[Code] Ann. § [section]`

**Short-form citations** (always CITATION):
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
- [ ] No mention has been classified as CITATION unless it contains or resolves to locator information
- [ ] No mention has been classified as OTHER if it contains a volume/reporter/page, code section, public law number, or other locator
- [ ] The Basis for Classification column explains the reasoning for every single row
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
| CITATION | Miranda v. Arizona, 384 U.S. 436 (1966) | Full case citation with reporter and page |

### Example 2: Narrative reference → OTHER
> "The *Miranda* rule requires that..."

| Classification | Text | Basis |
|---|---|---|
| OTHER | Miranda | Case name invoked without locator; used as conceptual shorthand |

### Example 3: Short-form citation → CITATION
> "Id. at 444."

| Classification | Text | Basis |
|---|---|---|
| CITATION | Id. at 444 | Short-form back-reference with pinpoint page; resolves to Miranda |

### Example 4: Statute by name only → OTHER
> "Congress later enacted the Civil Rights Act to address..."

| Classification | Text | Basis |
|---|---|---|
| OTHER | the Civil Rights Act | Statute named without public law number, code section, or Statutes at Large cite |

### Example 5: Statute with code section → CITATION
> "42 U.S.C. § 1983 provides a cause of action."

| Classification | Text | Basis |
|---|---|---|
| CITATION | 42 U.S.C. § 1983 | Full code citation with title and section |

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

Both are CITATIONS — *Smith* as a short-form, and *Brown* as a full cite within the parenthetical.

---

## IMPORTANT REMINDERS

1. **Every mention gets its own row.** If *Cabazon Band* appears 30 times in the brief, it gets 30 rows. Do not deduplicate.

2. **The same authority can be a CITATION on one page and OTHER on a different page.** Classification depends on what the text is doing with the authority in that specific instance.

3. **When in doubt, include it.** Over-inclusion is far preferable to silent omission. If you're unsure whether something is a mention of legal authority at all, include it and classify as REVIEW.

4. **The "Basis for Classification" column is mandatory and must be substantive.** "It's a citation" is not acceptable. Explain what specific locator information is present (for CITATION) or absent (for OTHER), or what makes it ambiguous (for REVIEW).

5. **Do not confuse the content of an authority with the act of citing it.** A sentence can discuss a case at length without ever citing it. Conversely, a bare `Id.` with no surrounding discussion is a citation.

6. **Watch for authorities that are introduced with a full citation early in the brief and then referenced by name only for the rest of the document.** The initial full citation is a CITATION. Every subsequent name-only mention is OTHER. Every subsequent short-form with a pinpoint (e.g., `480 U.S. at 209`) is a CITATION.
