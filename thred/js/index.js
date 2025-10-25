/**
 * Main JavaScript file for Thred UI
 * Handles jQuery-based interactions
 */

$(document).ready(function() {
    // Initialize Thred instance
    const thred = new Thred();
    
    // RUN button functionality
    $('#run-btn').click(function() {
        const code = $('#code-editor').val();
        const output = thred.run(code);
        
        // Replace newlines with <br/> tags as specified
        const formattedOutput = output.replace(/\n/g, '<br/>');
        
        // Display output in the output div
        $('#output-display').html(formattedOutput);
    });
    
    // CLEAR button functionality
    $('#clear-btn').click(function() {
        $('#output-display').empty();
    });
});

