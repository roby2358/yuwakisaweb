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
        // console.log("ngramPairs", group);

        for (let prefixLength = 1; prefixLength <= Math.min(maxN, group.length - 1); prefixLength++) {
            for (let suffixLength = 1; suffixLength <= Math.min(maxN, group.length - prefixLength); suffixLength++) {
                for (let startIndex = 0; startIndex <= group.length - prefixLength - suffixLength; startIndex++) {
                    const prefix = group.slice(startIndex, startIndex + prefixLength);
                    const suffix = group.slice(startIndex + prefixLength, startIndex + prefixLength + suffixLength);
                    // console.log(prefix, '|', suffix)
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
        return this;
    };
    
    /**
     * Gets all possible next n-grams and their frequencies for a given prefix
     */
    const getPossibleContinuations = (prefixArray) => {
        const continuations = {};
        
        for (let ngramLength = 1; ngramLength <= Math.min(maxN, prefixArray.length); ngramLength++) {
            const ngram = prefixArray.slice(-ngramLength);
            const ngramKey = toKey(ngram);
            const nextNgrams = this.links[ngramKey];
            
            if (nextNgrams) {
                for (const nextNgramKey in nextNgrams) {
                    continuations[nextNgramKey] = (continuations[nextNgramKey] || 0) + nextNgrams[nextNgramKey];
                }
            }
        }
        
        return continuations;
    };
    
    /**
     * Randomly selects a next n-gram based on frequency weights
     */
    const selectWeightedChoice = (weightedChoices) => {
        const totalWeight = weightedChoices.reduce((sum, [, weight]) => sum + weight, 0);
        let randomValue = Math.floor(this.random() * totalWeight);
        
        for (const [choice, weight] of weightedChoices) {
            if (randomValue >= 0) {
                randomValue -= weight;
            } else {
                return choice;
            }
        }
        
        return weightedChoices[weightedChoices.length - 1][0];
    };
    
    /**
     * Generates a new word using the learned patterns
     */
    this.roll = () => {
        let currentGroup = [MarkovConstants.Start];
        let continuations = {};
        
        do {
            continuations = getPossibleContinuations(currentGroup);
            const continuationsSize = Object.keys(continuations).length;
            if (continuationsSize > 0) {
                const nextNgramKey = selectWeightedChoice(Object.entries(continuations));
                const nextNgram = nextNgramKey.split('|');
                currentGroup = currentGroup.concat(nextNgram);
            }
        } while (Object.keys(continuations).length > 0);
        
        return currentGroup;
    };
    
    /**
     * Generates a new token that doesn't exist in the input token list
     */
    // this.uniq = () => {
    //     let generated;
    //     do {
    //         generated = this.roll();
    //     } while (tokens.includes(generated));
    //     return generated;
    // };
    
    /**
     * Generates multiple tokens
     */
    this.generateMultiple = (count) => {
        const generatedTokens = [];
        for (let i = 0; i < count; i++) {
            generatedTokens.push(this.roll());
        }
        return generatedTokens;
    };
}

