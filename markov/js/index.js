$(document).ready(function() {
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
        
        // TODO: Implement markov chain calculation
        console.log('Calculating markov chain from source text');
    });
    
    // Generate button handler
    $('#generate-btn').on('click', function() {
        // TODO: Implement text generation
        console.log('Generating text using markov chain');
        
        // Placeholder: just show a message
        $('#generated-text').val('Generated text will appear here...');
    });
    
    // Autoscroll for textareas
    $('textarea').on('input', function() {
        this.scrollTop = this.scrollHeight;
    });
});
