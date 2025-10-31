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

        return trimmedText
            .split(/\s+/)
            .filter(token => token.length > 0)
            .map(token => `${MarkovConstants.Start}${token}${MarkovConstants.End}`);
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
        return tokens.map(token => {
            // token is an array like ["<", "w", "o", "r", "d", ">"]
            // Remove first and last (Start/End markers) and join (words mode uses character-level keys)
            return token.slice(1, -1).join('');
        }).join(' ');
    };
}

