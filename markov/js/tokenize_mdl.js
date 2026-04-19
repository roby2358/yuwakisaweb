/**
 * MDL subword tokenizer utilities.
 * See docs/MDL_TOKENIZER.md for the full specification.
 */
const TokenizeMdl = {
    NORMALIZE_STRIP: /[^A-Za-z0-9 .!?']/g,
    WHITESPACE_RUN: /\s+/g,
    MIN_NGRAM: 2,
    MAX_NGRAM: 12,
    VOCAB_SIZE: 1024,
    LENGTH_EXPONENT: 1.5,
    SPACE_CHARCODE: 32,

    ALPHABET: (() => {
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';
        const punct = " .!?'";
        return (lower + upper + digits + punct).split('');
    })(),

    /**
     * Strip to [A-Za-z0-9 .!?'] and collapse whitespace runs to a single space.
     */
    normalize(text) {
        return text
            .replace(this.NORMALIZE_STRIP, '')
            .replace(this.WHITESPACE_RUN, ' ')
            .trim();
    },

    /**
     * Longest valid n-gram length starting at `start`: up to MAX_NGRAM, but
     * stopping just before any space found at positions start+1..start+n-1.
     * A leading space at position `start` itself is fine (it becomes the
     * opening char of a leading-space token like ` the`); interior spaces
     * are not.
     */
    maxCandidateLength(corpus, start) {
        const SPACE = this.SPACE_CHARCODE;
        const maxPossible = Math.min(this.MAX_NGRAM, corpus.length - start);
        for (let i = start + 1; i < start + maxPossible; i++) {
            if (corpus.charCodeAt(i) === SPACE) return i - start;
        }
        return maxPossible;
    },

    /**
     * Walk the corpus and tally every n-gram of length MIN_NGRAM..MAX_NGRAM
     * that starts at any position (including space positions, which produce
     * leading-space tokens) and has no space in its interior.
     */
    collectCandidates(corpus) {
        const tally = Object.create(null);
        const len = corpus.length;
        const minN = this.MIN_NGRAM;

        for (let i = 0; i < len; i++) {
            const limit = this.maxCandidateLength(corpus, i);
            for (let n = minN; n <= limit; n++) {
                const gram = corpus.slice(i, i + n);
                tally[gram] = (tally[gram] || 0) + 1;
            }
        }
        return tally;
    },

    /**
     * Subtract `parentFreq` from every proper substring of `candidate` of
     * length >= MIN_NGRAM. Clamps at zero. Mutates `adjusted`.
     */
    subtractFromSubstrings(candidate, parentFreq, adjusted) {
        const clen = candidate.length;
        const minN = this.MIN_NGRAM;
        for (let start = 0; start < clen; start++) {
            for (let end = start + minN; end <= clen; end++) {
                if (start === 0 && end === clen) continue;
                const sub = candidate.slice(start, end);
                if (sub in adjusted) {
                    const next = adjusted[sub] - parentFreq;
                    adjusted[sub] = next > 0 ? next : 0;
                }
            }
        }
    },

    /**
     * Top-down credit-assignment pass. Processes candidates longest-first and
     * subtracts each parent's current (already-adjusted) frequency from every
     * proper substring of length >= MIN_NGRAM. Length ties break by
     * descending raw frequency, then lexicographic.
     */
    assignCredit(tally) {
        const adjusted = Object.assign(Object.create(null), tally);
        const candidates = Object.keys(tally);

        candidates.sort((a, b) => {
            if (b.length !== a.length) return b.length - a.length;
            if (tally[b] !== tally[a]) return tally[b] - tally[a];
            return (a > b) - (a < b);
        });

        for (const candidate of candidates) {
            const parentFreq = adjusted[candidate];
            if (parentFreq === 0) continue;
            this.subtractFromSubstrings(candidate, parentFreq, adjusted);
        }

        return adjusted;
    },

    /**
     * Score every candidate with adjusted frequency > 0 by
     * adjusted_freq * (length - 1)^LENGTH_EXPONENT. Returns a list of
     * { token, raw, adjusted, score } entries sorted by score descending.
     */
    rankCandidates(tally, adjusted) {
        const exp = this.LENGTH_EXPONENT;
        const ranked = [];
        for (const token in adjusted) {
            const adj = adjusted[token];
            if (adj <= 0) continue;
            ranked.push({
                token,
                raw: tally[token],
                adjusted: adj,
                score: adj * Math.pow(token.length - 1, exp)
            });
        }
        ranked.sort((a, b) => b.score - a.score);
        return ranked;
    },

    /**
     * Combine learned tokens with the alphabet for guaranteed single-char
     * coverage, dedupe, and return sorted longest-first for greedy encoding.
     */
    buildVocabulary(learned) {
        const tokens = learned.map(entry => entry.token);
        const vocabulary = Array.from(new Set(tokens.concat(this.ALPHABET)));
        vocabulary.sort((a, b) => b.length - a.length);
        return vocabulary;
    },

    /**
     * Trains the MDL vocabulary from a normalized corpus. Returns both the
     * learned stats (for introspection) and the encoding-ready vocabulary
     * (learned tokens plus alphabet, sorted longest-first).
     */
    trainVocabulary(normalizedCorpus) {
        const tally = this.collectCandidates(normalizedCorpus);
        const adjusted = this.assignCredit(tally);
        const ranked = this.rankCandidates(tally, adjusted);
        const learned = ranked.slice(0, this.VOCAB_SIZE);
        return {
            vocabulary: this.buildVocabulary(learned),
            learned
        };
    },

    /**
     * Returns the longest vocabulary entry matching corpus at pos, or null
     * if none match. Vocabulary MUST be pre-sorted longest-first.
     */
    findLongestMatch(corpus, pos, vocabulary) {
        const remaining = corpus.length - pos;
        for (const token of vocabulary) {
            if (token.length > remaining) continue;
            if (corpus.startsWith(token, pos)) return token;
        }
        return null;
    },

    /**
     * Greedy longest-match encoding. Vocabulary MUST be pre-sorted longest-first.
     * The alphabet-coverage guarantee means findLongestMatch should never
     * return null for a non-empty normalized corpus; the char fallback is
     * defensive only.
     */
    encode(normalizedCorpus, vocabulary) {
        const tokens = [];
        const len = normalizedCorpus.length;
        let pos = 0;

        while (pos < len) {
            const match = this.findLongestMatch(normalizedCorpus, pos, vocabulary);
            if (match === null) {
                tokens.push(normalizedCorpus.charAt(pos));
                pos++;
                continue;
            }
            tokens.push(match);
            pos += match.length;
        }
        return tokens;
    }
};
