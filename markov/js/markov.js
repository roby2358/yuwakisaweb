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
     * Builds the Markov chain by analyzing the input tokens
     */
    this.build = () => {
        tokens.forEach(group => {
            ngramPairs(group, addLink);
        });
        console.log(JSON.stringify(this.links, null, 2));
        console.log("startIndex");
        console.log(JSON.stringify(this.links[MarkovConstants.Start], null, 2));
        return this;
    };
    
    /**
     * Gets possible continuations grouped by n-gram order.
     * Returns an array of { order, suffixes } where suffixes is { key: count }.
     * Only includes orders that have at least one matching prefix.
     */
    const getContinuationsByOrder = (prefixArray) => {
        const byOrder = [];

        for (let ngramLength = 1; ngramLength <= Math.min(maxN, prefixArray.length); ngramLength++) {
            const ngram = prefixArray.slice(-ngramLength);
            const ngramKey = toKey(ngram);
            const nextNgrams = this.links[ngramKey];

            if (nextNgrams) {
                byOrder.push({ order: ngramLength, suffixes: nextNgrams });
            }
        }

        return byOrder;
    };

    /**
     * Selects a suffix using normalized order selection:
     * 1. Pick an order uniformly among orders with matches
     * 2. Sample a suffix from that order weighted by frequency
     */
    const selectFromOrders = (byOrder) => {
        const orderIndex = Math.floor(this.random() * byOrder.length);
        const { suffixes } = byOrder[orderIndex];
        return selectWeightedChoice(Object.entries(suffixes));
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
     */
    this.generateTokens = (count) => {
        if (count <= 0) {
            return [];
        }
        
        const groups = [];
        let currentGroup = [MarkovConstants.Start];
        let tokensGenerated = 0;
        
        while (tokensGenerated < count) {
            const byOrder = getContinuationsByOrder(currentGroup);

            if (byOrder.length === 0) {
                // No more continuations, close current group and start new one
                if (currentGroup.length > 1) {
                    groups.push(closeGroup(currentGroup));
                }
                currentGroup = [MarkovConstants.Start];
                continue;
            }
            
            const nextNgramKey = selectFromOrders(byOrder);
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
        
        console.log("groups", groups);

        return groups;
    };
}

