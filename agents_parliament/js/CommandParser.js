/**
 * Simple LALR-style parser for command-line arguments
 * Handles quoted strings (single and double), backtick-delimited content (```), multi-line content, and escaped characters
 */
export class CommandParser {
    constructor() {
        // Parser states
        this.STATE = {
            START: 'START',
            ARG: 'ARG',
            QUOTED_SINGLE: 'QUOTED_SINGLE',
            QUOTED_DOUBLE: 'QUOTED_DOUBLE',
            QUOTED_BACKTICK: 'QUOTED_BACKTICK',
            ESCAPED: 'ESCAPED'
        };
    }

    /**
     * Parse a command string into an array of arguments
     * @param {string} command - The command string to parse
     * @returns {string[]} Array of parsed arguments
     */
    /**
     * Count consecutive backticks starting at position
     * @param {string} command - The command string
     * @param {number} pos - Starting position
     * @returns {number} Number of consecutive backticks
     */
    countBackticks(command, pos) {
        let count = 0;
        while (pos + count < command.length && command[pos + count] === '`') {
            count++;
        }
        return count;
    }

    parse(command) {
        const args = [];
        let current = '';
        let state = this.STATE.START;
        let quoteChar = null;
        let wasEscaped = false;
        let backtickCount = 0; // Number of backticks we're looking for to close

        for (let i = 0; i < command.length; i++) {
            const char = command[i];

            switch (state) {
                case this.STATE.START:
                    if (this.isWhitespace(char)) {
                        // Skip leading whitespace
                        continue;
                    } else if (char === '`') {
                        // Check for backtick sequence
                        backtickCount = this.countBackticks(command, i);
                        if (backtickCount >= 3) {
                            state = this.STATE.QUOTED_BACKTICK;
                            quoteChar = '`';
                            current = '`'.repeat(backtickCount);
                            i += backtickCount - 1; // Skip remaining backticks
                            wasEscaped = false;
                        } else {
                            // Single backtick - treat as regular character
                            state = this.STATE.ARG;
                            current = char;
                            wasEscaped = false;
                        }
                    } else if (char === '"') {
                        state = this.STATE.QUOTED_DOUBLE;
                        quoteChar = '"';
                        current = char;
                        wasEscaped = false;
                    } else if (char === "'") {
                        state = this.STATE.QUOTED_SINGLE;
                        quoteChar = "'";
                        current = char;
                        wasEscaped = false;
                    } else {
                        state = this.STATE.ARG;
                        current = char;
                        wasEscaped = false;
                    }
                    break;

                case this.STATE.ARG:
                    if (this.isWhitespace(char)) {
                        // End of argument
                        if (current.trim()) {
                            args.push(current.trim());
                            current = '';
                        }
                        state = this.STATE.START;
                        wasEscaped = false;
                    } else if (char === '`') {
                        // Check for backtick sequence
                        const count = this.countBackticks(command, i);
                        if (count >= 3) {
                            state = this.STATE.QUOTED_BACKTICK;
                            quoteChar = '`';
                            backtickCount = count;
                            current += '`'.repeat(count);
                            i += count - 1; // Skip remaining backticks
                            wasEscaped = false;
                        } else {
                            // Single backtick - treat as regular character
                            current += char;
                            wasEscaped = false;
                        }
                    } else if (char === '"') {
                        // Start double-quoted string
                        state = this.STATE.QUOTED_DOUBLE;
                        quoteChar = '"';
                        current += char;
                        wasEscaped = false;
                    } else if (char === "'") {
                        // Start single-quoted string
                        state = this.STATE.QUOTED_SINGLE;
                        quoteChar = "'";
                        current += char;
                        wasEscaped = false;
                    } else {
                        current += char;
                        wasEscaped = false;
                    }
                    break;

                case this.STATE.QUOTED_DOUBLE:
                    if (char === '\\' && !wasEscaped) {
                        // Escape sequence
                        state = this.STATE.ESCAPED;
                        current += char;
                        wasEscaped = false;
                    } else if (char === '"' && !wasEscaped) {
                        // End of double-quoted string - strip quotes from value
                        const value = current.slice(1); // Remove opening quote
                        args.push(value);
                        current = '';
                        state = this.STATE.START;
                        quoteChar = null;
                        wasEscaped = false;
                    } else {
                        // Regular character (including newlines)
                        current += char;
                        wasEscaped = false;
                    }
                    break;

                case this.STATE.QUOTED_SINGLE:
                    if (char === '\\' && !wasEscaped) {
                        // Escape sequence
                        state = this.STATE.ESCAPED;
                        current += char;
                        wasEscaped = false;
                    } else if (char === "'" && !wasEscaped) {
                        // End of single-quoted string - strip quotes from value
                        const value = current.slice(1); // Remove opening quote
                        args.push(value);
                        current = '';
                        state = this.STATE.START;
                        quoteChar = null;
                        wasEscaped = false;
                    } else {
                        // Regular character (including newlines)
                        current += char;
                        wasEscaped = false;
                    }
                    break;

                case this.STATE.QUOTED_BACKTICK:
                    if (char === '`') {
                        // Check if this is the closing backtick sequence
                        const count = this.countBackticks(command, i);
                        if (count >= backtickCount) {
                            // Found matching closing backticks - strip backticks from value
                            const value = current.slice(backtickCount); // Remove opening backticks
                            args.push(value);
                            current = '';
                            state = this.STATE.START;
                            quoteChar = null;
                            backtickCount = 0;
                            i += backtickCount - 1; // Skip remaining backticks
                            wasEscaped = false;
                        } else {
                            // Not enough backticks - treat as content
                            current += char;
                            wasEscaped = false;
                        }
                    } else {
                        // Regular character (including newlines)
                        current += char;
                        wasEscaped = false;
                    }
                    break;

                case this.STATE.ESCAPED:
                    // After backslash - accept any character
                    current += char;
                    // Return to previous quote state
                    if (quoteChar === '`') {
                        state = this.STATE.QUOTED_BACKTICK;
                    } else {
                        state = quoteChar === '"' ? this.STATE.QUOTED_DOUBLE : this.STATE.QUOTED_SINGLE;
                    }
                    wasEscaped = true;
                    break;
            }
        }

        // Handle remaining content
        if (state === this.STATE.ARG && current.trim()) {
            args.push(current.trim());
        } else if (state === this.STATE.QUOTED_DOUBLE && current) {
            // Unclosed double quote - strip opening quote
            args.push(current.slice(1));
        } else if (state === this.STATE.QUOTED_SINGLE && current) {
            // Unclosed single quote - strip opening quote
            args.push(current.slice(1));
        } else if (state === this.STATE.QUOTED_BACKTICK && current) {
            // Unclosed backtick - strip opening backticks
            args.push(current.slice(backtickCount));
        }

        return args;
    }

    /**
     * Check if character is whitespace
     * @param {string} char - Character to check
     * @returns {boolean}
     */
    isWhitespace(char) {
        return /\s/.test(char);
    }
}

