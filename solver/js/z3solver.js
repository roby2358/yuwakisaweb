/**
 * Z3Solver - Wrapper for Z3 WASM SMT solver
 * Uses the official z3-solver npm package
 * 
 * Note: z3-built.js must be loaded via script tag before this module.
 * It sets up globalThis.initZ3 which is used by the z3-solver package.
 */

// Import the z3-solver browser initialization
import { init as initZ3Solver } from 'z3-solver/build/browser.js';

export class Z3Solver {
    constructor() {
        this.z3 = null;  // Z3 low-level API wrapper
        this.context = null;
        this.initPromise = null;
    }

    /**
     * Initialize Z3 - must be called before solving
     */
    async _initZ3() {
        if (this.z3) {
            return;
        }

        if (this.initPromise) {
            await this.initPromise;
            return;
        }

        this.initPromise = this._doInit();
        await this.initPromise;
    }

    async _doInit() {
        // Wait for initZ3 to be available (set by z3-built.js)
        let attempts = 0;
        const maxAttempts = 100;
        
        while (typeof globalThis.initZ3 === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (typeof globalThis.initZ3 === 'undefined') {
            throw new Error(
                'Z3 initialization failed: initZ3 not found. ' +
                'Make sure z3-built.js is loaded before app.js'
            );
        }

        try {
            // Use the z3-solver package's init to get properly wrapped API
            console.log('Initializing Z3...');
            const { Z3 } = await initZ3Solver();
            
            this.z3 = Z3;
            
            // Create a config and context for solving
            const config = this.z3.mk_config();
            this.context = this.z3.mk_context(config);
            this.z3.del_config(config);
            
            console.log('Z3 initialized successfully');
        } catch (error) {
            const errorMsg = error && error.message ? error.message : String(error);
            throw new Error(`Z3 initialization failed: ${errorMsg}`);
        }
    }

    /**
     * Clean SMT-LIB input for best compatibility
     * @param {string} smtlib - Raw SMT-LIB input
     * @returns {string} Cleaned SMT-LIB
     */
    _cleanSmtLib(smtlib) {
        const lines = smtlib.split('\n');
        const cleanedLines = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines
            if (trimmed === '') {
                continue;
            }
            
            // Skip comment-only lines
            if (trimmed.startsWith(';')) {
                continue;
            }
            
            // Remove inline comments (everything after ;)
            const commentIndex = line.indexOf(';');
            if (commentIndex > 0) {
                cleanedLines.push(line.substring(0, commentIndex).trimEnd());
            } else {
                cleanedLines.push(line);
            }
        }
        
        return cleanedLines.join('\n');
    }

    /**
     * Solve SMT-LIB input
     * @param {string} smtlib - SMT-LIB formatted string
     * @param {number} timeout - Timeout in milliseconds (unused for now)
     * @returns {Promise<string>} Solver output (sat/unsat + model)
     */
    async solve(smtlib, timeout = 30000) {
        if (!smtlib || smtlib.trim() === '') {
            throw new Error('SMT-LIB input is empty');
        }

        // Initialize Z3 if needed
        await this._initZ3();

        // Clean the SMT-LIB for compatibility
        const cleanedSmtlib = this._cleanSmtLib(smtlib);
        
        // Prepend (reset) to ensure clean state between solve calls
        const resetSmtlib = '(reset)\n' + cleanedSmtlib;
        console.log('Cleaned SMT-LIB:\n', resetSmtlib);

        try {
            // Use the wrapped eval_smtlib2_string which handles async execution properly
            const result = await this.z3.eval_smtlib2_string(this.context, resetSmtlib);
            
            if (typeof result === 'string') {
                return result;
            } else if (result !== null && result !== undefined) {
                return String(result);
            } else {
                return '(no result returned)';
            }
        } catch (error) {
            const errorMsg = error && error.message ? error.message : String(error);
            
            // Provide more helpful error message
            if (errorMsg.includes('memory access out of bounds')) {
                throw new Error(
                    'Z3 crashed with memory access error. This usually means:\n' +
                    '1. The SMT-LIB input has syntax errors\n' +
                    '2. The SMT-LIB uses features not supported by this Z3 build\n' +
                    '3. The input is too complex for the WASM build\n\n' +
                    'Try editing the SMT-LIB manually or using a simpler problem.'
                );
            }
            
            throw new Error(`Solver error: ${errorMsg}`);
        }
    }

    /**
     * Check if Z3 is loaded
     */
    isLoaded() {
        return this.z3 !== null && this.context !== null;
    }
}
