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

        return Tokenize.removePairedPunctuation(trimmedText)
            .split(/\s+/)
            .filter(token => token.length > 0)
            .flatMap(token => {
                // Split token into parts (words and punctuation)
                const parts = Tokenize.splitTokenOnPunctuation(token);
                // Each part becomes a separate word wrapped with Start/End markers
                // Return as array of arrays: [["<", "w", "o", "r", "d", ">"], ...]
                return parts.map(part => [MarkovConstants.Start, ...part.split(''), MarkovConstants.End]);
            });
    };

    this.clean = (token) => {
        if (!token || typeof token !== 'string') {
            return '';
        }
        return token.replaceAll(MarkovConstants.Start, '').replaceAll(MarkovConstants.End, '');
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

