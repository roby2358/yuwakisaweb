/**
 * ParliamentSession - Core state management for the Parliamentary Agent Framework
 */
import { toolTable } from './tools/table.js';
import { toolShare } from './tools/share.js';
import { toolEdit } from './tools/edit.js';
import { toolIssue } from './tools/issue.js';
import { toolAdjourn } from './tools/adjourn.js';
import { toolRecognize } from './tools/recognize.js';
import { CommandParser } from './CommandParser.js';

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
        
        this.parser = new CommandParser();
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
     * Normalize command by removing formatting prefixes
     * Removes leading whitespace, "bash" prefix, and "-" prefix
     * @param {string} command - The raw command string
     * @returns {string} - The normalized command
     */
    normalizeCommand(command) {
        if (!command) return command;
        
        // Remove leading whitespace, optional "bash" (case-insensitive) with whitespace, and optional "-" with whitespace
        // Matches patterns like: "  bash - parliament-edit", "bash parliament-edit", "- parliament-edit", "  -  bash ...", etc.
        return command.replace(/^\s*(bash\s+)?-?\s*/i, '');
    }

    /**
     * Parse command string using LALR parser
     * Returns array of arguments with quoted strings preserved
     */
    parseCommand(command) {
        return this.parser.parse(command);
    }

    /**
     * Execute a tool command and return Markdown output
     */
    executeTool(command) {
        // Normalize command before parsing (remove formatting prefixes)
        const normalized = this.normalizeCommand(command);
        const parts = this.parseCommand(normalized);
        const tool = parts[0];

        try {
            switch (tool) {
                case 'parliament-table':
                    return toolTable(this, parts.slice(1));
                case 'parliament-share':
                    return toolShare(this, parts.slice(1));
                case 'parliament-edit':
                    return toolEdit(this, parts.slice(1));
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
