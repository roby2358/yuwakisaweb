/**
 * OpenRouterAPI - Client for calling OpenRouter API with OpenAI protocol
 */
export class OpenRouterAPI {
    constructor(apiKey, model = 'anthropic/claude-haiku-4.5') {
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('OpenRouterAPI: API key is required');
        }
        this.apiKey = apiKey.trim();
        this.baseURL = 'https://openrouter.ai/api/v1';
        this.model = model || 'anthropic/claude-haiku-4.5';
    }

    /**
     * Call the chat completion API
     */
    async chat(messages, options = {}) {
        if (!this.apiKey || this.apiKey.trim() === '') {
            throw new Error('API key is missing or empty');
        }

        const apiKey = this.apiKey.trim();

        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': 'Parliamentary Agent Framework'
        };

        const requestBody = {
            model: options.model || this.model,
            messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000
        };

        console.log('Request URL:', `${this.baseURL}/chat/completions`);
        console.log('Request headers:', { ...headers, 'Authorization': 'Bearer ***' }); // Don't log full key
        console.log('Request body:', { ...requestBody, messages: `[${messages.length} messages]` });
        
        // Log full prompt/messages being sent
        console.log('=== PROMPT TO LLM ===');
        console.log('Model:', requestBody.model);
        console.log('Temperature:', requestBody.temperature);
        console.log('Max Tokens:', requestBody.max_tokens);
        console.log('Messages:', JSON.stringify(messages, null, 2));
        console.log('====================');

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            let errorData = null;
            try {
                errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
                console.error('=== API ERROR RESPONSE ===');
                console.error('Status:', response.status);
                console.error('Error Data:', JSON.stringify(errorData, null, 2));
                console.error('========================');
            } catch (e) {
                // If response isn't JSON, use status text
                console.error('=== API ERROR (Non-JSON) ===');
                console.error('Status:', response.status);
                console.error('Status Text:', response.statusText);
                console.error('===========================');
            }
            throw new Error(`API Error: ${errorMessage}`);
        }

        const data = await response.json();
        const responseContent = data.choices[0].message.content;
        
        // Log full response received
        console.log('=== RESPONSE FROM LLM ===');
        console.log('Model Used:', data.model || 'unknown');
        console.log('Usage:', JSON.stringify(data.usage || {}, null, 2));
        console.log('Response Content:', responseContent);
        console.log('==========================');
        
        return responseContent;
    }

    /**
     * Build context for Speaker
     */
    buildSpeakerContext(session, systemPrompt, memberResponses = []) {
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];

        // Add context with state and hansard
        const contextMessage = this.formatContext(session, memberResponses);
        messages.push({
            role: 'user',
            content: contextMessage
        });

        return messages;
    }

    /**
     * Build context for Member
     */
    buildMemberContext(session, systemPrompt, speakerMessage) {
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];

        // Add context
        const contextMessage = this.formatContext(session);
        messages.push({
            role: 'user',
            content: contextMessage + '\n\n' + speakerMessage
        });

        return messages;
    }

    /**
     * Format session context as Markdown
     */
    formatContext(session, memberResponses = []) {
        let context = '';

        // Current state
        context += `For the matter of: ${session.state.currentBill || 'No active Bill'}\n\n`;
        context += `# For Consideration\n\n`;

        // Files
        context += `## Files\n`;
        if (Object.keys(session.files).length === 0) {
            context += `No files currently exist. Use \`parliament-edit [filename] --create "content"\` to create new files.\n\n`;
        } else {
            for (const [filename, content] of Object.entries(session.files)) {
                context += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
        }

        // Papers
        if (session.papers.length > 0) {
            context += `## Tabled Papers\n`;
            for (const paper of session.papers) {
                context += `- **${paper.filename}**: ${paper.description}\n`;
            }
            context += '\n';
        }

        // Amendments
        if (session.amendments.length > 0) {
            context += `## Amendments\n`;
            for (const amdt of session.amendments) {
                context += `- **${amdt.id}**: ${amdt.file} - ${amdt.diff}\n`;
            }
            context += '\n';
        }

        // Hansard
        context += `# Hansard (Recent History)\n`;
        const recentEntries = session.getRecentHansard(10);
        for (const entry of recentEntries) {
            context += `**${entry.speaker}**: ${entry.message}\n`;
        }

        // Member responses (for Speaker only)
        if (memberResponses.length > 0) {
            context += `\n# Member Responses\n`;
            memberResponses.forEach((resp, idx) => {
                context += `\n## Member ${idx + 1}\n${resp}\n`;
            });
        }

        return context;
    }

    /**
     * Parse Markdown response from agent
     */
    parseResponse(markdown) {
        const response = {
            thought: '',
            speak: null,
            action: null,
            vote: null,
            pass: false,
            priority: 5
        };

        // Check for Pass
        if (markdown.includes('## Pass')) {
            response.pass = true;
            return response;
        }

        // Extract Thought
        const thoughtMatch = markdown.match(/## Thought\s*\n([\s\S]*?)(?=\n##|$)/);
        if (thoughtMatch) {
            response.thought = thoughtMatch[1].trim();
        }

        // Extract Speak section (everything in #+ Speak section goes to Hansard)
        const speakMatch = markdown.match(/#+ Speak\s*\n([\s\S]*?)(?=\n#|$)/);
        if (speakMatch) {
            response.speak = speakMatch[1].trim();
            
            // Check if Speak section contains a vote (aye, no, or abstain)
            // Look for vote words as standalone or in common patterns
            const speakContent = response.speak.toLowerCase();
            const votePattern = /\b(aye|no|abstain)\b/i;
            const voteMatch = speakContent.match(votePattern);
            if (voteMatch) {
                response.vote = voteMatch[1].toLowerCase();
            }
        }

        // Extract Decision (for Speaker)
        const decisionMatch = markdown.match(/## Decision\s*\n([\s\S]*?)(?=\n#|$)/);
        if (decisionMatch) {
            response.thought = decisionMatch[1].trim();
        }

        // Extract Action (flexible #+ Action pattern - matches # Action, ## Action, ### Action, etc.)
        const actionMatch = markdown.match(/#+ Action\s*\n([\s\S]*?)(?=\n#|$)/);
        if (actionMatch) {
            const actionBlock = actionMatch[1];

            // Extract priority
            const priorityMatch = actionBlock.match(/\*\*Priority\*\*:\s*(\d+)/);
            if (priorityMatch) {
                response.priority = parseInt(priorityMatch[1]);
            }

            // Extract command - support both old format (with **Command**:) and new format (direct command)
            // First try old format for backward compatibility
            let commandMatch = actionBlock.match(/\*\*Command\*\*:\s*`([^`]+)`/);
            if (commandMatch) {
                response.action = this.normalizeCommand(commandMatch[1]);
            } else {
                // New format: command directly in backticks (may be on same line as Priority or separate line)
                commandMatch = actionBlock.match(/`([^`]+)`/);
                if (commandMatch) {
                    response.action = this.normalizeCommand(commandMatch[1]);
                } else {
                    // Fallback: extract non-empty line that isn't Priority (trimmed)
                    const lines = actionBlock.split('\n').map(l => l.trim()).filter(l => l && !l.match(/^\*\*Priority\*\*:/));
                    if (lines.length > 0) {
                        // Use first non-empty, non-priority line as the command
                        response.action = this.normalizeCommand(lines[0]);
                    }
                }
            }
        }

        return response;
    }

    /**
     * Normalize command by removing optional "bash" prefix and trimming whitespace
     * @param {string} command - The raw command string
     * @returns {string} - The normalized command
     */
    normalizeCommand(command) {
        if (!command) return command;
        
        // Trim whitespace
        let normalized = command.trim();
        
        // Remove optional "bash" prefix (case-insensitive) with optional whitespace
        // Matches: "bash command", "bash  command", "BASH command", etc.
        normalized = normalized.replace(/^bash\s+/i, '');
        
        // Trim again in case there was extra whitespace
        return normalized.trim();
    }
}
