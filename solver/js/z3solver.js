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
            // Context will be created fresh for each solve call
            
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
     * Strip (get-model) and (get-unsat-core) from SMT-LIB
     * These will be added conditionally based on check-sat result
     * @param {string} smtlib - SMT-LIB input
     * @returns {string} SMT-LIB without get-model/get-unsat-core
     */
    _stripGetCommands(smtlib) {
        return smtlib
            .replace(/\(get-model\)/g, '')
            .replace(/\(get-unsat-core\)/g, '');
    }

    /**
     * Parse check-sat result from solver output
     * @param {string} result - Solver output
     * @returns {'sat'|'unsat'|'unknown'} The satisfiability result
     */
    _parseCheckSat(result) {
        const trimmed = result.trim().toLowerCase();
        if (trimmed === 'sat' || trimmed.startsWith('sat\n') || trimmed.endsWith('\nsat')) {
            return 'sat';
        }
        if (trimmed === 'unsat' || trimmed.startsWith('unsat\n') || trimmed.endsWith('\nunsat')) {
            return 'unsat';
        }
        if (trimmed.includes('unsat')) {
            return 'unsat';
        }
        if (trimmed.includes('sat')) {
            return 'sat';
        }
        return 'unknown';
    }

    /**
     * Create a fresh context for solving
     * This ensures no state leaks between solve calls
     */
    _createFreshContext() {
        // Delete old context if it exists
        if (this.context) {
            this.z3.del_context(this.context);
            this.context = null;
        }
        
        const config = this.z3.mk_config();
        this.context = this.z3.mk_context(config);
        this.z3.del_config(config);
    }

    /**
     * Solve SMT-LIB input with two-phase approach:
     * 1. Run constraints + check-sat to get sat/unsat
     * 2. Based on result, run (get-model) or (get-unsat-core) on same context
     * 
     * @param {string} smtlib - SMT-LIB formatted string
     * @param {number} timeout - Timeout in milliseconds (unused for now)
     * @returns {Promise<string>} Solver output (sat/unsat + model or unsat core)
     */
    async solve(smtlib, timeout = 30000) {
        if (!smtlib || smtlib.trim() === '') {
            throw new Error('SMT-LIB input is empty');
        }

        // Initialize Z3 if needed
        await this._initZ3();

        // Create a fresh context for each solve to avoid state leaks
        this._createFreshContext();

        // Clean and strip get- commands (we'll add them conditionally)
        const cleanedSmtlib = this._cleanSmtLib(smtlib);
        const baseSmtlib = this._stripGetCommands(cleanedSmtlib);
        console.log('Base SMT-LIB (without get- commands):\n', baseSmtlib);

        try {
            // Phase 1: Run constraints + check-sat
            const checkSatResult = await this.z3.eval_smtlib2_string(this.context, baseSmtlib);
            const checkSatStr = typeof checkSatResult === 'string' ? checkSatResult : String(checkSatResult || '');
            console.log('check-sat result:', checkSatStr);

            const satStatus = this._parseCheckSat(checkSatStr);
            
            // Phase 2: Based on result, get model or unsat core (on same context)
            let followupResult = '';
            if (satStatus === 'sat') {
                followupResult = await this.z3.eval_smtlib2_string(this.context, '(get-model)');
            } else if (satStatus === 'unsat') {
                followupResult = await this.z3.eval_smtlib2_string(this.context, '(get-unsat-core)');
            }
            
            const followupStr = typeof followupResult === 'string' ? followupResult : String(followupResult || '');
            
            // Combine results
            const combinedResult = checkSatStr.trim() + '\n' + followupStr.trim();
            return combinedResult.trim();
            
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
        return this.z3 !== null;
    }
}
