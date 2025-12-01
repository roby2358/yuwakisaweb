/**
 * Interpreter - Processes agent responses and executes tools
 */
export class Interpreter {
    constructor(session, api, ui) {
        this.session = session;
        this.api = api;
        this.ui = ui;
    }

    /**
     * Extract message from parsed response (speak or thought)
     * @param {Object} parsed - Parsed response object
     * @returns {string} - Extracted message
     */
    extractMessage(parsed) {
        if (parsed.speak) {
            return parsed.speak;
        }
        if (parsed.thought) {
            return parsed.thought;
        }
        return '';
    }

    /**
     * Record entry to Hansard and update UI
     * @param {string} speaker - Speaker name
     * @param {string} message - Message to record
     * @param {Object} metadata - Optional metadata
     */
    recordToHansard(speaker, message, metadata = {}) {
        if (!message) return null;
        const entry = this.session.addToHansard(speaker, message, metadata);
        this.ui.addHansardEntry(entry);
        return entry;
    }

    /**
     * Execute action and handle errors
     * @param {string} action - Action command to execute
     * @param {string} speakerName - Name of speaker for error messages
     * @returns {Object} - Tool execution result
     */
    executeAction(action, speakerName = 'Unknown') {
        if (!action) return null;
        
        const result = this.session.executeTool(action);
        if (result.status === 'error') {
            this.ui.addSystemMessage(`Tool error from ${speakerName}: ${result.message}`);
        }
        return result;
    }

    /**
     * Process Speaker response: parse, record to Hansard, and execute actions
     */
    async processSpeakerResponse(speakerResponse, invokeMembers, invokeMember, memberCount) {
        const parsed = this.api.parseResponse(speakerResponse);

        // Build message from speech only (action goes in metadata, not message)
        const message = this.extractMessage(parsed);
        const metadata = parsed.action ? { command: parsed.action } : {};

        // Record single entry with speech (action appears only in execution portion via metadata)
        this.recordToHansard('Speaker', message, metadata);

        // Execute Speaker's command
        if (parsed.action) {
            const result = this.executeAction(parsed.action, 'Speaker');

            if (result && result.data && result.data.requiresInvocation) {
                // Handle parliament-recognize: invoke member(s)
                const recognizeData = result.data;
                const instruction = recognizeData.instruction || 'What is your response?';
                
                if (recognizeData.target === 'all') {
                    // Invoke all members
                    this.ui.addSystemMessage('Recognizing all members...');
                    const memberResponses = await invokeMembers(instruction);
                    
                    // Process member responses
                    for (let i = 0; i < memberResponses.length; i++) {
                        await this.processMemberResponse(memberResponses[i], i + 1);
                    }
                } else {
                    // Invoke specific member
                    const memberNumber = recognizeData.target;
                    this.ui.addSystemMessage(`Recognizing Member ${memberNumber}...`);
                    const memberResponse = await invokeMember(memberNumber, instruction);
                    await this.processMemberResponse(memberResponse, memberNumber);
                }
                
                this.ui.updateAll(this.session);
            }

            // Check if House was adjourned
            if (this.session.state.adjourned) {
                this.ui.addSystemMessage('The House has been adjourned. Session ending.');
                return { adjourned: true };
            }

            this.ui.updateAll(this.session);
        }

        return { adjourned: false };
    }

    /**
     * Process Member response: parse, record to Hansard, execute actions
     */
    async processMemberResponse(memberResponse, memberNumber) {
        const parsed = this.api.parseResponse(memberResponse);
        const memberName = `Member ${memberNumber}`;

        if (parsed.pass) {
            this.recordToHansard(memberName, 'Pass');
            return;
        }

        if (parsed.vote) {
            // Vote is in Speak section - record full Speak content to Hansard and extract vote
            const voteMessage = parsed.speak || `Votes: ${parsed.vote}`;
            this.recordToHansard(memberName, voteMessage);
            this.session.recordVote(memberName, parsed.vote);
            return;
        }

        // Build the message: speech + action (if present)
        let message = '';
        
        // Check if there's a # Speak section or Action section (flexible #+ Action pattern)
        const hasSpeakSection = memberResponse.includes('# Speak');
        const hasActionSection = /#+ Action/.test(memberResponse);
        
        if (hasSpeakSection || hasActionSection) {
            // Use parsed sections if they exist
            message = this.extractMessage(parsed);
            
            // Append action to the message if present
            if (parsed.action) {
                if (message) {
                    message += '\n\n```\n' + parsed.action + '\n```';
                } else {
                    message = '```\n' + parsed.action + '\n```';
                }
            }
        } else {
            // No # Speak or # Action sections - use full response as-is
            message = memberResponse.trim();
        }
        
        // Record single entry with speech and action combined (or full response)
        this.recordToHansard(memberName, message);
        
        // Execute action if any
        this.executeAction(parsed.action, memberName);
    }
}

