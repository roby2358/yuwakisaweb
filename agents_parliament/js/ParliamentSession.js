/**
 * ParliamentSession - Core state management for the Parliamentary Agent Framework
 */
import { toolTable } from './tools/table.js';
import { toolEdit } from './tools/edit.js';
import { toolOrderPaper } from './tools/orderPaper.js';
import { toolIssue } from './tools/issue.js';
import { toolAdjourn } from './tools/adjourn.js';
import { toolRecognize } from './tools/recognize.js';

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
                case 'parliament-table':
                    return toolTable(this, parts.slice(1));
                case 'parliament-edit':
                    return toolEdit(this, parts.slice(1));
                case 'parliament-order-paper':
                    return toolOrderPaper(this);
                case 'parliament-issue':
                    return toolIssue(this, parts.slice(1));
                case 'parliament-adjourn':
                    return toolAdjourn(this, parts.slice(1));
                case 'parliament-recognize':
                    return toolRecognize(this, parts.slice(1));
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

}
