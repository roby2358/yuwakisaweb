/**
 * Shared punctuation utilities for tokenizers
 */
const Tokenize = {
    // Punctuation chars that should be separated (individual tokens)
    // Includes: .,;:— (unpaired punctuation only)
    // Note: straight single quote ' is NOT in punctuation so it stays with words (e.g., "It's")
    // Note: paired punctuation "()[]''"" are removed first, before tokenization
    PUNCTUATION_CHARS: /([.,;:—])/,
    
    // Dash sequences (--+) should be kept together
    DASH_SEQUENCE: /(--+)/,
    
    // Paired punctuation that should be removed (Markov chain can't pair them correctly)
    // Includes: " ( ) [ ] and Unicode equivalents ''""
    PAIRED_PUNCTUATION: /["()\[\]\u2018\u2019\u201C\u201D]/g,
    
    // Remove spaces before punctuation characters in formatted output
    REMOVE_SPACE_BEFORE_PUNCTUATION: / +([.,;:—])/g,
    
    /**
     * Splits a token (word or part of word) into parts, separating punctuation
     * Handles dash sequences (keeps them together) and splits on punctuation characters
     * @param {string} token - The token to split
     * @returns {string[]} Array of token parts
     */
    splitTokenOnPunctuation(token) {
        if (!token || typeof token !== 'string' || token.length === 0) {
            return [];
        }
        // First split on dash sequences (keeping them)
        const withDashes = token.split(this.DASH_SEQUENCE);
        // Then split on punctuation (keeping punctuation as separate tokens)
        return withDashes.flatMap(part => {
            // Check if this part is a dash sequence (starts and ends with dashes, length >= 2)
            if (/^--+$/.test(part)) {
                return [part]; // Keep dash sequences as-is
            }
            return part.split(this.PUNCTUATION_CHARS).filter(t => t.length > 0);
        });
    },
    
    /**
     * Removes paired punctuation from text
     * @param {string} text - Text to clean
     * @returns {string} Text with paired punctuation removed
     */
    removePairedPunctuation(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        return text.replace(this.PAIRED_PUNCTUATION, '');
    },
    
    /**
     * Removes spaces before punctuation in formatted text
     * @param {string} text - Text to format
     * @returns {string} Text with spaces removed before punctuation
     */
    removeSpaceBeforePunctuation(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        return text.replace(this.REMOVE_SPACE_BEFORE_PUNCTUATION, '$1');
    }
};

