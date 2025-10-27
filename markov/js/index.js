$(document).ready(function() {
    let markov = null;
    
    // Tokenization functions
    function tokenizeCharacters(text) {
        // return text.split('');
        return text.split(/\s+/).filter(t => t.length > 0);
    }
    
    function tokenizeWords(text) {
        return text.split(/\s+/).filter(t => t.length > 0);
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
            alert('Please enter source text first.');
            return;
        }
        
        // Get tokenization mode
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        
        // Tokenize the source text
        const tokens = tokenizationMode === 'characters' 
            ? tokenizeCharacters(sourceText)
            : tokenizeWords(sourceText);
        
        if (tokens.length === 0) {
            alert('No tokens found. Please enter some text.');
            return;
        }
        
        // Build the Markov chain (use maxN = 3 for n-gram size)
        markov = new Markov(tokens, 5);
        markov.build();
        
        console.log('Markov chain built with ' + tokens.length + ' tokens');
        alert('Markov chain calculated successfully!');
    });
    
    // Generate button handler
    $('#generate-btn').on('click', function() {
        if (!markov) {
            alert('Please calculate the Markov chain first.');
            return;
        }
        
        // Get output length from input
        const outputLength = parseInt($('#output-length').val()) || 500;
        
        // Generate tokens
        const generatedTokens = markov.generateMultiple(outputLength);
        
        // Join tokens based on tokenization mode
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        const separator = tokenizationMode === 'characters' ? ' ' : ' ';
        const generatedText = generatedTokens.join(separator);
        
        $('#generated-text').val(generatedText);
    });
    
    // Autoscroll for textareas
    $('textarea').on('input', function() {
        this.scrollTop = this.scrollHeight;
    });
});
