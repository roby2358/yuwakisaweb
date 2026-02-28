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
    
    function handleTabClick(event) {
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
    }
    
    function handleNoNewlines() {
        const sourceText = $('#source-text').val();
        const processedText = sourceText.replace(/\n+/g, ' ');
        $('#source-text').val(processedText);
        showMessage('Newlines replaced with spaces.', 'success');
    }

    function handleTweets() {
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
    }

    $('.tab').on('click', handleTabClick);

    $('#no-newlines-btn').on('click', handleNoNewlines);

    $('#tweets-btn').on('click', handleTweets);
    
    function buildMarkov(tokens) {
        if (tokens.length === 0) {
            showMessage('No tokens found. Please enter some text.', 'error');
            return;
        }
        markov = new Markov(tokens, ngramLength);
        markov.build();
        console.log('Markov chain built with ' + tokens.length + ' tokens');
        showMessage('Markov chain calculated successfully!', 'success');
    }

    // Calculate button handler
    $('#calculate-btn').on('click', function() {
        const sourceText = $('#source-text').val();
        if (!sourceText.trim()) {
            showMessage('Please enter source text first.', 'error');
            return;
        }

        // Get tokenization mode
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        const tokenizer = getTokenizer(tokenizationMode);

        if (tokenizationMode === 'phonetic') {
            showMessage('Converting to phonemes...', 'info', 0);
            tokenizer.tokenize(sourceText, function(err, tokens) {
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
    });
    
    // Generate button handler
    $('#generate-btn').on('click', function() {
        if (!markov) {
            showMessage('Please calculate the Markov chain first.', 'error');
            return;
        }
        
        const outputLength = parseInt($('#output-length').val()) || 500;
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        const tokenizer = getTokenizer(tokenizationMode);
        
        const generatedTokens = markov.generateTokens(outputLength);
        const generatedText = tokenizer.format(generatedTokens);
        
        $('#generated-text').val(generatedText);

        showMessage('Generation complete.', 'success');
    });
    
    // Translate button handler (IPA → approximate English)
    $('#translate-btn').on('click', function() {
        const text = $('#generated-text').val();
        if (!text.trim()) {
            showMessage('No text to translate. Generate some text first.', 'error');
            return;
        }
        const english = Espeak.ipaToText(text);
        $('#generated-text').val(english);
        showMessage('Translated IPA to approximate English.', 'success');
    });

    // Speak button handler
    $('#speak-btn').on('click', function() {
        const text = $('#generated-text').val();
        if (!text.trim()) {
            showMessage('No text to speak. Generate some text first.', 'error');
            return;
        }
        showMessage('Speaking...', 'info', 0);
        espeakInstance.speak(text, function(err) {
            if (err) {
                showMessage('Speak error: ' + err, 'error');
                return;
            }
            showMessage('Done speaking.', 'success');
        });
    });

    // Autoscroll for textareas
    $('textarea').on('input', function() {
        this.scrollTop = this.scrollHeight;
    });
});
