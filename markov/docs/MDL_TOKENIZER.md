# SPEC: MDL Subword Tokenizer

## Purpose

The MDL Subword Tokenizer produces a vocabulary of approximately 1100 subword
tokens learned from the source corpus using Minimum-Description-Length-style
credit assignment. It is a fourth tokenization mode alongside Words, Text, and
GPT.

Where GPT uses a prebuilt BPE vocabulary and Words/Text operate at character or
word granularity, this mode discovers corpus-specific subword units that tend to
align with morphemes (common prefixes, suffixes, and stems of the user's text).
The goal is shorter Markov sequences than character-level generation while
preserving the corpus-specific character of the source text that a prebuilt
tokenizer would erase.

## UI Layout

The tokenizer adds a fourth radio option alongside the existing three:

```
+---------------------------------------------------------+
|  ( ) words   ( ) text   ( ) gpt   ( ) phonetic   (•) mdl |
+---------------------------------------------------------+
```

All other UI elements (calculate, generate, source/generated tabs, output
length) behave identically to the existing modes.

## Functional Requirements

### Normalization

- The tokenizer MUST produce a normalized corpus before vocabulary mining by:
  - Stripping any character not in the set `[A-Za-z0-9 .!?']`
  - Collapsing runs of whitespace to a single space
- The tokenizer MUST preserve letter case. Both uppercase and lowercase letters
  pass through normalization unchanged.
- The tokenizer MUST NOT apply stemming, lemmatization, or Unicode normalization
  beyond the character-class filter.

### Candidate Collection

- The tokenizer MUST walk the normalized corpus character by character. At
  every position, including positions that are themselves a space, it MUST
  record every n-gram of length 2 through 12 that starts there and
  satisfies the word-boundary rule below. The upper bound is chosen so
  that most common English words fit as single candidates even with a
  leading space (e.g., ` something`, ` landscape`, ` cultivate`).
- Word-boundary rule: a space character MAY appear only as the first
  character of an n-gram. All other positions MUST be non-space. This
  allows tokens such as ` the` and ` and` to exist while disallowing
  tokens that span two words. This follows the BPE convention used by
  cl100k_base: the space that separates two words is attached to the
  start of the following word.
- The tokenizer MUST maintain a frequency tally of every candidate n-gram.
- 1-grams MUST NOT be collected at this stage; single characters are added
  later as guaranteed alphabet coverage.

### Credit Assignment

- After candidate collection the tokenizer MUST perform a single top-down
  credit-assignment pass over the tally:
  - Candidates MUST be processed in order of decreasing length.
  - Ties in length MUST be broken by descending raw frequency, then
    lexicographic order.
  - For each candidate, its tallied frequency MUST be subtracted from the tally
    of every proper substring it contains of length ≥ 2.
  - Adjusted frequencies MUST be clamped to zero. They MUST NOT go negative.
- The purpose of this pass is to prevent a long token and its substrings from
  both claiming the same occurrences.
- This pass only adjusts frequencies. It does not select the vocabulary.

### Vocabulary Selection

- The tokenizer MUST score every candidate after credit assignment using
  `adjusted_freq × (length − 1) ^ 1.5`.
- The tokenizer MUST admit the top 1024 candidates by score into the learned
  subword vocabulary. The count is tunable; the initial implementation MUST
  use 1024, chosen to align roughly with the 1000–3000 core English word
  count so the learned vocabulary can hold whole common words rather than
  fragmenting them.
- The tokenizer MUST then add, as guaranteed alphabet coverage, every single
  character in the normalization alphabet: the 26 uppercase letters, 26
  lowercase letters, 10 digits, the space character, and the four punctuation
  characters `.`, `!`, `?`, `'`. This is 67 single-character tokens.
- The final vocabulary MUST be deduplicated.

### Corpus Encoding

- The tokenizer MUST encode the normalized corpus into a token sequence using
  greedy longest-match:
  - The vocabulary MUST be sorted by descending length.
  - At each position in the corpus, the tokenizer MUST emit the longest
    vocabulary entry that matches starting at that position, then advance the
    cursor by that entry's length.
  - Because the vocabulary guarantees every single character in the
    normalization alphabet, every position is guaranteed to match.
- Greedy matching MAY produce globally suboptimal segmentations. This tradeoff
  is accepted in favor of determinism and speed.

### Markov Integration

- The tokenizer MUST conform to the project's tokenizer interface:
  - `calibrate(sourceText)` — establishes the current encoding scheme from
    the source corpus. For fixed-scheme tokenizers (Words, Text, GPT,
    Phonetic) this is a no-op. For MDL it trains and caches the subword
    vocabulary.
  - `tokenize(text)` — encodes text against the current scheme. For MDL
    this means encoding against the cached vocabulary; it MUST NOT retrain.
  - `format(groups)` — inverts the encoding and produces readable text for
    display.
- `calibrate(sourceText)` MUST run the full training pipeline (normalization
  → candidate collection → credit assignment → vocabulary selection) and
  cache the resulting vocabulary on the instance. Calling it again on a new
  corpus MUST overwrite the cache.
- `tokenize(text)` MUST return an array of Start/End-wrapped token sequences.
  When no vocabulary has been established (calibrate has not been called, or
  was called on empty input), tokenize MUST return an empty array.
- The tokenizer MUST produce a single Start/End-wrapped sequence for the
  entire corpus. Paragraph and newline boundaries are not preserved; the
  normalization step collapses all whitespace to single spaces, so this mode
  treats the corpus as one continuous stream. This differs from Text and GPT
  mode, which split by paragraph.
- The trained vocabulary is not persisted between sessions; it lives for the
  lifetime of the Mdl instance.

## Non-Functional Requirements

### Performance

- Training MUST complete in under one second for corpora up to 100 KB on
  typical consumer hardware.
- Candidate collection SHOULD avoid materializing the full n-gram string space
  when throughput is a concern; tallies MAY be keyed on substring indices or
  hashes rather than allocated strings.

### Code Quality

- The tokenizer MUST follow the existing project convention: a constructor
  function exposing `tokenize` and `format`, loaded via `<script>` tag in
  `index.html`, with no ES module syntax and no build step.
- Punctuation and normalization utilities specific to this tokenizer SHOULD
  live in a dedicated file (`js/tokenize_mdl.js`) rather than being merged
  into the shared `js/tokenize.js`, because the MDL normalization alphabet
  intentionally differs from the Words/Text pipeline.

### Browser Compatibility

- The tokenizer MUST run entirely in the browser with no network calls beyond
  the existing CDN script loads.
- The tokenizer MUST NOT rely on any build step, bundler, or package manager.

## Dependencies

- No new runtime dependencies. The tokenizer uses plain JavaScript and the
  existing `MarkovConstants` global.

## Implementation Notes

- **Paragraph loss is intentional.** The corpus panel's existing "no newlines"
  button already offers this behavior for other modes as a user choice; for
  MDL it is baked in, because the n-gram word-boundary rule does not care
  about paragraph structure and the gain in corpus uniformity is worth more
  than preserving line breaks.
- **Credit-assignment trade-off.** Subtracting the parent's full frequency
  from every substring is conservative; meaningful shared subunits (e.g.
  `ment` shared by `government` and `segment`) still receive credit from
  occurrences outside the parent tokens, but shared-segment signal is
  diminished. A future refinement MAY subtract a fraction (for example, half
  the parent frequency) to better preserve meaningful shared segments.
- **MDL framing.** The scoring formula is a length-weighted frequency proxy,
  not strict Minimum Description Length (which would include the cost of
  encoding the vocabulary itself). The name reflects the spirit of the
  credit-assignment step rather than a formal MDL objective.
- **Leading-space tokens.** Tokens MAY begin with a space (e.g., ` the`,
  ` and`). During greedy encoding these take precedence over their
  space-less variants when the cursor is on a space position, packing
  common separator-plus-word pairs into a single token. This follows the
  BPE convention — cl100k_base (used by GPT mode) stores spaces the same
  way — so MDL and GPT output can be compared directly on the same
  criterion.
- **Greedy vs. optimal segmentation.** A locally longest match can preempt a
  better downstream segmentation. This is accepted. A future pass could
  improve segmentation using dynamic programming over token probabilities.
- **1-gram redundancy.** The range 1..7 would be redundant with the
  guaranteed-alphabet step, so candidate collection starts at length 2.
- **Relationship to other tokenizers.** Unlike Words and Text, this tokenizer
  does not share the `Tokenize` utility object in `js/tokenize.js`. The other
  tokenizers can still handle characters the MDL alphabet excludes (such as
  `,;:—`), because those characters are removed by MDL normalization before
  the Markov chain ever sees them.

## Error Handling

- The tokenizer MUST NOT throw on empty or whitespace-only input. It MUST
  return an empty token-sequence array, matching the behavior of the existing
  three tokenizers.
- When the normalized corpus is shorter than the minimum n-gram length of 2
  characters, the tokenizer MUST still produce a valid vocabulary consisting
  solely of the guaranteed single characters that appear in the corpus, and
  MUST encode the corpus against that vocabulary without error.
- The tokenizer MUST tolerate input containing characters outside the
  normalization alphabet by silently dropping them during normalization.
- If candidate collection produces fewer than 1024 viable candidates, the
  tokenizer MUST take all that are available and continue. It MUST NOT pad
  the vocabulary with synthetic tokens.

## Comments

Informal thoughts on how MDL fits alongside the project's other four modes
(Words, Text, GPT, Phonetic). This section is reflective, not prescriptive.

### Where tokens come from

The other four modes apply a tokenization scheme that exists independently of
the corpus: Words splits on characters, Text splits on whitespace and
punctuation, GPT uses a prebuilt `cl100k_base` BPE vocabulary trained on
internet-scale data, and Phonetic runs text through espeak-ng to get IPA
symbols. MDL is the only mode whose vocabulary is *derived from the specific
text the user pasted*. A corpus of nautical writing yields tokens like
`harbor `, `stern`, `mast `; a corpus of shell transcripts yields `sudo `,
`grep `, `--`. This is the single most distinctive thing about the mode and
the reason to reach for it.

### Granularity and Markov context

The Markov chain uses the same `maxN = 3` across all modes, but the size of a
"token" changes what a 3-gram captures:

- Words mode — a 3-gram is ~3 characters. Captures spelling and morphology.
- Text mode — a 3-gram is ~3 words. Captures phrase-level idioms.
- GPT mode — a 3-gram is ~3 BPE pieces, often spanning multiple syllables
  each. Captures short phrase-level patterns with a very large vocabulary.
- MDL mode — a 3-gram is ~3 subword pieces, each typically 3 to 5 characters.
  Sits between Words and Text; captures roughly one to two words of context
  with a small corpus-specific vocabulary.
- Phonetic mode — a 3-gram is ~3 phonemes. Captures local phonotactic
  patterns for speakable output.

MDL's useful middle ground is the reason for its existence: it produces longer
coherent runs than Words without losing the "sounds like the source" feel the
way Text can when the 3-word window is too sparse.

### Punctuation and alphabet

The five modes handle punctuation very differently:

- Words and Text share the `Tokenize` utility, stripping paired punctuation
  (quotes, parens, brackets) and splitting unpaired punctuation (`.,;:—?!`)
  into separate tokens.
- GPT inherits whatever the `cl100k_base` vocabulary does, which includes
  punctuation as ordinary tokens.
- Phonetic loses punctuation at the IPA boundary entirely.
- MDL strips aggressively to `[A-Za-z0-9 .!?']`. It keeps sentence-ending
  punctuation and apostrophes (so `don't` and `it's` survive), but drops
  commas, semicolons, colons, em-dashes, parens, brackets, and quotes.

The MDL choice is deliberate: a smaller alphabet makes the n-gram tally
denser, which makes the learned vocabulary more coherent, at the cost of
losing punctuation variety in output. Users who care about commas should
pick Text.

### Stateless vs. corpus-dependent

The tokenizer interface has two entry points: `calibrate(sourceText)`
establishes the encoding scheme, and `tokenize(text)` encodes against the
current scheme. Words, Text, GPT, and Phonetic have fixed schemes, so
`calibrate` is an explicit no-op — the call exists in the interface to
document that nothing needs to be established. MDL is the only mode where
`calibrate` does real work (trains and caches the vocabulary), and where
repeated `tokenize` calls reuse that cached work. This split lets seed
encoding use the corpus-trained vocab rather than retraining on the seed,
so generated text can be fed back into the chain as a prefix that actually
matches the chain's transitions.

### When to reach for which

- Words — short, word-shaped gibberish that preserves the character statistics
  of the source. Good for made-up proper nouns, plausible misspellings,
  invented place names.
- Text — paragraph-shaped pastiche. Good when the source has distinctive
  syntax or idiom you want to imitate at the sentence level.
- GPT — generic subword generation. Good when the source is large and varied
  and you want tokens that respect common English morphology.
- Phonetic — speakable output. Good for invented-language effects and the
  Speak button.
- MDL — corpus-flavored subword generation. Good for mid-sized stylistically
  coherent corpora (a novel, a thread, a single author's work) where the
  distinctive morphemes of the source are exactly what you want to preserve.
  Underwhelming on tiny corpora (the learned vocabulary collapses toward the
  alphabet) and lossy on corpora where non-alphabet punctuation carries
  meaning.

### The design axis

Looking across all five modes, two axes appear:

- **Granularity** — sub-character (phoneme, in a sense) → character → subword
  → word.
- **Vocabulary origin** — trivial-fixed (Words, Text) → externally-trained-huge
  (GPT) → externally-derived (Phonetic, via espeak) → locally-learned (MDL).

MDL is the only member of the locally-learned family. It learns cheaply and
on demand rather than being trained centrally and loaded from disk. That
framing suggests natural future neighbors (corpus-learned phoneme clusters,
corpus-learned word-level templates) more than it suggests refinements to
MDL itself.
