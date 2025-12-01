import { ParliamentSession } from './js/ParliamentSession.js';
import { OpenRouterAPI } from './js/OpenRouterAPI.js';
import { UIManager } from './js/UIManager.js';
import { Interpreter } from './js/interpreter.js';
import { KeyManager } from './js/key.js';

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
        this.keyManager = new KeyManager();
        this.maxTurns = 200; // Safety limit, can be doubled on restart

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
        const apiKeyLoaded = this.keyManager.restoreFromStorage(this.ui.elements.apiKey);

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
# Speak
[Your statement to the House]
## Action
\`parliament-recognize all "instruction"\``;

            this.prompts.member = `# Role: Member of Parliament
You are a Member of Parliament. Follow the parliamentary process.
Respond with:
## Thought
[Your reasoning]
# Speak
[Your speech to the House. Everything you write here goes into the Hansard.]
## Action
**Priority**: 5
\`[command if needed]\``;
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
        const apiKey = this.keyManager.validateAndSet(inputKey);
        
        if (!apiKey) {
            alert('Please enter your OpenRouter API key');
            return;
        }

        // Clear from DOM for security
        this.ui.clearApiKey();

        // Save to sessionStorage for this session
        this.keyManager.saveToStorage();

        // Get selected model ID
        const modelId = this.ui.getModelId();
        
        this.api = new OpenRouterAPI(apiKey, modelId);
        this.interpreter = new Interpreter(this.session, this.api, this.ui);
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

    pause() {
        this.isRunning = false;
        this.ui.setLoading(false);
        this.ui.addSystemMessage('Session paused.');
    }

    /**
     * Clear API key from memory (for security)
     */
    clearApiKey() {
        this.keyManager.clear();
        this.api = null;
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
            
            // Process speaker response using interpreter
            const result = await this.interpreter.processSpeakerResponse(
                speakerResponse,
                (instruction) => this.invokeMembers(instruction),
                (memberNumber, instruction) => this.invokeMember(memberNumber, instruction),
                this.memberCount
            );

            if (result.adjourned) {
                break;
            }

            await this.sleep(1000);

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


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new ParliamentApp();
});
