/**
 * Phonetic tokenizer — converts text to IPA phonemes via Espeak wrapper,
 * then builds token groups for the Markov chain.
 *
 * Each word becomes a group: [Start, phoneme1, phoneme2, ..., End]
 * where each phoneme is a single IPA character/symbol.
 *
 * tokenize() is async (callback-based) because it uses the Espeak wrapper.
 */
function Phonetic(espeak) {

    // IPA characters that represent single phonemes (including diacritics/length marks)
    // Multi-character phonemes like 'aɪ' or 'tʃ' are kept as single tokens
    var DIPHTHONGS_AND_AFFRICATES = [
        'aɪ', 'eɪ', 'ɔɪ', 'aʊ', 'oʊ', 'ɪə', 'ɛə', 'ʊə',
        'tʃ', 'dʒ',
        'iː', 'uː', 'ɑː', 'ɔː', 'ɜː'
    ];

    /**
     * Splits an IPA string into individual phoneme tokens.
     * Recognizes multi-character phonemes (diphthongs, affricates, long vowels).
     */
    function splitIPA(ipa) {
        var tokens = [];
        var i = 0;
        while (i < ipa.length) {
            if (ipa[i] === ' ') {
                i++;
                continue;
            }
            var matched = false;
            // Try multi-char phonemes first (longest = 2 chars)
            if (i + 1 < ipa.length) {
                var pair = ipa[i] + ipa[i + 1];
                for (var d = 0; d < DIPHTHONGS_AND_AFFRICATES.length; d++) {
                    if (DIPHTHONGS_AND_AFFRICATES[d] === pair) {
                        tokens.push(pair);
                        i += 2;
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) {
                tokens.push(ipa[i]);
                i++;
            }
        }
        return tokens;
    }

    /**
     * Async tokenization: converts text → IPA → phoneme token groups.
     * callback(err, groups) where groups is array of [Start, ...phonemes, End]
     */
    this.tokenize = function (text, callback) {
        if (!text || typeof text !== 'string' || !text.trim()) {
            callback(null, []);
            return;
        }

        espeak.synthesize_ipa(text, function (err, ipa) {
            if (err) {
                callback(err, []);
                return;
            }
            if (!ipa || !ipa.trim()) {
                callback(null, []);
                return;
            }

            // Split IPA by word boundaries (spaces in IPA output)
            var words = ipa.split(/\s+/).filter(function (w) { return w.length > 0; });
            var groups = words
                .map(function (word) {
                    var phonemes = splitIPA(word);
                    if (phonemes.length === 0) return null;
                    return [MarkovConstants.Start].concat(phonemes).concat([MarkovConstants.End]);
                })
                .filter(function (g) { return g !== null; });

            callback(null, groups);
        });
    };

    /**
     * Formats generated token groups back into readable IPA text.
     * Each group's phonemes are joined directly (no spaces within a word),
     * groups are separated by spaces.
     */
    this.format = function (groups) {
        if (!Array.isArray(groups)) {
            return '';
        }
        return groups
            .map(function (group) {
                return group.slice(1, -1).join('');
            })
            .filter(function (s) { return s.length > 0; })
            .join(' ');
    };
}
