/**
 * ParliamentSession - Core state management for the Parliamentary Agent Framework
 */
export class ParliamentSession {
    constructor() {
        this.state = {
            stage: 'Idle',
            currentBill: null,
            activeMotion: null,
            voting: false,
            adjourned: false
        };

        this.hansard = [];
        this.files = {};
        this.issues = [];
        this.bills = [];
        this.papers = [];
        this.amendments = [];
        this.votes = {};

        this.nextBillId = 1;
        this.nextIssueId = 1;
        this.nextAmendmentId = 1;
    }

    /**
     * Append an entry to Hansard (immutable log)
     */
    addToHansard(speaker, message, metadata = {}) {
        const entry = {
            id: `HANS-${this.hansard.length + 1}`,
            timestamp: new Date().toISOString(),
            speaker,
            message,
            ...metadata
        };
        this.hansard.push(entry);
        return entry;
    }

    /**
     * Get recent Hansard entries
     */
    getRecentHansard(count = 10) {
        return this.hansard.slice(-count);
    }

    /**
     * Execute a tool command and return Markdown output
     */
    executeTool(command) {
        const parts = command.trim().split(/\s+/);
        const tool = parts[0];

        try {
            switch (tool) {
                case 'parliament-speak':
                    return this.toolSpeak(command);
                case 'parliament-table':
                    return this.toolTable(parts.slice(1));
                case 'parliament-edit':
                    return this.toolEdit(parts.slice(1));
                case 'parliament-hansard':
                    return this.toolHansard(parts.slice(1));
                case 'parliament-order-paper':
                    return this.toolOrderPaper();
                case 'parliament-issue':
                    return this.toolIssue(parts.slice(1));
                case 'parliament-adjourn':
                    return this.toolAdjourn(parts.slice(1));
                case 'parliament-recognize':
                    return this.toolRecognize(parts.slice(1));
                default:
                    return {
                        status: 'error',
                        message: `Unknown tool: ${tool}`,
                        exitCode: 1
                    };
            }
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                exitCode: 1
            };
        }
    }

    toolSpeak(command) {
        // Extract message from command (everything after parliament-speak)
        const match = command.match(/parliament-speak\s+"([^"]*)"/);
        if (!match) {
            return { status: 'error', message: 'Invalid format', exitCode: 1 };
        }

        const message = match[1];
        const entry = this.addToHansard('Speaker', message);

        return {
            status: 'success',
            message: 'Speech recorded',
            data: {
                entry_id: entry.id,
                speaker: entry.speaker,
                timestamp: entry.timestamp
            },
            exitCode: 0
        };
    }

    toolTable(args) {
        const type = args[0];

        if (type === 'bill') {
            const filename = args[1];
            const description = args.slice(2).join(' ').replace(/"/g, '');

            const bill = {
                id: `BILL-${String(this.nextBillId++).padStart(2, '0')}`,
                type: 'bill',
                target: filename,
                description,
                stage: 'First Reading',
                created: new Date().toISOString()
            };

            this.bills.push(bill);
            this.state.currentBill = bill.id;

            return {
                status: 'success',
                message: `Bill ${bill.id} tabled`,
                data: bill,
                exitCode: 0
            };
        } else if (type === 'paper') {
            const filename = args[1];
            const description = args.slice(2).join(' ').replace(/"/g, '');

            const paper = {
                id: `PAPER-${this.papers.length + 1}`,
                filename,
                description,
                content: this.files[filename] || '[File not found]'
            };

            this.papers.push(paper);

            return {
                status: 'success',
                message: `Paper tabled: ${filename}`,
                data: paper,
                exitCode: 0
            };
        } else if (type === 'amendment') {
            const amendmentId = args[1];
            const description = args.slice(2).join(' ').replace(/"/g, '');

            const amendment = this.amendments.find(a => a.id === amendmentId);
            if (!amendment) {
                return { status: 'error', message: 'Amendment not found', exitCode: 4 };
            }

            amendment.tabled = true;
            amendment.description = description;
            this.state.activeMotion = `That Amendment ${amendmentId} be made`;

            return {
                status: 'success',
                message: `Amendment ${amendmentId} tabled`,
                data: amendment,
                exitCode: 0
            };
        }

        return { status: 'error', message: 'Invalid type', exitCode: 1 };
    }

    toolEdit(args) {
        const mode = args.find(a => a.startsWith('--'));

        if (mode === '--view') {
            const filename = args[0];
            const content = this.files[filename];
            if (!content) {
                return { status: 'error', message: 'File not found', exitCode: 4 };
            }
            return {
                status: 'success',
                message: `Viewing ${filename}`,
                data: { filename, content },
                exitCode: 0
            };
        } else if (mode === '--propose') {
            const filename = args[0];
            // Extract diff from quotes
            const diffMatch = args.join(' ').match(/"([^"]*)"/);
            const diff = diffMatch ? diffMatch[1] : '';

            const amendment = {
                id: `AMDT-${this.nextAmendmentId++}`,
                file: filename,
                diff,
                tabled: false,
                passed: false,
                created: new Date().toISOString()
            };

            this.amendments.push(amendment);

            return {
                status: 'success',
                message: `Amendment ${amendment.id} created`,
                data: amendment,
                exitCode: 0
            };
        } else if (mode === '--enact') {
            const amendmentId = args.find(a => a.startsWith('AMDT-'));
            const amendment = this.amendments.find(a => a.id === amendmentId);

            if (!amendment) {
                return { status: 'error', message: 'Amendment not found', exitCode: 4 };
            }

            if (!amendment.passed) {
                return { status: 'error', message: 'Amendment not passed', exitCode: 2 };
            }

            // Apply the diff (simple string replacement for now)
            const [from, to] = amendment.diff.split('->').map(s => s.trim());
            if (this.files[amendment.file]) {
                this.files[amendment.file] = this.files[amendment.file].replace(from, to);
            }

            return {
                status: 'success',
                message: `Amendment ${amendmentId} enacted`,
                data: { file: amendment.file },
                exitCode: 0
            };
        } else if (mode === '--view-amendment') {
            const amendmentId = args.find(a => a.startsWith('AMDT-'));
            const amendment = this.amendments.find(a => a.id === amendmentId);

            if (!amendment) {
                return { status: 'error', message: 'Amendment not found', exitCode: 4 };
            }

            return {
                status: 'success',
                message: `Viewing amendment ${amendmentId}`,
                data: amendment,
                exitCode: 0
            };
        } else if (mode === '--create') {
            const filename = args[0];
            if (!filename) {
                return { status: 'error', message: 'Filename required', exitCode: 1 };
            }

            // Extract content from quotes
            const contentMatch = args.join(' ').match(/"([^"]*)"/);
            const content = contentMatch ? contentMatch[1] : '';

            // Check if file already exists
            if (this.files[filename]) {
                return { status: 'error', message: 'File already exists. Use --propose to amend it.', exitCode: 2 };
            }

            // Create the file
            this.files[filename] = content;

            return {
                status: 'success',
                message: `File ${filename} created`,
                data: { filename, content },
                exitCode: 0
            };
        }

        return { status: 'error', message: 'Invalid mode', exitCode: 1 };
    }

    toolHansard(args) {
        const tail = args.includes('--tail') ? parseInt(args[args.indexOf('--tail') + 1]) : 10;
        const entries = this.getRecentHansard(tail);

        return {
            status: 'success',
            message: 'Hansard retrieved',
            data: { entries },
            exitCode: 0
        };
    }

    toolOrderPaper() {
        return {
            status: 'success',
            message: 'Order Paper',
            data: {
                stage: this.state.stage,
                currentBill: this.state.currentBill,
                activeMotion: this.state.activeMotion,
                voting: this.state.voting
            },
            exitCode: 0
        };
    }

    toolIssue(args) {
        const action = args[0];

        if (action === 'create') {
            const title = args[1].replace(/"/g, '');
            const description = args.slice(2).join(' ').replace(/"/g, '');

            const issue = {
                id: `ISSUE-${this.nextIssueId++}`,
                title,
                description,
                status: 'open',
                created: new Date().toISOString()
            };

            this.issues.push(issue);

            return {
                status: 'success',
                message: `Issue ${issue.id} created`,
                data: issue,
                exitCode: 0
            };
        } else if (action === 'close') {
            const issueId = args[1];
            const issue = this.issues.find(i => i.id === issueId);

            if (!issue) {
                return { status: 'error', message: 'Issue not found', exitCode: 4 };
            }

            issue.status = 'closed';
            issue.closed = new Date().toISOString();

            return {
                status: 'success',
                message: `Issue ${issueId} closed`,
                data: issue,
                exitCode: 0
            };
        } else if (action === 'list') {
            const openIssues = this.issues.filter(i => i.status === 'open');
            return {
                status: 'success',
                message: 'Open issues',
                data: { issues: openIssues },
                exitCode: 0
            };
        }

        return { status: 'error', message: 'Invalid action', exitCode: 1 };
    }

    /**
     * Record a vote
     */
    recordVote(member, decision) {
        if (!this.votes[this.state.activeMotion]) {
            this.votes[this.state.activeMotion] = { aye: 0, no: 0, abstain: 0, votes: {} };
        }

        this.votes[this.state.activeMotion].votes[member] = decision;
        this.votes[this.state.activeMotion][decision]++;
    }

    /**
     * Tally votes for current motion
     */
    tallyVotes() {
        const motion = this.state.activeMotion;
        if (!this.votes[motion]) {
            return { aye: 0, no: 0, abstain: 0, passed: false };
        }

        const tally = this.votes[motion];
        tally.passed = tally.aye > tally.no;

        return tally;
    }

    /**
     * Adjourn the House
     */
    toolAdjourn(args) {
        const reason = args.length > 0 ? args.join(' ').replace(/"/g, '') : 'Business concluded';
        
        this.state.adjourned = true;
        this.state.stage = 'Adjourned';
        
        const entry = this.addToHansard('Speaker', `The House stands adjourned. ${reason}`);
        
        return {
            status: 'success',
            message: 'House adjourned',
            data: {
                reason,
                timestamp: entry.timestamp
            },
            exitCode: 0
        };
    }

    /**
     * Recognize a member or all members for speaking
     * Usage: parliament-recognize [all|member-number] [one-line instruction]
     */
    toolRecognize(args) {
        if (args.length < 1) {
            return { status: 'error', message: 'Invalid format. Usage: parliament-recognize [all|member-number] [instruction]', exitCode: 1 };
        }

        const target = args[0].toLowerCase();
        const instruction = args.slice(1).join(' ').replace(/"/g, '');

        // Validate target
        if (target !== 'all' && !/^\d+$/.test(target)) {
            return { status: 'error', message: 'Target must be "all" or a member number', exitCode: 1 };
        }

        const memberNumber = target === 'all' ? null : parseInt(target);

        return {
            status: 'success',
            message: `Recognizing ${target === 'all' ? 'all members' : `Member ${memberNumber}`}`,
            data: {
                target: target === 'all' ? 'all' : memberNumber,
                instruction: instruction || '',
                requiresInvocation: true  // Flag for index.js to trigger LLM call
            },
            exitCode: 0
        };
    }
}
