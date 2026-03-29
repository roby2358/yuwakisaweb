const wordsTokenizer = new Words();
const textTokenizer = new Text();
const gptTokenizerInstance = new Gpt();
const espeakInstance = new Espeak();
const phoneticTokenizer = new Phonetic(espeakInstance);
const ngramLength = 3;

/**
 * Gets the appropriate tokenizer based on mode
 */
function getTokenizer(mode) {
    if (mode === 'characters') {
        return wordsTokenizer;
    } else if (mode === 'gpt') {
        return gptTokenizerInstance;
    } else if (mode === 'phonetic') {
        return phoneticTokenizer;
    } else {
        return textTokenizer;
    }
}

$(document).ready(function() {
    let markov = null;

    let messageTimeoutId = null;
    function showMessage(text, type = 'info', autoHideMs = 3500) {
        const $bar = $('#message-bar');
        $bar.removeClass('info success error visible');
        $bar.text(text);
        $bar.addClass(type).addClass('visible');
        if (messageTimeoutId) {
            clearTimeout(messageTimeoutId);
        }
        if (autoHideMs > 0) {
            messageTimeoutId = setTimeout(() => {
                $bar.removeClass('visible');
            }, autoHideMs);
        }
    }
    
    const handleTabClick = (event) => {
        const $tab = $(event.currentTarget);
        const targetTab = $tab.data('tab');

        if (!targetTab) {
            return;
        }

        $('.tab').removeClass('active');
        $tab.addClass('active');

        $('.panel').removeClass('active');
        if (targetTab === 'source') {
            $('#source-panel').addClass('active');
            return;
        }

        if (targetTab === 'generated') {
            $('#generated-panel').addClass('active');
            return;
        }

        if (targetTab === 'about') {
            $('#about-panel').addClass('active');
        }
    };

    const handleNoNewlines = () => {
        const sourceText = $('#source-text').val();
        const processedText = sourceText.replace(/\s+/g, ' ').trim();
        $('#source-text').val(processedText);
        showMessage('Whitespace collapsed.', 'success');
    };

    const handleTweets = () => {
        const sourceText = $('#source-text').val();
        if (!sourceText.trim()) {
            showMessage('Please enter source text first.', 'error');
            return;
        }

        const cleanedText = extractTweetBodies(sourceText);
        if (!cleanedText.trim()) {
            showMessage('No tweet text detected after cleaning.', 'error');
            return;
        }

        $('#source-text').val(cleanedText);
        showMessage('Tweet metadata removed.', 'success');
    };

    $('.tab').on('click', handleTabClick);
    $('#no-newlines-btn').on('click', handleNoNewlines);
    $('#tweets-btn').on('click', handleTweets);

    const buildMarkov = (tokens) => {
        if (tokens.length === 0) {
            showMessage('No tokens found. Please enter some text.', 'error');
            return;
        }
        markov = new Markov(tokens, ngramLength);
        markov.build();
        console.log('Markov chain built with ' + tokens.length + ' tokens');
        showMessage('Markov chain calculated successfully!', 'success');
    };

    const handleCalculate = () => {
        const sourceText = $('#source-text').val();
        if (!sourceText.trim()) {
            showMessage('Please enter source text first.', 'error');
            return;
        }

        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        const tokenizer = getTokenizer(tokenizationMode);

        if (tokenizationMode === 'phonetic') {
            showMessage('Converting to phonemes...', 'info', 0);
            tokenizer.tokenize(sourceText, (err, tokens) => {
                if (err) {
                    showMessage('Phonetic error: ' + err, 'error');
                    return;
                }
                buildMarkov(tokens);
            });
        } else {
            const tokens = tokenizer.tokenize(sourceText);
            buildMarkov(tokens);
        }
    };

    const clearGenerated = () => $('#generated-text').val('');

    const handleGenerate = () => {
        if (!markov) {
            showMessage('Please calculate the Markov chain first.', 'error');
            return;
        }

        const outputLength = parseInt($('#output-length').val()) || 500;
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        const tokenizer = getTokenizer(tokenizationMode);

        const existingText = $('#generated-text').val().trim();
        let seed = null;

        if (existingText && tokenizationMode !== 'phonetic') {
            const seedGroups = tokenizer.tokenize(existingText);
            if (seedGroups.length > 0) {
                const lastGroup = seedGroups[seedGroups.length - 1];
                seed = lastGroup.filter(t => t !== MarkovConstants.End);
            }
        }

        const generatedTokens = markov.generateTokens(outputLength, seed);

        // Strip seed tokens from the first group so they aren't duplicated in output
        if (seed && generatedTokens.length > 0) {
            const first = generatedTokens[0];
            // First group starts with the seed; remove those tokens (keep Start marker + tokens after seed)
            // seed is e.g. ["<", "The", "only"], first group is ["<", "The", "only", "Self", ..., ">"]
            generatedTokens[0] = [MarkovConstants.Start, ...first.slice(seed.length, -1), MarkovConstants.End];
        }

        const generatedText = tokenizer.format(generatedTokens).trimStart();

        if (existingText) {
            $('#generated-text').val(existingText + ' ' + generatedText);
        } else {
            $('#generated-text').val(generatedText);
        }

        showMessage('Generation complete.', 'success');
    };

    const handleTranslate = () => {
        const text = $('#generated-text').val();
        if (!text.trim()) {
            showMessage('No text to translate. Generate some text first.', 'error');
            return;
        }
        const english = Espeak.ipaToText(text);
        $('#generated-text').val(english);
        showMessage('Translated IPA to approximate English.', 'success');
    };

    const handleSpeak = () => {
        const text = $('#generated-text').val();
        if (!text.trim()) {
            showMessage('No text to speak. Generate some text first.', 'error');
            return;
        }
        showMessage('Speaking...', 'info', 0);
        espeakInstance.speak(text, (err) => {
            if (err) {
                showMessage('Speak error: ' + err, 'error');
                return;
            }
            showMessage('Done speaking.', 'success');
        });
    };

    $('#calculate-btn').on('click', handleCalculate);
    $('#clear-btn').on('click', clearGenerated);
    $('#generate-btn').on('click', handleGenerate);
    $('#translate-btn').on('click', handleTranslate);
    $('#speak-btn').on('click', handleSpeak);

    // Autoscroll for textareas
    const autoscroll = (event) => { event.target.scrollTop = event.target.scrollHeight; };
    $('textarea').on('input', autoscroll);
});
