/**
 * Tokenizes text using GPT tokenizer
 * Splits text into GPT tokens, represents them as strings joined with |, and wraps each sequence with Start/End markers
 */
function Gpt() {
    /**
     * Decodes a single token ID to its string representation
     * @param {number} tokenId - Token ID from the GPT tokenizer
     * @param {Object} tokenizer - The GPT tokenizer instance
     * @returns {string} Token string representation, or empty string on error
     */
    const decodeTokenId = (tokenId, tokenizer) => {
        try {
            return tokenizer.decode([tokenId]);
        } catch (e) {
            console.warn('Failed to decode token ID:', tokenId, e);
            return '';
        }
    };

    /**
     * Converts an array of token IDs to an array of token strings
     * Each token ID is decoded to its string representation
     * @param {number[]} tokenIds - Array of token IDs from the GPT tokenizer
     * @param {Object} tokenizer - The GPT tokenizer instance
     * @returns {string[]} Array of token strings (e.g., ["ard", "vark"])
     */
    const tokenIdsToStrings = (tokenIds, tokenizer) => {
        if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
            return [];
        }
        return tokenIds.map(tokenId => decodeTokenId(tokenId, tokenizer)).filter(str => str.length > 0);
    };

    /**
     * Tokenizes a paragraph into a token sequence wrapped with Start/End markers
     * @param {string} paragraph - The paragraph text to tokenize
     * @param {Object} tokenizer - The GPT tokenizer instance
     * @returns {Array|null} Token sequence array with Start/End markers, or null if tokenization fails
     */
    const tokenizeParagraph = (paragraph, tokenizer) => {
        if (!paragraph || typeof paragraph !== 'string') {
            return null;
        }

        const trimmed = paragraph.trim();
        if (trimmed.length === 0) {
            return null;
        }

        // Encode entire paragraph to token IDs (spaces are already handled by GPT tokenizer)
        const paragraphTokens = tokenizer.encode(trimmed);
        if (paragraphTokens.length === 0) {
            return null;
        }

        // Convert token IDs to array of token strings
        const tokenStrings = tokenIdsToStrings(paragraphTokens, tokenizer);
        if (tokenStrings.length === 0) {
            return null;
        }

        // Wrap with Start/End markers (same format as words.js and text.js)
        // Each token string becomes a separate element (toKey will join with |)
        return [MarkovConstants.Start, ...tokenStrings, MarkovConstants.End];
    };

    this.tokenize = (text) => {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            return [];
        }

        // Check if tokenizer is available (ES module sets it on window)
        const tokenizer = typeof window !== 'undefined' && window.gptTokenizer ? window.gptTokenizer : 
                         (typeof gptTokenizer !== 'undefined' ? gptTokenizer : null);
        if (!tokenizer || !tokenizer.encode || typeof tokenizer.encode !== 'function') {
            console.error('GPT tokenizer not loaded');
            return [];
        }

        try {
            // Split text by paragraphs (like text.js does) to preserve natural boundaries
            // GPT tokenizer already handles spaces as part of its token vocabulary
            const paragraphs = trimmedText.split(/\n/).filter(para => para.trim().length > 0);
            const tokenSequences = [];
            
            for (const paragraph of paragraphs) {
                const tokenSequence = tokenizeParagraph(paragraph, tokenizer);
                if (tokenSequence) {
                    tokenSequences.push(tokenSequence);
                }
            }
            
            return tokenSequences;
        } catch (e) {
            console.error('Error tokenizing with GPT tokenizer:', e);
            return [];
        }
    };

    this.format = (tokens) => {
        if (!Array.isArray(tokens)) {
            return '';
        }
        return tokens
            .map(token => {
                // token is an array like ["<", "ard", "vark", ">"]
                // Remove first and last (Start/End markers) and join the token strings
                // GPT tokens already include spaces, so just concatenate them
                const tokenStrings = token.slice(1, -1);
                return tokenStrings.join('');
            })
            .filter(token => token.length > 0)
            .join('\n');
    };
}

