/**
 * MDL subword tokenizer utilities.
 * See docs/MDL_TOKENIZER.md for the full specification.
 */
const TokenizeMdl = {
    NORMALIZE_STRIP: /[^A-Za-z0-9 .!?']/g,
    WHITESPACE_RUN: /\s+/g,
    MIN_NGRAM: 2,
    MAX_NGRAM: 7,
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
     * stopping at the first space within the window. A trailing space is OK
     * (it's allowed as the final char), so if a space is found at relative
     * offset n-1, the n-gram of length n is the last valid length.
     * Assumes corpus[start] is not itself a space.
     */
    maxCandidateLength(corpus, start) {
        const SPACE = this.SPACE_CHARCODE;
        const limit = Math.min(this.MAX_NGRAM, corpus.length - start);
        for (let n = 1; n <= limit; n++) {
            if (corpus.charCodeAt(start + n - 1) === SPACE) return n;
        }
        return limit;
    },

    /**
     * Walk the corpus and tally every n-gram of length MIN_NGRAM..MAX_NGRAM
     * that starts at a non-space position and contains no interior space.
     */
    collectCandidates(corpus) {
        const tally = Object.create(null);
        const len = corpus.length;
        const SPACE = this.SPACE_CHARCODE;
        const minN = this.MIN_NGRAM;

        for (let i = 0; i < len; i++) {
            if (corpus.charCodeAt(i) === SPACE) continue;
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
     * Score every candidate by adjusted_freq * (length - 1)^LENGTH_EXPONENT,
     * take the top VOCAB_SIZE, add the alphabet for guaranteed single-char
     * coverage, dedupe, and return sorted longest-first for greedy encoding.
     */
    scoreAndSelect(adjusted) {
        const exp = this.LENGTH_EXPONENT;
        const scored = [];
        for (const token in adjusted) {
            const freq = adjusted[token];
            if (freq <= 0) continue;
            scored.push([token, freq * Math.pow(token.length - 1, exp)]);
        }
        scored.sort((a, b) => b[1] - a[1]);

        const learned = scored.slice(0, this.VOCAB_SIZE).map(pair => pair[0]);
        const vocabulary = Array.from(new Set(learned.concat(this.ALPHABET)));
        vocabulary.sort((a, b) => b.length - a.length);
        return vocabulary;
    },

    trainVocabulary(normalizedCorpus) {
        const tally = this.collectCandidates(normalizedCorpus);
        const adjusted = this.assignCredit(tally);
        return this.scoreAndSelect(adjusted);
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
