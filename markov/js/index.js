const wordsTokenizer = new Words();
const textTokenizer = new Text();
const gptTokenizerInstance = new Gpt();
const ngramLength = 3;

/**
 * Gets the appropriate tokenizer based on mode
 */
function getTokenizer(mode) {
    if (mode === 'characters') {
        return wordsTokenizer;
    } else if (mode === 'gpt') {
        return gptTokenizerInstance;
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
    
    // Calculate button handler
    $('#calculate-btn').on('click', function() {
        const sourceText = $('#source-text').val();
        if (!sourceText.trim()) {
            showMessage('Please enter source text first.', 'error');
            return;
        }
        
        // Get tokenization mode
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        
        // Tokenize the source text
        const tokenizer = getTokenizer(tokenizationMode);
        
        // Check if GPT tokenizer library is available when GPT mode is selected
        // Note: ES modules load asynchronously, so it might not be ready immediately
        if (tokenizationMode === 'gpt') {
            // Check window.gptTokenizer directly since it's set by the ES module script
            const gptTokenLib = typeof window !== 'undefined' ? window.gptTokenizer : gptTokenizer;
            if (!gptTokenLib || !gptTokenLib.encode || typeof gptTokenLib.encode !== 'function') {
                showMessage('GPT tokenizer library not loaded yet. Please wait a moment and try again, or check browser console.', 'error');
                console.error('gptTokenizer state:', {
                    windowGptTokenizer: typeof window !== 'undefined' ? window.gptTokenizer : 'N/A',
                    localGptTokenizer: gptTokenizer,
                    hasWindow: typeof window !== 'undefined'
                });
                return;
            }
        }
        
        const tokens = tokenizer.tokenize(sourceText);
        
        if (tokens.length === 0) {
            showMessage('No tokens found. Please enter some text.', 'error');
            return;
        }
        
        // Build the Markov chain
        markov = new Markov(tokens, ngramLength);
        markov.build();
        
        console.log('Markov chain built with ' + tokens.length + ' tokens');
        showMessage('Markov chain calculated successfully!', 'success');
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
    
    // Autoscroll for textareas
    $('textarea').on('input', function() {
        this.scrollTop = this.scrollHeight;
    });
});
