import { ParliamentSession } from './js/ParliamentSession.js';
import { OpenRouterAPI } from './js/OpenRouterAPI.js';
import { UIManager } from './js/UIManager.js';

/**
 * Main Application
 */
class ParliamentApp {
    constructor() {
        this.session = new ParliamentSession();
        this.ui = new UIManager();
        this.api = null;
        this.isRunning = false;
        this.memberCount = 5;
        this.apiKey = null; // Store API key in memory, not DOM
        this.maxTurns = 20; // Safety limit, can be doubled on restart

        // Load system prompts
        this.prompts = {
            speaker: null,
            member: null
        };

        this.setupEventListeners();
        this.init();
    }

    async init() {
        // Load prompts
        await this.loadPrompts();

        // Try to restore API key from sessionStorage (if user previously allowed)
        const apiKeyLoaded = this.restoreApiKeyFromStorage();

        // Initial UI update
        this.ui.updateAll(this.session);

        // Build initialization message
        let message = 'Parliamentary Agent Framework initialized. ';
        if (apiKeyLoaded) {
            message += 'API key loaded from session. Enter a matter to address, then click Start Session.';
        } else {
            message += 'Enter your OpenRouter API key and a matter to address, then click Start Session.';
        }
        
        this.ui.addSystemMessage(message);
    }

    /**
     * Restore API key from sessionStorage if available
     * @returns {boolean} True if API key was successfully restored
     */
    restoreApiKeyFromStorage() {
        try {
            const stored = sessionStorage.getItem('parliament_api_key_remember');
            if (stored === 'true') {
                const key = sessionStorage.getItem('parliament_api_key');
                if (key && key.trim() !== '') {
                    // Store in memory but don't show in input field for security
                    this.apiKey = key.trim();
                    this.ui.elements.apiKey.placeholder = 'API key restored from session (hidden)';
                    return true;
                } else {
                    // Clear invalid stored key
                    sessionStorage.removeItem('parliament_api_key');
                    sessionStorage.removeItem('parliament_api_key_remember');
                }
            }
        } catch (error) {
            // sessionStorage not available or blocked
            console.warn('Could not access sessionStorage:', error);
        }
        return false;
    }

    async loadPrompts() {
        try {
            const [speakerResp, memberResp, mpResp] = await Promise.all([
                fetch('ROLE_SPEAKER.md'),
                fetch('ROLE_MEMBER.md'),
                fetch('MP.md')
            ]);

            const speakerText = await speakerResp.text();
            const memberText = await memberResp.text();
            const mpText = await mpResp.text();

            this.prompts.speaker = speakerText;
            this.prompts.member = memberText + '\n\n' + mpText;

        } catch (error) {
            console.error('Failed to load prompts:', error);
            this.ui.addSystemMessage('Warning: Could not load role prompts. Using defaults.');

            // Minimal fallback prompts
            this.prompts.speaker = `# Role: Speaker
You are the Speaker of Parliament. Review member actions and decide what happens next.
Respond with:
## Decision
[Your reasoning]
## Execution
**Command**: \`parliament-speak "message"\``;

            this.prompts.member = `# Role: Member of Parliament
You are a Member of Parliament. Follow the parliamentary process.
Respond with:
## Thought
[Your reasoning]
# Speak
[Your speech to the House. Everything you write here goes into the Hansard.]
## Action
**Priority**: 5
**Command**: \`[command if needed]\``;
        }
    }

    setupEventListeners() {
        this.ui.elements.startBtn.addEventListener('click', () => this.start());
        this.ui.elements.pauseBtn.addEventListener('click', () => this.pause());
    }

    async start() {
        // Reset button text to "Start Session" in case it was "Restart Session"
        this.ui.setStartButtonText('Start Session');
        
        // Get API key from input (user may have changed it) or memory
        const inputKey = this.ui.getApiKey();
        let apiKey = inputKey || this.apiKey;
        
        if (!apiKey || apiKey.trim() === '') {
            alert('Please enter your OpenRouter API key');
            return;
        }

        // Trim whitespace
        apiKey = apiKey.trim();

        // If user entered a new key, use that (they may want to change it)
        if (inputKey && inputKey.trim() !== this.apiKey) {
            apiKey = inputKey.trim();
        }

        // Validate API key format (OpenRouter keys typically start with 'sk-or-')
        if (!apiKey.startsWith('sk-')) {
            console.warn('API key format may be incorrect. OpenRouter keys typically start with "sk-or-"');
        }

        // Store in memory and clear from DOM for security
        this.apiKey = apiKey;
        this.ui.clearApiKey();

        // Save to sessionStorage for this session
        this.saveApiKeyToStorage();

        this.api = new OpenRouterAPI(apiKey);
        this.isRunning = true;
        this.ui.setLoading(true);

        this.ui.addSystemMessage('Session started. Initializing parliament...');

        // Run the main loop
        try {
            await this.runSession();
        } catch (error) {
            console.error('Session error:', error);
            this.ui.addSystemMessage(`Error: ${error.message}`);
            this.isRunning = false;
            this.ui.setLoading(false);
        }
    }

    /**
     * Save API key to sessionStorage if user opts in
     */
    saveApiKeyToStorage() {
        try {
            // Check if user wants to remember (could add a checkbox in UI)
            // For now, we'll save it for the session only
            sessionStorage.setItem('parliament_api_key', this.apiKey);
            sessionStorage.setItem('parliament_api_key_remember', 'true');
        } catch (error) {
            // sessionStorage not available
            console.warn('Could not save to sessionStorage:', error);
        }
    }

    pause() {
        this.isRunning = false;
        this.ui.setLoading(false);
        this.ui.addSystemMessage('Session paused.');
    }

    /**
     * Clear API key from memory (for security)
     */
    clearApiKey() {
        this.apiKey = null;
        this.api = null;
        try {
            sessionStorage.removeItem('parliament_api_key');
            sessionStorage.removeItem('parliament_api_key_remember');
        } catch (error) {
            // Ignore
        }
    }

    async runSession() {
        let userInput = this.ui.getUserInput();

        // If no user input, prompt for one
        if (!userInput || userInput.trim() === '') {
            this.ui.addSystemMessage('No petition from the Crown provided. Please enter a matter to address.');
            this.isRunning = false;
            this.ui.setLoading(false);
            return;
        }

        // Initialize with user input
        this.ui.addSystemMessage(`Petition from the Crown: ${userInput}`);
        await this.sleep(500);

        let turnCount = 0;

        while (this.isRunning && turnCount < this.maxTurns && !this.session.state.adjourned) {
            turnCount++;

            // Phase A: Speaker Decision
            // On first turn, include user input as additional context
            const additionalContext = turnCount === 1
                ? `\n\n# Petition from the Crown\n${userInput}\n\nPlease open the session by addressing this petition. This is a matter brought before the House for consideration.`
                : '';

            const speakerResponse = await this.invokeSpeaker([], additionalContext);
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

            // Phase B: Execute Speaker's command
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
                        const memberResponses = await this.invokeMembers(instruction);
                        
                        // Process member responses
                        for (let i = 0; i < memberResponses.length; i++) {
                            await this.processMemberResponse(memberResponses[i], i + 1);
                        }
                    } else {
                        // Invoke specific member
                        const memberNumber = recognizeData.target;
                        this.ui.addSystemMessage(`Recognizing Member ${memberNumber}...`);
                        const memberResponse = await this.invokeMember(memberNumber, instruction);
                        await this.processMemberResponse(memberResponse, memberNumber);
                    }
                    
                    this.ui.updateAll(this.session);
                    await this.sleep(1000);
                }

                // Check if House was adjourned
                if (this.session.state.adjourned) {
                    this.ui.addSystemMessage('The House has been adjourned. Session ending.');
                    break;
                }

                this.ui.updateAll(this.session);
            }

            await this.sleep(1000);
        }

        if (this.session.state.adjourned) {
            this.ui.addSystemMessage('Session ended: House adjourned by Speaker');
        } else if (turnCount >= this.maxTurns) {
            this.ui.addSystemMessage('Session ended: Maximum turns reached');
            // Change button to "Restart Session" and double max turns
            this.ui.setStartButtonText('Restart Session');
            this.maxTurns *= 2;
        }

        this.isRunning = false;
        this.ui.setLoading(false);
    }

    async invokeSpeaker(memberResponses, additionalContext = '') {
        console.log('=== INVOKING SPEAKER ===');
        console.log('Member Responses Count:', memberResponses.length);
        console.log('Additional Context:', additionalContext || 'None');
        
        const messages = this.api.buildSpeakerContext(
            this.session,
            this.prompts.speaker,
            memberResponses
        );

        // Add additional context to the user message if provided
        if (additionalContext) {
            messages[messages.length - 1].content += additionalContext;
        }

        console.log('Speaker System Prompt Length:', this.prompts.speaker?.length || 0);
        console.log('Speaker Messages Count:', messages.length);
        console.log('==========================');

        try {
            const response = await this.api.chat(messages);
            console.log('=== SPEAKER RESPONSE RECEIVED ===');
            console.log('Response Length:', response.length);
            console.log('Response Preview:', response.substring(0, 200) + '...');
            console.log('==================================');
            return response;
        } catch (error) {
            console.error('=== SPEAKER INVOCATION ERROR ===');
            console.error('Error:', error);
            console.error('================================');
            throw error;
        }
    }

    async invokeMember(memberNumber, instruction) {
        if (memberNumber < 1 || memberNumber > this.memberCount) {
            console.error(`Invalid member number: ${memberNumber}`);
            return '## Pass\nInvalid member number';
        }

        console.log(`=== INVOKING MEMBER ${memberNumber} ===`);
        console.log('Instruction:', instruction);
        console.log('==============================');

        const memberPrompt = this.prompts.member.replace('Member of Parliament', `Member ${memberNumber} of Parliament`);
        const messages = this.api.buildMemberContext(
            this.session,
            memberPrompt,
            `# Instruction\nThe Speaker recognizes you. ${instruction}`
        );

        try {
            const response = await this.api.chat(messages);
            console.log(`=== MEMBER ${memberNumber} RESPONSE RECEIVED ===`);
            console.log('Response Length:', response.length);
            console.log('Response Preview:', response.substring(0, 200) + '...');
            console.log('========================================');
            return response;
        } catch (err) {
            console.error(`=== MEMBER ${memberNumber} ERROR ===`);
            console.error('Error:', err);
            console.error('===========================');
            return '## Pass\nAPI error';
        }
    }

    async invokeMembers(instruction) {
        console.log('=== INVOKING ALL MEMBERS ===');
        console.log('Member Count:', this.memberCount);
        console.log('Instruction:', instruction);
        console.log('========================');
        
        const promises = [];

        for (let i = 0; i < this.memberCount; i++) {
            const memberNumber = i + 1;
            const memberPrompt = this.prompts.member.replace('Member of Parliament', `Member ${memberNumber} of Parliament`);
            const messages = this.api.buildMemberContext(
                this.session,
                memberPrompt,
                `# Instruction\nThe Speaker recognizes you. ${instruction}`
            );

            console.log(`=== INVOKING MEMBER ${memberNumber} ===`);
            console.log('Member System Prompt Length:', memberPrompt.length);
            console.log('Member Messages Count:', messages.length);
            console.log('==============================');

            promises.push(
                this.api.chat(messages).then(response => {
                    console.log(`=== MEMBER ${memberNumber} RESPONSE RECEIVED ===`);
                    console.log('Response Length:', response.length);
                    console.log('Response Preview:', response.substring(0, 200) + '...');
                    console.log('========================================');
                    return response;
                }).catch(err => {
                    console.error(`=== MEMBER ${memberNumber} ERROR ===`);
                    console.error('Error:', err);
                    console.error('===========================');
                    return '## Pass\nAPI error';
                })
            );
        }

        return await Promise.all(promises);
    }

    async processMemberResponse(memberResponse, memberNumber) {
        const parsed = this.api.parseResponse(memberResponse);
        const memberName = `Member ${memberNumber}`;

        if (parsed.pass) {
            const entry = this.session.addToHansard(memberName, 'Pass');
            this.ui.addHansardEntry(entry);
        } else if (parsed.vote) {
            const entry = this.session.addToHansard(memberName, `Votes: ${parsed.vote}`);
            this.ui.addHansardEntry(entry);
            this.session.recordVote(memberName, parsed.vote);
        } else {
            // Build the message: speech + action (if present)
            let message = '';
            
            if (parsed.speak) {
                message = parsed.speak;
            } else if (parsed.thought) {
                // Fallback: if no Speak section but there's a thought, use it
                message = parsed.thought;
            }
            
            // Append action to the message if present
            if (parsed.action && !parsed.action.startsWith('parliament-speak')) {
                if (message) {
                    message += '\n\n```\n' + parsed.action + '\n```';
                } else {
                    message = '```\n' + parsed.action + '\n```';
                }
            }
            
            // Record single entry with speech and action combined
            if (message) {
                const entry = this.session.addToHansard(memberName, message);
                this.ui.addHansardEntry(entry);
            }
            
            // Execute action if any
            if (parsed.action && !parsed.action.startsWith('parliament-speak')) {
                const result = this.session.executeTool(parsed.action);
                if (result.status === 'error') {
                    this.ui.addSystemMessage(`Tool error from ${memberName}: ${result.message}`);
                }
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new ParliamentApp();
});
