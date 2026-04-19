// Export constants for use in other modules
const MarkovConstants = {
    Start: "<",
    End: ">"
};

function Markov(tokens, maxN) {

    this.maxN = maxN;
    this.tokens = tokens;
    this.random = Math.random;
    this.links = {};

    /**
     * Converts a value to a string key for storage
     */
    const toKey = (value) => {
        if (typeof value === 'string') {
            return value;
        }
        return value.join('|');
    };

    /**
     * Generates all possible n-gram pairs from a group and invokes callback for each
     */
    const ngramPairs = (group, callback) => {
        for (let prefixLength = 1; prefixLength <= Math.min(maxN, group.length - 1); prefixLength++) {
            for (let suffixLength = 1; suffixLength <= Math.min(maxN, group.length - prefixLength); suffixLength++) {
                for (let startIndex = 0; startIndex <= group.length - prefixLength - suffixLength; startIndex++) {
                    const prefix = group.slice(startIndex, startIndex + prefixLength);
                    const suffix = group.slice(startIndex + prefixLength, startIndex + prefixLength + suffixLength);
                    callback(toKey(prefix), toKey(suffix));
                }
            }
        }
    };

    /**
     * Creates and stores a new prefix map
     */
    const newPrefixMap = (links, prefixKey) => {
        const map = {};
        links[prefixKey] = map;
        return map;
    };

    /**
     * Records a transition from prefix to suffix in the Markov chain
     */
    const addLink = (prefixKey, suffixKey) => {
        const prefixMap = this.links[prefixKey] ?? newPrefixMap(this.links, prefixKey);
        prefixMap[suffixKey] = (prefixMap[suffixKey] ?? 0) + 1;
    };

    /**
     * Groups every distinct (prefixKey, suffixKey) pair in this.links by its
     * shape P+S (prefix-token count + suffix-token count). Returns a map from
     * total span size to an array of { prefixKey, suffixKey, P, S } entries.
     */
    const groupPairsBySpan = () => {
        const bySpan = {};
        for (const prefixKey in this.links) {
            const P = prefixKey.split('|').length;
            const suffixes = this.links[prefixKey];
            for (const suffixKey in suffixes) {
                const S = suffixKey.split('|').length;
                const span = P + S;
                (bySpan[span] ??= []).push({ prefixKey, suffixKey, P, S });
            }
        }
        return bySpan;
    };

    /**
     * Subtracts parentCount from every contained child pair's count in
     * this.links, clamped at zero. The parent's own (prefixKey, suffixKey)
     * at the natural split k_offset = P is skipped.
     */
    /**
     * Subtracts parentCount from every same-split child pair's count in
     * this.links, clamped at zero. Same-split children share the parent's
     * split point: prefix is the last p tokens of the parent's prefix,
     * suffix is the first s tokens of the parent's suffix. Each parent
     * occurrence contains each same-split child occurrence exactly once,
     * so subtracting parentCount is the correct MDL amount.
     */
    const subtractFromChildren = (parentTokens, P, S, parentCount) => {
        for (let p = 1; p <= P; p++) {
            for (let s = 1; s <= S; s++) {
                if (p === P && s === S) continue;
                const childPrefixKey = parentTokens.slice(P - p, P).join('|');
                const childSuffixKey = parentTokens.slice(P, P + s).join('|');
                const suffixes = this.links[childPrefixKey];
                if (!suffixes) continue;
                const current = suffixes[childSuffixKey];
                if (current === undefined) continue;
                const next = current - parentCount;
                suffixes[childSuffixKey] = next > 0 ? next : 0;
            }
        }
    };

    /**
     * Top-down MDL credit assignment on the transition counts. Parents with
     * larger span (P+S) claim their contained sub-pairs first, subtracting
     * their current adjusted count from each contained child. Parallel to
     * the vocabulary-level MDL in tokenize_mdl.js; over-subtraction is
     * handled by clamp-at-zero.
     */
    const assignCredit = () => {
        const bySpan = groupPairsBySpan();
        const spans = Object.keys(bySpan).map(Number).sort((a, b) => b - a);
        for (const span of spans) {
            for (const { prefixKey, suffixKey, P, S } of bySpan[span]) {
                const parentCount = this.links[prefixKey][suffixKey];
                if (parentCount === 0) continue;
                const parentTokens = prefixKey.split('|').concat(suffixKey.split('|'));
                subtractFromChildren(parentTokens, P, S, parentCount);
            }
        }
    };

    /**
     * Builds the Markov chain by analyzing the input tokens
     */
    this.build = () => {
        tokens.forEach(group => {
            ngramPairs(group, addLink);
        });
        assignCredit();
        return this;
    };

    /**
     * Gets the combined set of possible continuations across every n-gram
     * order that has a match for the tail of prefixArray. Returns an array
     * of [suffixKey, count] entries ready for weighted sampling. Counts
     * from multiple matching orders are summed, letting MDL-adjusted
     * frequencies speak for themselves rather than flattening by order.
     */
    const getWeightedContinuations = (prefixArray) => {
        const merged = {};
        for (let ngramLength = 1; ngramLength <= Math.min(maxN, prefixArray.length); ngramLength++) {
            const ngramKey = toKey(prefixArray.slice(-ngramLength));
            const suffixes = this.links[ngramKey];
            if (!suffixes) continue;
            for (const suffixKey in suffixes) {
                const count = suffixes[suffixKey];
                if (count <= 0) continue;
                merged[suffixKey] = (merged[suffixKey] ?? 0) + count;
            }
        }
        return Object.entries(merged);
    };

    /**
     * Randomly selects a next n-gram based on frequency weights
     */
    const selectWeightedChoice = (weightedChoices) => {
        const totalWeight = weightedChoices.reduce((sum, [, weight]) => sum + weight, 0);
        let randomValue = Math.floor(this.random() * totalWeight);

        for (const [choice, weight] of weightedChoices) {
            randomValue -= weight;
            if (randomValue < 0) {
                return choice;
            }
        }

        return weightedChoices[weightedChoices.length - 1][0];
    };

    /**
     * Closes a group by adding End token if needed
     */
    const closeGroup = (group) => {
        if (group.length > 1 && group[group.length - 1] !== MarkovConstants.End) {
            group.push(MarkovConstants.End);
        }
        return group;
    };

    /**
     * Generates groups by making random token selections until count tokens are generated
     * Each token in a selected ngram counts toward the total (e.g., "a|b|c" = 3 tokens)
     * Groups are naturally created when End tokens are encountered
     * @param {number} count - Number of tokens to generate
     * @param {string[]} [seed] - Optional seed prefix (including Start marker) for the first group
     */
    this.generateTokens = (count, seed) => {
        if (count <= 0) {
            return [];
        }

        const groups = [];
        let currentGroup = seed || [MarkovConstants.Start];
        let tokensGenerated = 0;

        while (tokensGenerated < count) {
            const choices = getWeightedContinuations(currentGroup);

            if (choices.length === 0) {
                // Already at [Start] with no viable continuations — give up
                // rather than loop forever. Happens if credit assignment
                // clamped every suffix of Start to zero.
                if (currentGroup.length <= 1) {
                    break;
                }
                groups.push(closeGroup(currentGroup));
                currentGroup = [MarkovConstants.Start];
                continue;
            }

            const nextNgramKey = selectWeightedChoice(choices);
            const nextNgram = nextNgramKey.split('|');

            // Check if this ngram contains an End token
            const endIndex = nextNgram.indexOf(MarkovConstants.End);
            if (endIndex !== -1) {
                // Add tokens before End, then close the group
                const tokensToAdd = nextNgram.slice(0, endIndex);

                // Check if adding these tokens would exceed our count
                if (tokensGenerated + tokensToAdd.length > count) {
                    // Only add tokens up to the count
                    const remaining = count - tokensGenerated;
                    currentGroup = currentGroup.concat(tokensToAdd.slice(0, remaining));
                    tokensGenerated += remaining;
                    groups.push(closeGroup(currentGroup));
                    break;
                }

                currentGroup = currentGroup.concat(tokensToAdd);
                tokensGenerated += tokensToAdd.length;
                groups.push(closeGroup(currentGroup));
                // Start a new group
                currentGroup = [MarkovConstants.Start];
            } else {
                // No End token, add all tokens to current group
                // Check if adding all tokens would exceed our count
                if (tokensGenerated + nextNgram.length > count) {
                    // Only add tokens up to the count
                    const remaining = count - tokensGenerated;
                    currentGroup = currentGroup.concat(nextNgram.slice(0, remaining));
                    tokensGenerated += remaining;
                    break;
                }

                currentGroup = currentGroup.concat(nextNgram);
                tokensGenerated += nextNgram.length;
            }
        }

        // Add the last group if it has content (not just Start)
        if (currentGroup.length > 1) {
            groups.push(closeGroup(currentGroup));
        }

        return groups;
    };
}

