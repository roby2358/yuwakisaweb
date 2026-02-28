/**
 * Tokenizes words from character-level input
 * Splits text into words and wraps each with Start/End markers
 */
function Words() {

    this.tokenize = (text) => {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            return [];
        }

        return Tokenize.splitIntoWordTokens(trimmedText)
            .map(part => [MarkovConstants.Start, ...part.split(''), MarkovConstants.End]);
    };

    this.format = (tokens) => {
        if (!Array.isArray(tokens)) {
            return '';
        }
        return tokens
            .map(token => {
                // token is an array like ["<", "w", "o", "r", "d", ">"]
                // Remove first and last (Start/End markers) and join (words mode uses character-level keys)
                return token.slice(1, -1).join('');
            })
            .join(' ')
            // Remove spaces before punctuation characters
            .replace(Tokenize.REMOVE_SPACE_BEFORE_PUNCTUATION, '$1');
    };
}

