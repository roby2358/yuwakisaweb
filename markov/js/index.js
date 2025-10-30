$(document).ready(function() {
    let markov = null;

    /**
     * Tokenizes the text by characters
     */
    function tokenizeCharacters(text) {
        // return text.split('');
        return text
            .split(/\s+/)
            .filter(t => t.length > 0)
            .map(t => `${MarkovConstants.Start}${t}${MarkovConstants.End}`);
    }

    /**
     * Removes the start and end markers from a string
     */
    const clean = (s) => s.replaceAll(MarkovConstants.Start, "").replaceAll(MarkovConstants.End, "");
    
    /**
     * Presentation helpers: format generated text for display
     */
    function formatGeneratedText(generatedTokens, tokenizationMode) {
        const separator = tokenizationMode === 'characters' ? ' ' : ' ';
        const tokens = tokenizationMode === 'characters'
            ? generatedTokens.map(clean)
            : generatedTokens;
        return tokens.join(separator);
    }

    function tokenizeWords(text) {
		return text.split(/\n/)
			.map(paragraph => paragraph.split(/\s+/).filter(word => word.length > 0))
			.filter(paragraph => paragraph.length > 0)
			.map(paragraph => [MarkovConstants.Start, ...paragraph, MarkovConstants.End]);
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
        
        const outputLength = parseInt($('#output-length').val()) || 500;
        const tokenizationMode = $('input[name="tokenization"]:checked').val();
        
        const generatedTokens = markov.generateMultiple(outputLength);
        const generatedText = formatGeneratedText(generatedTokens, tokenizationMode);
        
        $('#generated-text').val(generatedText);
    });
    
    // Autoscroll for textareas
    $('textarea').on('input', function() {
        this.scrollTop = this.scrollHeight;
    });
});
