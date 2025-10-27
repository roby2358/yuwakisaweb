function Markov(tokens, maxN) {
    const Start = "<";
    const End = ">";
    
    this.maxN = maxN;
    this.tokens = tokens;
    this.random = Math.random;
    this.links = new Map();
    
    /**
     * Removes the start and end markers from a string
     */
    const clean = (s) => s.replaceAll(Start, "").replaceAll(End, "");
    
    /**
     * Generates all possible n-gram pairs from a word
     */
    const ngramPairs = (word) => {
        console.log(word)
        const wordWithMarkers = Start + word + End;
        const pairs = [];
        
        for (let prefixLength = 1; prefixLength <= Math.min(maxN, wordWithMarkers.length - 1); prefixLength++) {
            for (let suffixLength = 1; suffixLength <= Math.min(maxN, wordWithMarkers.length - prefixLength); suffixLength++) {
                for (let startIndex = 0; startIndex <= wordWithMarkers.length - prefixLength - suffixLength; startIndex++) {
                    const prefix = wordWithMarkers.substring(startIndex, startIndex + prefixLength);
                    const suffix = wordWithMarkers.substring(startIndex + prefixLength, startIndex + prefixLength + suffixLength);
                    console.log(prefix, '|', suffix)
                    pairs.push([prefix, suffix]);
                }
            }
        }
        
        return pairs;
    };
    
    /**
     * Increments a counter, initializing it to 1 if it doesn't exist
     */
    const incrementCounter = (count) => {
        return count !== undefined ? count + 1 : 1;
    };
    
    /**
     * Builds the Markov chain by analyzing the input tokens
     */
    this.build = () => {
        tokens.forEach(word => {
            ngramPairs(word).forEach(([prefix, suffix]) => {
                if (!this.links.has(prefix)) {
                    this.links.set(prefix, new Map());
                }
                const prefixMap = this.links.get(prefix);
                prefixMap.set(suffix, incrementCounter(prefixMap.get(suffix)));
            });
        });
        return this;
    };
    
    /**
     * Gets all possible next n-grams and their frequencies for a given prefix
     */
    const getPossibleContinuations = (prefix) => {
        const continuations = new Map();
        
        for (let ngramLength = 1; ngramLength <= Math.min(maxN, prefix.length); ngramLength++) {
            const ngram = prefix.substring(prefix.length - ngramLength);
            const nextNgrams = this.links.get(ngram);
            
            if (nextNgrams) {
                nextNgrams.forEach((frequency, nextNgram) => {
                    continuations.set(nextNgram, (continuations.get(nextNgram) || 0) + frequency);
                });
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
        let currentWord = Start;
        let continuations = new Map();
        
        do {
            continuations = getPossibleContinuations(currentWord);
            if (continuations.size > 0) {
                currentWord += selectWeightedChoice(Array.from(continuations.entries()));
            }
        } while (continuations.size > 0);
        
        console.log(currentWord);
        
        return clean(currentWord);
    };
    
    /**
     * Generates a new token that doesn't exist in the input token list
     */
    this.uniq = () => {
        let generated;
        do {
            generated = this.roll();
        } while (tokens.includes(generated));
        return generated;
    };
    
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

