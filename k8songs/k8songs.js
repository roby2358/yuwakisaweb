$(document).ready(function() {
    const styleMap = {
        'rockabilly': 'energetic, kids, rockabilly, rhythm guitar, catchy hook, experimental',
        'softvoice': 'gentle, kids, soft female vocals, acoustic guitar, no accompaniment, catchy hook, experimental',
        'strongvoice': 'energetic, kids, strong female vocals, acoustic guitar, catchy hook, experimental',
        'deepvoice': 'energetic, kids, female voice deep timbre, acoustic guitar, catchy hook, experimental'
    };

    const promptMap = {
        "k8": `
Write a kids song for this story at a K-8 elementary level of reading
comprehension. Add lots of repetition, rounds, and fun vocal stylings.
Write 3 or 4 verses, a bridge, and a chorus.
`,
        "4x4": `
Craft that into lyrics to a song with 4 verses, a bridge and a chorus.
 Use 4x4 meter (4 lines of 8 beats) and an ABAB rhyming scheme. Follow these
 sensibilities: No fancy words No hidden birds Keep it raw Keep it true Tell
 it straight Don't hesitate Make them feel What you do Simpler is stronger
 Don't make it longer Hit them hard With what's real Repetition's your friend
 When you need to send A message home Make them feel Write like you're screaming
 Like your heart is beating Through your throat Through your veins Write like
 you're burning Like the world is turning Inside out Breaking chains Don't
 write pretty Write it gritty Make them hear What you say One clear image One
 raw message Straight to bone No delay Keep it sharp Keep it bold Tell your
 truth Let it fly That's how lyrics Hit like shocks Through the heart Through the sky
 Omit punctuation. Natrual speaking rhythm without poetics. Highly pareidolia
 style without filter words. Avoid mentioning death
`,
        "punchy":`
Craft that into lyrics to a song with 4 verses, a bridge and a chorus.
 Use short, punchy lines of 4 beats and an AABB rhyming scheme. Follow these
 sensibilities: No fancy words No hidden birds Keep it raw Keep it true Tell
 it straight Don't hesitate Make them feel What you do Simpler is stronger
 Don't make it longer Hit them hard With what's real Repetition's your friend
 When you need to send A message home Make them feel Write like you're screaming
 Like your heart is beating Through your throat Through your veins Write like
 you're burning Like the world is turning Inside out Breaking chains Don't
 write pretty Write it gritty Make them hear What you say One clear image One
 raw message Straight to bone No delay Keep it sharp Keep it bold Tell your
 truth Let it fly That's how lyrics Hit like shocks Through the heart Through the sky
 Omit punctuation. Natrual speaking rhythm without poetics. Clipped, terse, punchy.
 Highly pareidolia style without filter words. Avoid mentioning death
`
    };

    const promptFormat = `Use the format:
# Comments
comments
# Thinking
Plan out the song in 500 words or so. Make it catchy and fun!
# Title
title
# Song
lyrics`

    const modelMap = {
        "haiku": "claude-3-5-haiku-20241022",
        "sonnet": "claude-sonnet-4-5-20250929",
        "opus": "claude-opus-4-1-20250805"
    };

    // Populate prompt select dropdown from promptMap keys
    Object.keys(promptMap).forEach(key => {
        $('#prompt-select').append($('<option>', {
            value: key,
            text: key
        }));
    });

    // Populate model select dropdown from modelMap keys
    Object.keys(modelMap).forEach(key => {
        $('#model-select').append($('<option>', {
            value: key,
            text: key
        }));
    });
    $('#model-select').val('haiku'); // Set default to haiku

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

    $('#lyrics-eye').on('click', function() {
        const $lyrics = $('#lyrics');
        const $fullResponse = $('#full-response');
        
        if ($lyrics.is(':visible')) {
            $lyrics.hide();
            $fullResponse.show();
        } else {
            $lyrics.show();
            $fullResponse.hide();
        }
    });

    async function copyToClipboard(text) {
        try {
            // Modern Clipboard API (requires HTTPS or localhost)
            await navigator.clipboard.writeText(text);
        } catch (err) {
            // Fallback for older browsers or HTTP contexts
            const tempTextArea = $('<textarea>');
            $('body').append(tempTextArea);
            tempTextArea.val(text).select();
            document.execCommand('copy');
            tempTextArea.remove();
        }
    }

    const claudeApi = new $.yuwakisa.ClaudeChatApi();

    claudeApi.onSuccess = function(reply) {
        const songText = reply.choices[0];

        console.log(songText);

        let lyrics = '';
        let title = '';

        const titleMatch = songText.match(/# Title[^\n]*\n([\s\S]*?)(?=\n#|$)/);
        const lyricsMatch = songText.match(/# Song[^\n]*\n([\s\S]*?)(?=\n#|$)/);

        if (titleMatch) {
            title = titleMatch[1].trim().replaceAll(/["]/g, '');
        }
        if (lyricsMatch) {
            lyrics = lyricsMatch[1].trim();
        }

        $('#lyrics').val(lyrics);
        $('#title').val(title);
        $('#full-response').text(songText);
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
        const selectedPrompt = $('#prompt-select').val();
        const selectedModel = $('#model-select').val();
        const prompt = promptMap[selectedPrompt] + promptFormat;
        const messages = claudeApi.buildPrompt(prompt, [story]);
        claudeApi.call(messages, modelMap[selectedModel]);
    });

    $('#make-music').on('click', function() {
        window.open('https://suno.ai', '_blank');
    });
});

// ClaudeChatApi implementation (simplified version)
$.yuwakisa = $.yuwakisa || {};
$.yuwakisa.ClaudeChatApi = function() {
    this.apiKey = '';
    this.url = 'https://api.anthropic.com/v1/messages';
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

    this.call = async function(messages, model) {
        const headers = {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
            "anthropic-version": this.anthropic_version,
            "anthropic-dangerous-direct-browser-access": "true"
        };

        const data = {
            model: model,
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