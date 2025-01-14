$(document).ready(function() {
    const styleMap = {
        'rockabilly': 'energetic, kids, rockabilly, rhythm guitar, catchy hook, experimental',
        'softvoice': 'gentle, kids, soft female vocals, acoustic guitar, no accompaniment, catchy hook, experimental',
        'strongvoice': 'energetic, kids, strong female vocals, acoustic guitar, catchy hook, experimental',
        'deepvoice': 'energetic, kids, female voice deep timbre, acoustic guitar, catchy hook, experimental'
    };

    $('#style-select').on('change', function() {
        const selectedStyle = $(this).val();
        $('#music_style').val(styleMap[selectedStyle] || '');
    });

    $('.copy-btn').on('click', function() {
        const targetId = $(this).data('target');
        const text = $(`#${targetId}`).val();
        copyToClipboard(text);
        const originalText = $(this).text();
        $(this).text('Copied!');
        setTimeout(() => {
            $(this).text(originalText);
        }, 2000);
    });

    function copyToClipboard(text) {
        const tempTextArea = $('<textarea>');
        $('body').append(tempTextArea);
        tempTextArea.val(text).select();
        document.execCommand('copy');
        tempTextArea.remove();
    }

    const claudeApi = new $.yuwakisa.ClaudeChatApi('claude-3-haiku-20240307');

    claudeApi.onSuccess = function(reply) {
        const songText = reply.choices[0];

        console.log(songText);

        let lyrics = '';
        let title = '';

        const titleMatch = songText.match(/# Title[^\n]*\n([\s\S]*?)(?=\n#|$)/);
        const lyricsMatch = songText.match(/# Song[^\n]*\n([\s\S]*?)(?=\n#|$)/);

        if (titleMatch) {
            title = titleMatch[1].trim().replace('"', '');
        }
        if (lyricsMatch) {
            lyrics = lyricsMatch[1].trim();
        }

        $('#lyrics').val(lyrics);
        $('#title').val(title);
    };

    claudeApi.onError = function(error) {
        console.error('API Error:', error);
        $('#song').val('Error generating song. Please try again.');
    };

    $('#make-song').on('click', function() {
        const apiKey = $('#api-key').val();
        if (!apiKey) {
            alert('Please enter your API key');
            return;
        }

        claudeApi.setApiKey(apiKey);

        const story = $('#story').val();
        const prompt = `
Write a kids song for this story at a K-8 elementary level of reading
comprehension. Add lots of repetition, rounds, and fun vocal stylings.
Write 3 or 4 verses, a bridge, and a chorus.
Use the format:
# Comments
comments
# Thinking
Plan out the song in 500 words or so. Make it catchy and fun!
# Title
title
# Song
lyrics`;

        const messages = claudeApi.buildPrompt(prompt, [story]);
        claudeApi.call(messages);
    });

    $('#make-music').on('click', function() {
        window.open('https://suno.ai', '_blank');
    });
});

// ClaudeChatApi implementation (simplified version)
$.yuwakisa = $.yuwakisa || {};
$.yuwakisa.ClaudeChatApi = function(model) {
    this.apiKey = '';
    this.url = 'https://api.anthropic.com/v1/messages';
    this.model = model || 'claude-3-haiku-20240307';
    this.anthropic_version = '2023-06-01';

    this.setApiKey = function(key) {
        this.apiKey = key;
    };

    this.onSuccess = (reply) => { console.log(reply); }
    this.onError = (json) => { console.log(json); }

    this.buildPrompt = (systemText, messages) => {
        return {
            system: [{ type: "text", text: systemText }],
            messages: [{ role: "user", content: messages.join("\n") }]
        };
    };

    this.formatReply = function(json) {
        if (!json.content || json.content.length === 0) {
            return { choices: [], usage: json?.usage };
        }
        return {
            choices: [json.content[0].text],
            usage: {
                prompt_tokens: json.usage?.input_tokens,
                completion_tokens: json.usage?.output_tokens,
                total_tokens: json.usage?.input_tokens + json.usage?.output_tokens
            }
        };
    }

    this.call = async function(messages) {
        const headers = {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
            "anthropic-version": this.anthropic_version,
            "anthropic-dangerous-direct-browser-access": "true"
        };

        const data = {
            model: this.model,
            messages: messages.messages,
            system: messages.system,
            max_tokens: 1000,
        };

        console.log(headers);
        console.log(data);

        try {
            const response = await fetch(this.url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(data),
            });

            const json = await response.json();

            if (!response.ok) {
                this.onError(json);
                return;
            }

            const formattedReply = this.formatReply(json);
            this.onSuccess(formattedReply);
        }
        catch (e) {
            console.log(e);
            this.onError({"error": {"message": e}});
        }
    }
};