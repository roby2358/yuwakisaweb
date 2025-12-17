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
        "haiku": "anthropic/claude-haiku-4.5",
        "sonnet": "anthropic/claude-sonnet-4.5",
        "opus": "anthropic/claude-opus-4.5"
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

    const openRouterApi = new $.yuwakisa.OpenRouterChatApi();

    openRouterApi.onSuccess = function(reply) {
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

    openRouterApi.onError = function(error) {
        console.error('API Error:', error);
        $('#song').val('Error generating song. Please try again.');
    };

    $('#make-song').on('click', function() {
        const apiKey = $('#api-key').val();
        if (!apiKey) {
            alert('Please enter your API key');
            return;
        }

        openRouterApi.setApiKey(apiKey);

        const story = $('#story').val();
        const selectedPrompt = $('#prompt-select').val();
        const selectedModel = $('#model-select').val();
        const prompt = promptMap[selectedPrompt] + promptFormat;
        const messages = openRouterApi.buildPrompt(prompt, [story]);
        openRouterApi.call(messages, modelMap[selectedModel]);
    });

    $('#make-music').on('click', function() {
        window.open('https://suno.ai', '_blank');
    });
});

// OpenRouterChatApi implementation
$.yuwakisa = $.yuwakisa || {};
$.yuwakisa.OpenRouterChatApi = function() {
    this.apiKey = '';
    this.url = 'https://openrouter.ai/api/v1/chat/completions';

    this.setApiKey = function(key) {
        this.apiKey = key;
    };

    this.onSuccess = (reply) => { console.log(reply); }
    this.onError = (json) => { console.log(json); }

    this.buildPrompt = (systemText, messages) => {
        return [
            { role: "system", content: systemText },
            { role: "user", content: messages.join("\n") }
        ];
    };

    this.formatReply = function(json) {
        if (!json.choices || json.choices.length === 0) {
            return { choices: [], usage: json?.usage };
        }
        return {
            choices: [json.choices[0].message.content],
            usage: json.usage
        };
    }

    this.call = async function(messages, model) {
        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "k8songs"
        };

        const data = {
            model: model,
            messages: messages,
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