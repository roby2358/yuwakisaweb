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
    
    // Tab switching functionality
    $('.tab').on('click', function() {
        const targetTab = $(this).data('tab');
        
        // Update tab states
        $('.tab').removeClass('active');
        $(this).addClass('active');
        
        // Update panel states
        $('.panel').removeClass('active');
        if (targetTab === 'source') {
            $('#source-panel').addClass('active');
        } else if (targetTab === 'generated') {
            $('#generated-panel').addClass('active');
        } else if (targetTab === 'about') {
            $('#about-panel').addClass('active');
        }
    });
    
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
        
        const generatedTokens = markov.generateMultiple(outputLength);
        const generatedText = tokenizer.format(generatedTokens);
        
        $('#generated-text').val(generatedText);

        showMessage('Generation complete.', 'success');
    });
    
    // Autoscroll for textareas
    $('textarea').on('input', function() {
        this.scrollTop = this.scrollHeight;
    });
});
