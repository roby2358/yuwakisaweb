/**
 * Tokenizes text from word-level input
 * Splits text into paragraphs, then words, and wraps paragraphs with Start/End markers
 */
function Text() {
    this.tokenize = (text) => {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            return [];
        }

        return trimmedText
            .split(/\n/)
            .map(paragraph => Tokenize.splitIntoWordTokens(paragraph))
            .filter(tokens => tokens.length > 0)
            .map(tokens => [MarkovConstants.Start, ...tokens, MarkovConstants.End]);
    };

    this.format = (tokens) => {
        if (!Array.isArray(tokens)) {
            return '';
        }
        return tokens
            .map(token => {
                // token is an array like ["<", "word1", "word2", "word3", ">"]
                // Remove first and last (Start/End markers) and join with spaces (text mode uses word-level keys)
                return token.slice(1, -1).join(' ');
            })
            .filter(token => token.length > 0)
            .join(' ')
            // Remove spaces before punctuation characters
            .replace(Tokenize.REMOVE_SPACE_BEFORE_PUNCTUATION, '$1');
    };
}

