(function initialiseTweetCleaner(globalScope) {
    const directionalPattern = /[\u202A-\u202E\u2066-\u2069]/g;
    const handlePattern = /^@[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)*$/;
    const statPattern = /^\d[\d,]*(?:[KkMm])?$/;
    const timePattern = /^·\s*\S.+$/;

    function normaliseLine(line) {
        if (typeof line !== 'string') {
            return '';
        }
        return line.replace(directionalPattern, '').trim();
    }

    function findPreviousNonEmptyIndex(lines, startIndex) {
        for (let index = startIndex; index >= 0; index -= 1) {
            if (normaliseLine(lines[index]) !== '') {
                return index;
            }
        }
        return -1;
    }

    function extractTweetBodies(rawText) {
        if (typeof rawText !== 'string' || rawText.trim() === '') {
            return '';
        }

        const harmonisedText = rawText.replace(/\r\n/g, '\n');
        const lines = harmonisedText.split('\n');
        const indicesToSkip = new Set();

        for (let i = 0; i < lines.length; i += 1) {
            const current = normaliseLine(lines[i]);
            if (current === '') {
                continue;
            }

            if (handlePattern.test(current)) {
                indicesToSkip.add(i);
                const previousIndex = findPreviousNonEmptyIndex(lines, i - 1);
                if (previousIndex !== -1) {
                    indicesToSkip.add(previousIndex);
                }
                continue;
            }

            if (timePattern.test(current) || statPattern.test(current)) {
                indicesToSkip.add(i);
            }
        }

        const cleanedLines = [];
        let previousWasBlank = true;

        for (let i = 0; i < lines.length; i += 1) {
            if (indicesToSkip.has(i)) {
                continue;
            }

            const current = normaliseLine(lines[i]);
            if (current === '') {
                if (!previousWasBlank && cleanedLines.length > 0) {
                    cleanedLines.push('');
                }
                previousWasBlank = true;
                continue;
            }

            cleanedLines.push(current);
            previousWasBlank = false;
        }

        while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') {
            cleanedLines.pop();
        }

        return cleanedLines.join('\n');
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { extractTweetBodies };
    }

    if (globalScope && typeof globalScope === 'object') {
        globalScope.extractTweetBodies = extractTweetBodies;
    }
})(typeof window !== 'undefined' ? window : globalThis);

