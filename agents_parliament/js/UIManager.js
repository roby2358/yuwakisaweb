/**
 * UIManager - Handles all DOM updates and user interactions
 */
export class UIManager {
    constructor() {
        this.elements = {
            userInput: document.getElementById('userInput'),
            apiKey: document.getElementById('apiKey'),
            startBtn: document.getElementById('startBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            clearHansard: document.getElementById('clearHansard'),
            currentStage: document.getElementById('currentStage'),
            currentBill: document.getElementById('currentBill'),
            currentMotion: document.getElementById('currentMotion'),
            votingStatus: document.getElementById('votingStatus'),
            fileList: document.getElementById('fileList'),
            issueList: document.getElementById('issueList'),
            hansard: document.getElementById('hansard')
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.elements.clearHansard.addEventListener('click', () => {
            this.elements.hansard.innerHTML = '';
        });
    }

    /**
     * Update session status display
     */
    updateStatus(session) {
        const stage = session.state.adjourned ? 'Adjourned' : session.state.stage;
        this.elements.currentStage.textContent = stage;
        this.elements.currentBill.textContent = session.state.currentBill || 'None';
        this.elements.currentMotion.textContent = session.state.activeMotion || 'None';
        this.elements.votingStatus.textContent = session.state.voting ? 'Yes' : 'No';
    }

    /**
     * Update files display
     */
    updateFiles(session) {
        this.elements.fileList.innerHTML = '';

        for (const [filename, content] of Object.entries(session.files)) {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-name">${filename}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    ${content.split('\n').length} lines
                </div>
            `;
            fileItem.addEventListener('click', () => this.showFileModal(filename, content));
            this.elements.fileList.appendChild(fileItem);
        }
    }

    /**
     * Update issues display
     */
    updateIssues(session) {
        this.elements.issueList.innerHTML = '';

        const openIssues = session.issues.filter(i => i.status === 'open');

        if (openIssues.length === 0) {
            this.elements.issueList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">No open issues</div>';
            return;
        }

        for (const issue of openIssues) {
            const issueItem = document.createElement('div');
            issueItem.className = 'issue-item';
            issueItem.innerHTML = `
                <div class="issue-title">${issue.id}: ${issue.title}</div>
                <div class="issue-status">${issue.description}</div>
            `;
            this.elements.issueList.appendChild(issueItem);
        }
    }

    /**
     * Add entry to Hansard display
     */
    addHansardEntry(entry) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'hansard-entry';

        // Determine role class
        if (entry.speaker === 'Speaker') {
            entryDiv.classList.add('speaker');
        } else if (entry.speaker.startsWith('Member')) {
            entryDiv.classList.add('member');
        } else {
            entryDiv.classList.add('system');
        }

        const time = new Date(entry.timestamp).toLocaleTimeString();

        let html = `
            <div class="hansard-meta">
                <span class="hansard-speaker ${entry.speaker === 'Speaker' ? 'speaker-role' : 'member-role'}">
                    ${entry.speaker}
                </span>
                <span class="hansard-time">${time}</span>
            </div>
            <div class="hansard-message">${this.escapeHtml(entry.message)}</div>
        `;

        // Add command if present
        if (entry.command) {
            html += `<div class="hansard-command">${this.escapeHtml(entry.command)}</div>`;
        }

        entryDiv.innerHTML = html;
        this.elements.hansard.appendChild(entryDiv);

        // Auto-scroll to bottom
        this.elements.hansard.scrollTop = this.elements.hansard.scrollHeight;
    }

    /**
     * Show file content in a modal/alert
     */
    showFileModal(filename, content) {
        alert(`${filename}:\n\n${content}`);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update all displays
     */
    updateAll(session) {
        this.updateStatus(session);
        this.updateFiles(session);
        this.updateIssues(session);
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.elements.startBtn.disabled = isLoading;
        this.elements.pauseBtn.disabled = !isLoading;
    }

    /**
     * Get API key from input field
     */
    getApiKey() {
        return this.elements.apiKey.value.trim();
    }

    /**
     * Clear API key from input field (for security)
     */
    clearApiKey() {
        this.elements.apiKey.value = '';
    }

    /**
     * Get user input
     */
    getUserInput() {
        return this.elements.userInput.value.trim();
    }

    /**
     * Add system message to Hansard
     */
    addSystemMessage(message) {
        const entry = {
            id: `SYS-${Date.now()}`,
            timestamp: new Date().toISOString(),
            speaker: 'System',
            message
        };
        this.addHansardEntry(entry);
    }
}
