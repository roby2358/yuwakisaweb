/**
 * MDL subword tokenizer. A learned-scheme tokenizer: calibrate() trains a
 * ~1100-token subword vocabulary from the source corpus, and tokenize()
 * encodes arbitrary text against that cached vocabulary.
 *
 * Splitting calibrate from tokenize lets seed text be encoded against the
 * corpus-trained vocab without retraining.
 */
function Mdl() {
    let vocabulary = null;

    const prepare = (text) => {
        if (!text || typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (trimmed.length === 0) return null;
        const normalized = TokenizeMdl.normalize(trimmed);
        if (normalized.length === 0) return null;
        return normalized;
    };

    /**
     * Trains and caches the subword vocabulary from the source corpus.
     * MUST be called before tokenize(). Calling again on a new corpus
     * overwrites the cached vocab.
     */
    this.calibrate = (sourceText) => {
        const normalized = prepare(sourceText);
        if (normalized === null) {
            vocabulary = null;
            return;
        }
        vocabulary = TokenizeMdl.trainVocabulary(normalized);
        console.log('MDL vocabulary (' + vocabulary.length + ' tokens):', vocabulary);
    };

    /**
     * Encodes text against the cached vocabulary. Returns [] if calibrate()
     * has not been called or the input is empty after normalization.
     * The alphabet-coverage guarantee ensures any normalized input is encodable.
     */
    this.tokenize = (text) => {
        if (vocabulary === null) return [];
        const normalized = prepare(text);
        if (normalized === null) return [];
        const encoded = TokenizeMdl.encode(normalized, vocabulary);
        console.log('MDL encoded stream (' + encoded.length + ' tokens from ' + normalized.length + ' chars):', encoded);
        return [[MarkovConstants.Start, ...encoded, MarkovConstants.End]];
    };

    this.format = (tokens) => {
        if (!Array.isArray(tokens)) {
            return '';
        }
        return tokens
            .map(group => group.slice(1, -1).join(''))
            .filter(group => group.length > 0)
            .join('\n');
    };
}
