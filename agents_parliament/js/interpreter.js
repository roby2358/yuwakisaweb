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
     * Process Speaker response: parse, record to Hansard, and execute actions
     */
    async processSpeakerResponse(speakerResponse, invokeMembers, invokeMember, memberCount) {
        const speakerAction = this.api.parseResponse(speakerResponse);

        // Log speaker's speech (from # Speak section) or thought (from Decision section)
        if (speakerAction.speak) {
            const entry = this.session.addToHansard('Speaker', speakerAction.speak);
            this.ui.addHansardEntry(entry);
        } else if (speakerAction.thought) {
            // Fallback to thought if no Speak section (for backward compatibility)
            const entry = this.session.addToHansard('Speaker', speakerAction.thought);
            this.ui.addHansardEntry(entry);
        }

        // Execute Speaker's command
        if (speakerAction.action) {
            const entry = this.session.addToHansard('Speaker', `Executing: ${speakerAction.action}`, { command: speakerAction.action });
            this.ui.addHansardEntry(entry);

            const result = this.session.executeTool(speakerAction.action);

            if (result.status === 'error') {
                this.ui.addSystemMessage(`Tool error: ${result.message}`);
            } else if (result.data && result.data.requiresInvocation) {
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
            const entry = this.session.addToHansard(memberName, 'Pass');
            this.ui.addHansardEntry(entry);
        } else if (parsed.vote) {
            // Vote is in Speak section - record full Speak content to Hansard and extract vote
            if (parsed.speak) {
                const entry = this.session.addToHansard(memberName, parsed.speak);
                this.ui.addHansardEntry(entry);
            } else {
                // Fallback if Speak wasn't parsed but vote was detected
                const entry = this.session.addToHansard(memberName, `Votes: ${parsed.vote}`);
                this.ui.addHansardEntry(entry);
            }
            this.session.recordVote(memberName, parsed.vote);
        } else {
            // Build the message: speech + action (if present)
            let message = '';
            
            // Check if there's a # Speak section or Action section (flexible #+ Action pattern)
            const hasSpeakSection = memberResponse.includes('# Speak');
            const hasActionSection = /#+ Action/.test(memberResponse);
            
            if (hasSpeakSection || hasActionSection) {
                // Use parsed sections if they exist
                if (parsed.speak) {
                    message = parsed.speak;
                } else if (parsed.thought) {
                    // Fallback: if no Speak section but there's a thought, use it
                    message = parsed.thought;
                }
                
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
            if (message) {
                const entry = this.session.addToHansard(memberName, message);
                this.ui.addHansardEntry(entry);
            }
            
            // Execute action if any
            if (parsed.action) {
                const result = this.session.executeTool(parsed.action);
                if (result.status === 'error') {
                    this.ui.addSystemMessage(`Tool error from ${memberName}: ${result.message}`);
                }
            }
        }
    }
}

