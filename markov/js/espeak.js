/**
 * Lazy-loading wrapper around espeakng.js
 * Manages SimpleTTS lifecycle and provides synthesize_ipa() and speak() methods.
 *
 * State: 'not_loaded' → 'loading' → 'ready' | 'error'
 */
function Espeak() {
    var self = this;
    this.state = 'not_loaded';
    this.tts = null;
    this._pendingCallbacks = [];

    /**
     * Ensures SimpleTTS is initialized, then calls fn(tts).
     * Queues requests while loading; reports errors via errCb.
     */
    this._withTTS = function (fn, errCb) {
        if (self.state === 'ready') {
            fn(self.tts);
            return;
        }
        if (self.state === 'error') {
            errCb('eSpeak failed to load');
            return;
        }
        self._pendingCallbacks.push({ fn: fn, errCb: errCb });
        if (self.state === 'loading') {
            return;
        }
        self.state = 'loading';
        try {
            self.tts = new SimpleTTS({
                workerPath: 'js/espeakng/espeakng.worker.js',
                defaultVoice: 'en',
                defaultVolume: 1.0
            });
            self.tts.onReady(function (err) {
                if (err) {
                    self.state = 'error';
                    self._pendingCallbacks.forEach(function (cb) { cb.errCb('eSpeak failed to load: ' + err); });
                } else {
                    self.state = 'ready';
                    self._pendingCallbacks.forEach(function (cb) { cb.fn(self.tts); });
                }
                self._pendingCallbacks = [];
            });
        } catch (e) {
            self.state = 'error';
            self._pendingCallbacks.forEach(function (cb) { cb.errCb('eSpeak init error: ' + e.message); });
            self._pendingCallbacks = [];
        }
    };

    /**
     * Converts text to approximate IPA phonemes using rule-based mapping.
     * callback(err, ipaString)
     */
    this.synthesize_ipa = function (text, callback) {
        try {
            var ipa = Espeak.textToIPA(text);
            callback(null, ipa);
        } catch (e) {
            callback('IPA conversion error: ' + e.message, null);
        }
    };

    /**
     * Speaks text aloud using eSpeak-ng. callback(err) when done.
     */
    this.speak = function (text, callback) {
        self._withTTS(
            function (tts) {
                tts.speak(text, { voice: 'en+f3', pitch: 99, rate: 300 }, function (audioData, sampleRate) {
                    if (!audioData) {
                        callback('No audio data produced');
                        return;
                    }
                    SimpleTTS.playAudioData(audioData, sampleRate * 1.5);
                    callback(null);
                });
            },
            function (err) { callback(err); }
        );
    };
}

/**
 * Simple English text → approximate IPA conversion.
 * Processes text word-by-word using digraph/trigraph rules.
 */
Espeak.textToIPA = (function () {

    // Common English words with irregular pronunciation
    var LEXICON = {
        'the': 'ðə', 'a': 'ə', 'an': 'ən', 'i': 'aɪ',
        'is': 'ɪz', 'are': 'ɑːr', 'was': 'wɒz', 'were': 'wɜːr',
        'be': 'biː', 'been': 'bɪn', 'being': 'biːɪŋ',
        'have': 'hæv', 'has': 'hæz', 'had': 'hæd', 'having': 'hævɪŋ',
        'do': 'duː', 'does': 'dʌz', 'did': 'dɪd',
        'will': 'wɪl', 'would': 'wʊd', 'shall': 'ʃæl', 'should': 'ʃʊd',
        'may': 'meɪ', 'might': 'maɪt', 'must': 'mʌst',
        'can': 'kæn', 'could': 'kʊd',
        'to': 'tuː', 'of': 'ɒv', 'in': 'ɪn', 'for': 'fɔːr', 'on': 'ɒn',
        'with': 'wɪð', 'at': 'æt', 'by': 'baɪ', 'from': 'frɒm',
        'or': 'ɔːr', 'as': 'æz', 'but': 'bʌt', 'not': 'nɒt',
        'you': 'juː', 'he': 'hiː', 'she': 'ʃiː', 'it': 'ɪt',
        'we': 'wiː', 'they': 'ðeɪ', 'me': 'miː', 'him': 'hɪm',
        'her': 'hɜːr', 'us': 'ʌs', 'them': 'ðɛm',
        'my': 'maɪ', 'your': 'jɔːr', 'his': 'hɪz', 'its': 'ɪts',
        'our': 'aʊər', 'their': 'ðɛr',
        'this': 'ðɪs', 'that': 'ðæt', 'these': 'ðiːz', 'those': 'ðoʊz',
        'what': 'wɒt', 'which': 'wɪtʃ', 'who': 'huː', 'whom': 'huːm',
        'where': 'wɛr', 'when': 'wɛn', 'why': 'waɪ', 'how': 'haʊ',
        'all': 'ɔːl', 'each': 'iːtʃ', 'every': 'ɛvri',
        'no': 'noʊ', 'yes': 'jɛs', 'one': 'wʌn', 'two': 'tuː',
        'three': 'θriː', 'four': 'fɔːr', 'five': 'faɪv',
        'there': 'ðɛr', 'here': 'hɪər',
        'said': 'sɛd', 'say': 'seɪ', 'says': 'sɛz',
        'go': 'ɡoʊ', 'going': 'ɡoʊɪŋ', 'gone': 'ɡɒn', 'went': 'wɛnt',
        'come': 'kʌm', 'came': 'keɪm',
        'know': 'noʊ', 'knew': 'njuː', 'known': 'noʊn',
        'think': 'θɪŋk', 'thought': 'θɔːt',
        'take': 'teɪk', 'took': 'tʊk', 'taken': 'teɪkən',
        'see': 'siː', 'saw': 'sɔː', 'seen': 'siːn',
        'give': 'ɡɪv', 'gave': 'ɡeɪv', 'given': 'ɡɪvən',
        'make': 'meɪk', 'made': 'meɪd',
        'find': 'faɪnd', 'found': 'faʊnd',
        'get': 'ɡɛt', 'got': 'ɡɒt',
        'put': 'pʊt', 'keep': 'kiːp', 'kept': 'kɛpt',
        'let': 'lɛt', 'tell': 'tɛl', 'told': 'toʊld',
        'work': 'wɜːrk', 'world': 'wɜːrld',
        'through': 'θruː', 'though': 'ðoʊ', 'enough': 'ɪnʌf',
        'tough': 'tʌf', 'cough': 'kɒf', 'rough': 'rʌf',
        'laugh': 'læf', 'daughter': 'dɔːtər',
        'people': 'piːpəl', 'because': 'bɪkɒz',
        'water': 'wɔːtər', 'other': 'ʌðər', 'about': 'əbaʊt',
        'after': 'æftər', 'again': 'əɡɛn', 'also': 'ɔːlsoʊ',
        'always': 'ɔːlweɪz', 'another': 'ənʌðər',
        'before': 'bɪfɔːr', 'between': 'bɪtwiːn',
        'both': 'boʊθ', 'little': 'lɪtəl', 'only': 'oʊnli',
        'some': 'sʌm', 'such': 'sʌtʃ', 'than': 'ðæn', 'then': 'ðɛn',
        'time': 'taɪm', 'very': 'vɛri', 'just': 'dʒʌst',
        'new': 'njuː', 'now': 'naʊ', 'old': 'oʊld',
        'good': 'ɡʊd', 'great': 'ɡreɪt', 'long': 'lɒŋ',
        'own': 'oʊn', 'right': 'raɪt', 'still': 'stɪl',
        'too': 'tuː', 'well': 'wɛl', 'even': 'iːvən',
        'most': 'moʊst', 'much': 'mʌtʃ', 'over': 'oʊvər',
        'many': 'mɛni', 'any': 'ɛni',
        'way': 'weɪ', 'day': 'deɪ', 'man': 'mæn', 'men': 'mɛn',
        'woman': 'wʊmən', 'women': 'wɪmɪn',
        'life': 'laɪf', 'hand': 'hænd', 'part': 'pɑːrt',
        'child': 'tʃaɪld', 'children': 'tʃɪldrən',
        'eye': 'aɪ', 'eyes': 'aɪz',
        'head': 'hɛd', 'heart': 'hɑːrt', 'house': 'haʊs',
        'night': 'naɪt', 'light': 'laɪt', 'high': 'haɪ',
        'love': 'lʌv', 'move': 'muːv', 'prove': 'pruːv',
        'above': 'əbʌv', 'done': 'dʌn', 'none': 'nʌn',
        'once': 'wʌns', 'something': 'sʌmθɪŋ', 'nothing': 'nʌθɪŋ',
        'anything': 'ɛniθɪŋ', 'everything': 'ɛvriθɪŋ'
    };

    // Rule-based conversion: ordered by longest match first
    // Each rule: [pattern, replacement, context]
    // Context: 'end' = only at end of word, 'before_e' = before silent e
    var RULES = [
        // Trigraphs and special combos
        ['igh', 'aɪ'],
        ['tch', 'tʃ'],
        ['dge', 'dʒ'],
        ['tion', 'ʃən'],
        ['sion', 'ʒən'],
        ['ous', 'əs'],
        ['ture', 'tʃər'],
        ['ness', 'nəs'],
        ['ment', 'mənt'],
        ['able', 'əbəl'],
        ['ible', 'əbəl'],
        ['ful', 'fʊl'],
        ['less', 'ləs'],
        ['ing', 'ɪŋ'],
        ['ght', 't'],
        ['ough', 'oʊ'],
        ['augh', 'ɔː'],
        ['eigh', 'eɪ'],
        // Digraphs
        ['th', 'θ'],
        ['sh', 'ʃ'],
        ['ch', 'tʃ'],
        ['wh', 'w'],
        ['ph', 'f'],
        ['gh', ''],
        ['ck', 'k'],
        ['ng', 'ŋ'],
        ['nk', 'ŋk'],
        ['qu', 'kw'],
        ['wr', 'r'],
        ['kn', 'n'],
        ['gn', 'n'],
        // Vowel digraphs
        ['ee', 'iː'],
        ['ea', 'iː'],
        ['oo', 'uː'],
        ['ai', 'eɪ'],
        ['ay', 'eɪ'],
        ['oa', 'oʊ'],
        ['ow', 'aʊ'],
        ['ou', 'aʊ'],
        ['oi', 'ɔɪ'],
        ['oy', 'ɔɪ'],
        ['au', 'ɔː'],
        ['aw', 'ɔː'],
        ['ew', 'juː'],
        ['ie', 'iː'],
        ['ei', 'iː'],
        ['ue', 'uː'],
        ['er', 'ɜːr'],
        ['ir', 'ɜːr'],
        ['ur', 'ɜːr'],
        ['ar', 'ɑːr'],
        ['or', 'ɔːr'],
        // Single consonants with context
        ['x', 'ks'],
        // Single vowels (default short)
        ['a', 'æ'],
        ['e', 'ɛ'],
        ['i', 'ɪ'],
        ['o', 'ɒ'],
        ['u', 'ʌ'],
        ['y', 'i'],
        // Consonants that map directly
        ['b', 'b'],
        ['c', 'k'],
        ['d', 'd'],
        ['f', 'f'],
        ['g', 'ɡ'],
        ['h', 'h'],
        ['j', 'dʒ'],
        ['k', 'k'],
        ['l', 'l'],
        ['m', 'm'],
        ['n', 'n'],
        ['p', 'p'],
        ['r', 'r'],
        ['s', 's'],
        ['t', 't'],
        ['v', 'v'],
        ['w', 'w'],
        ['z', 'z']
    ];

    function wordToIPA(word) {
        var lower = word.toLowerCase().replace(/[^a-z]/g, '');
        if (!lower) return '';
        if (LEXICON[lower]) return LEXICON[lower];

        var result = '';
        var i = 0;
        while (i < lower.length) {
            var matched = false;
            // Try longest patterns first (up to 5 chars)
            for (var len = Math.min(5, lower.length - i); len >= 1; len--) {
                var substr = lower.substring(i, i + len);
                for (var r = 0; r < RULES.length; r++) {
                    if (RULES[r][0] === substr) {
                        result += RULES[r][1];
                        i += len;
                        matched = true;
                        break;
                    }
                }
                if (matched) break;
            }
            if (!matched) {
                // Skip unknown characters
                i++;
            }
        }
        return result;
    }

    return function textToIPA(text) {
        return text.split(/\s+/)
            .filter(function (w) { return w.length > 0; })
            .map(wordToIPA)
            .filter(function (w) { return w.length > 0; })
            .join(' ');
    };
})();

/**
 * Approximate IPA → English spelling conversion.
 * Picks the most common English spelling for each IPA phoneme.
 * Processes word-by-word (IPA words separated by spaces).
 */
Espeak.ipaToText = (function () {

    // Ordered longest-first so multi-char phonemes match before singles
    var REVERSE = [
        ['ʃən', 'tion'],
        ['ʒən', 'sion'],
        ['tʃ', 'ch'],
        ['dʒ', 'j'],
        ['aɪ', 'i'],
        ['eɪ', 'ay'],
        ['ɔɪ', 'oy'],
        ['aʊ', 'ow'],
        ['oʊ', 'o'],
        ['ɪə', 'eer'],
        ['ɛə', 'air'],
        ['ʊə', 'ure'],
        ['iː', 'ee'],
        ['uː', 'oo'],
        ['ɑː', 'ar'],
        ['ɔː', 'aw'],
        ['ɜː', 'er'],
        ['juː', 'ew'],
        ['ŋk', 'nk'],
        ['ŋ', 'ng'],
        ['θ', 'th'],
        ['ð', 'th'],
        ['ʃ', 'sh'],
        ['ʒ', 'zh'],
        ['ɡ', 'g'],
        ['æ', 'a'],
        ['ɛ', 'e'],
        ['ɪ', 'i'],
        ['ɒ', 'o'],
        ['ʌ', 'u'],
        ['ʊ', 'oo'],
        ['ə', 'a'],
        ['b', 'b'],
        ['d', 'd'],
        ['f', 'f'],
        ['h', 'h'],
        ['k', 'k'],
        ['l', 'l'],
        ['m', 'm'],
        ['n', 'n'],
        ['p', 'p'],
        ['r', 'r'],
        ['s', 's'],
        ['t', 't'],
        ['v', 'v'],
        ['w', 'w'],
        ['z', 'z'],
        ['i', 'y'],
        ['j', 'y']
    ];

    function ipaWordToEnglish(ipa) {
        var result = '';
        var i = 0;
        while (i < ipa.length) {
            var matched = false;
            for (var len = Math.min(3, ipa.length - i); len >= 1; len--) {
                var substr = ipa.substring(i, i + len);
                for (var r = 0; r < REVERSE.length; r++) {
                    if (REVERSE[r][0] === substr) {
                        result += REVERSE[r][1];
                        i += len;
                        matched = true;
                        break;
                    }
                }
                if (matched) break;
            }
            if (!matched) {
                i++;
            }
        }
        return result;
    }

    return function ipaToText(ipa) {
        return ipa.split(/\s+/)
            .filter(function (w) { return w.length > 0; })
            .map(ipaWordToEnglish)
            .filter(function (w) { return w.length > 0; })
            .join(' ');
    };
})();
