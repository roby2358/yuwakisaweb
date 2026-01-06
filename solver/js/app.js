/**
 * Main application controller for SMT Solver with LLM Translation
 */
import { OpenRouterAPI } from './OpenRouterAPI.js';
import { Z3Solver } from './z3solver.js';
import { SAMPLE_MEETING_SCHEDULING, SAMPLE_GRAPH_COLORING, SAMPLE_MAGIC_SQUARE, SAMPLE_LATIN_SQUARE } from './sample_problems.js';

class SolverApp {
    constructor() {
        this.api = null;
        this.z3Solver = new Z3Solver();
        this.currentProblem = '';
        this.currentSmtLib = '';
        this.currentVerification = '';
        this.solverTimeout = 30000; // 30 seconds default

        this.initializeElements();
        this.initializeEventListeners();
        this.loadModelFromStorage();
    }

    initializeElements() {
        this.elements = {
            apiKeyInput: document.getElementById('apiKeyInput'),
            modelInput: document.getElementById('modelInput'),
            problemInput: document.getElementById('problemInput'),
            translateBtn: document.getElementById('translateBtn'),
            smtlibInput: document.getElementById('smtlibInput'),
            verificationOutput: document.getElementById('verificationOutput'),
            confirmBtn: document.getElementById('confirmBtn'),
            solverOutput: document.getElementById('solverOutput'),
            solutionOutput: document.getElementById('solutionOutput'),
            sample1: document.getElementById('sample1'),
            sample2: document.getElementById('sample2'),
            sample3: document.getElementById('sample3'),
            sample4: document.getElementById('sample4')
        };
    }

    initializeEventListeners() {
        this.elements.apiKeyInput.addEventListener('change', () => {
            this.saveApiKey();
        });

        this.elements.modelInput.addEventListener('change', () => {
            this.saveModel();
        });

        this.elements.translateBtn.addEventListener('click', () => {
            this.handleTranslate();
        });

        this.elements.confirmBtn.addEventListener('click', () => {
            this.handleSolve();
        });

        this.elements.smtlibInput.addEventListener('input', () => {
            this.currentSmtLib = this.elements.smtlibInput.value;
            this.updateConfirmButtonState();
        });


        // Sample problem handlers
        this.elements.sample1.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadSampleProblem(1);
        });

        this.elements.sample2.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadSampleProblem(2);
        });

        this.elements.sample3.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadSampleProblem(3);
        });

        this.elements.sample4.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadSampleProblem(4);
        });
    }

    saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        if (apiKey) {
            // Warn if key format looks wrong
            if (!apiKey.startsWith('sk-')) {
                console.warn('API key format may be incorrect. OpenRouter keys typically start with "sk-or-"');
            }
            const model = this.elements.modelInput.value || 'anthropic/claude-haiku-4.5';
            this.api = new OpenRouterAPI(apiKey, model);
            // Note: API key is kept in memory only, not persisted to storage
        }
    }

    saveModel() {
        const model = this.elements.modelInput.value.trim();
        if (model) {
            localStorage.setItem('solver_model', model);
            if (this.api) {
                this.api.model = model;
            }
        }
    }

    loadModelFromStorage() {
        // Load model
        const savedModel = localStorage.getItem('solver_model');
        if (savedModel) {
            this.elements.modelInput.value = savedModel;
        }
    }

    loadSampleProblem(index) {
        const samples = {
            1: SAMPLE_MEETING_SCHEDULING,
            2: SAMPLE_GRAPH_COLORING,
            3: SAMPLE_MAGIC_SQUARE,
            4: SAMPLE_LATIN_SQUARE
        };

        const problem = samples[index];
        if (problem) {
            this.elements.problemInput.value = problem;
        }
    }

    async handleTranslate() {
        const problem = this.elements.problemInput.value.trim();
        if (!problem) {
            this.showError(this.elements.smtlibInput, 'Please enter a problem description.');
            return;
        }

        if (!this.api) {
            this.showError(this.elements.smtlibInput, 'Please configure your OpenRouter API key.');
            return;
        }

        this.currentProblem = problem;
        this.setLoading(this.elements.translateBtn, true);
        this.clearOutputs();

        try {
            // Step 1: Translate problem to SMT-LIB
            const smtlib = await this.translateToSmtLib(problem);
            this.currentSmtLib = smtlib;
            this.elements.smtlibInput.value = smtlib;
            this.showSuccess(this.elements.smtlibInput);

            // Step 2: Back-translate for verification
            const verification = await this.verifySmtLib(smtlib);
            this.currentVerification = verification;
            this.setOutput(this.elements.verificationOutput, verification, false);
            
            this.updateConfirmButtonState();
        } catch (error) {
            console.error('Translation error:', error);
            this.showError(this.elements.smtlibInput, `Translation error: ${error.message}`);
            this.setOutput(this.elements.verificationOutput, `Error: ${error.message}`, true);
        } finally {
            this.setLoading(this.elements.translateBtn, false);
        }
    }

    async handleSolve() {
        const smtlib = this.elements.smtlibInput.value.trim();
        if (!smtlib) {
            this.showError(this.elements.solverOutput, 'Please translate a problem first.');
            return;
        }

        this.currentSmtLib = smtlib;
        this.setLoading(this.elements.confirmBtn, true);
        this.setOutput(this.elements.solverOutput, 'Solving...', false);
        this.setOutput(this.elements.solutionOutput, '', false);

        try {
            // Step 3: Solve with Z3
            const solverResult = await this.z3Solver.solve(smtlib, this.solverTimeout);
            this.setOutput(this.elements.solverOutput, solverResult, false);

            // Parse solver result
            const resultType = this.parseSolverResult(solverResult);
            
            if (resultType.status === 'sat' && this.api) {
                // Step 4: Translate solution to human-readable
                const solution = await this.translateSolution(this.currentProblem, solverResult);
                this.setOutput(this.elements.solutionOutput, solution, false);
            } else if (resultType.status === 'unsat' && this.api) {
                // Extract unsat core from solver result for precise explanation
                const unsatCore = this.extractUnsatCore(solverResult);
                // Explain why no solution exists using the unsat core
                const explanation = await this.explainUnsat(this.currentProblem, smtlib, unsatCore);
                this.setOutput(this.elements.solutionOutput, explanation, false);
            } else if (resultType.status === 'unknown' || resultType.status === 'error') {
                this.setOutput(this.elements.solutionOutput, 
                    `Cannot translate solution: Solver returned ${resultType.status}.`, true);
            }
        } catch (error) {
            console.error('Solver error:', error);
            this.setOutput(this.elements.solverOutput, `Error: ${error.message}`, true);
            this.setOutput(this.elements.solutionOutput, 
                `Cannot translate solution due to solver error.`, true);
        } finally {
            this.setLoading(this.elements.confirmBtn, false);
        }
    }

    async translateToSmtLib(problem) {
        const systemPrompt = `You are an expert in SMT-LIB2 (Satisfiability Modulo Theories Library) format. 
Your task is to translate natural language constraint problems into valid SMT-LIB2 format.

Guidelines:
- Output ONLY valid SMT-LIB2 code, wrapped in a code block (\`\`\`smtlib ... \`\`\`)
- Start with (set-option :produce-unsat-cores true) to enable unsat core extraction
- Use appropriate SMT-LIB2 theories (Int, Real, Bool, Array, etc.)
- Declare all variables and functions
- Use NAMED assertions for all constraints using the :named annotation syntax:
  (assert (! <constraint> :named <descriptive-name>))
  Example: (assert (! (> x 0) :named x-is-positive))
  Example: (assert (! (distinct a b c) :named all-different))
- Use descriptive kebab-case names that explain what each constraint enforces
- IMPORTANT: :named symbols MUST start with a letter, NOT a digit. Use "constraint-70-linkedin" not "70-linkedin"
- End with (check-sat) - do NOT include (get-model) or (get-unsat-core), they are added automatically
- Keep the problem simple - avoid complex features that might not be supported

CRITICAL - SMT-LIB2 SYNTAX RULES:
- There is NO "member" function in SMT-LIB2. For set membership, use explicit disjunction:
  WRONG: (member x (1 2 3 4))
  CORRECT: (or (= x 1) (= x 2) (= x 3) (= x 4))
- Use only standard SMT-LIB2 functions. When unsure, use basic logic (and, or, not, =, <, >, +, -, *, distinct)

- Do not include explanations or comments outside the code block
- Focus on creating satisfiable constraints that solve the user's problem`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Translate this problem to SMT-LIB format:\n\n${problem}` }
        ];

        const response = await this.api.chat(messages, { temperature: 0.3 });
        return this.extractSmtLibCode(response);
    }

    async verifySmtLib(smtlib) {
        const systemPrompt = `You are a helpful assistant that explains SMT-LIB constraints in plain English.
Your task is to translate SMT-LIB code back into a clear, natural language description of what the constraints represent.

Guidelines:
- Explain what variables represent
- Describe the constraints in plain English
- Make it clear what problem is being solved
- Be concise but complete`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Explain what this SMT-LIB code represents:\n\n\`\`\`smtlib\n${smtlib}\n\`\`\`` }
        ];

        const response = await this.api.chat(messages, { temperature: 0.5 });
        return response.trim();
    }

    async translateSolution(originalProblem, solverResult) {
        const systemPrompt = `You are a helpful assistant that translates SMT solver output back to the original problem domain.
Your task is to take the original problem description and the solver's solution, and present the answer in a clear, human-readable format.

Guidelines:
- Reference the original problem
- Present the solution values in a clear format
- Use natural language
- Be direct and helpful`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { 
                role: 'user', 
                content: `Original problem:\n${originalProblem}\n\nSolver result:\n${solverResult}\n\nTranslate this solution back to answer the original problem.`
            }
        ];

        const response = await this.api.chat(messages, { temperature: 0.5 });
        return response.trim();
    }

    async explainUnsat(originalProblem, smtlib, unsatCore) {
        const systemPrompt = `You are a helpful assistant that explains why a constraint problem has no solution.
Your task is to explain in plain English why the constraints cannot be satisfied.

Guidelines:
- Focus on the UNSAT CORE - these are the specific constraints that conflict with each other
- The unsat core contains the :named labels of the minimal conflicting constraint subset
- Cross-reference the named constraints with the SMT-LIB code to explain what each constraint means
- Explain clearly why these specific constraints cannot all be true simultaneously
- Be precise and mathematically rigorous in your explanation
- Suggest what constraint(s) might need to be relaxed or removed`;

        let userContent = `Original problem:\n${originalProblem}\n\nSMT-LIB code:\n\`\`\`smtlib\n${smtlib}\n\`\`\`\n\n`;
        
        if (unsatCore && unsatCore.length > 0) {
            userContent += `UNSAT CORE (minimal conflicting constraints):\n${unsatCore.join('\n')}\n\n`;
            userContent += `Explain why these specific constraints conflict and make the problem unsatisfiable.`;
        } else {
            userContent += `The solver returned unsat but no core was extracted. Explain why no solution might exist based on the constraints.`;
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];

        const response = await this.api.chat(messages, { temperature: 0.5 });
        return response.trim();
    }

    /**
     * Extract unsat core names from solver output
     * The unsat core is returned as a list of :named assertion labels
     * @param {string} solverResult - Raw solver output
     * @returns {string[]} Array of constraint names from the unsat core
     */
    extractUnsatCore(solverResult) {
        // Look for unsat core output pattern: (name1 name2 name3) after unsat
        // Z3 outputs the core as a space-separated list in parentheses
        const coreMatch = solverResult.match(/unsat[\s\S]*?\(([^()]*)\)\s*$/m);
        if (coreMatch) {
            const coreContent = coreMatch[1].trim();
            if (coreContent) {
                return coreContent.split(/\s+/).filter(name => name.length > 0);
            }
        }
        
        // Alternative pattern: look for any parenthesized list after "unsat"
        const lines = solverResult.split('\n');
        let foundUnsat = false;
        for (const line of lines) {
            if (line.trim() === 'unsat') {
                foundUnsat = true;
                continue;
            }
            if (foundUnsat) {
                const match = line.match(/^\s*\(([^()]+)\)\s*$/);
                if (match) {
                    const names = match[1].trim().split(/\s+/).filter(n => n.length > 0);
                    if (names.length > 0) {
                        return names;
                    }
                }
            }
        }
        
        return [];
    }

    extractSmtLibCode(response) {
        // Try to extract SMT-LIB code from markdown code block
        const codeBlockMatch = response.match(/```(?:smtlib)?\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        // If no code block, assume the whole response is SMT-LIB
        return response.trim();
    }

    parseSolverResult(result) {
        const resultLower = result.toLowerCase();
        if (resultLower.includes('sat') && !resultLower.includes('unsat')) {
            return { status: 'sat' };
        } else if (resultLower.includes('unsat')) {
            return { status: 'unsat' };
        } else if (resultLower.includes('unknown')) {
            return { status: 'unknown' };
        } else {
            return { status: 'error' };
        }
    }

    updateConfirmButtonState() {
        const hasSmtLib = this.elements.smtlibInput.value.trim().length > 0;
        // Allow solving if there's SMT-LIB, even without verification
        // This enables manual testing with pasted SMT-LIB
        this.elements.confirmBtn.disabled = !hasSmtLib;
    }

    setLoading(button, isLoading) {
        button.disabled = isLoading;
        if (isLoading) {
            const originalText = button.textContent;
            button.dataset.originalText = originalText;
            button.innerHTML = originalText + '<span class="loading"></span>';
        } else {
            const originalText = button.dataset.originalText || '';
            button.textContent = originalText;
            delete button.dataset.originalText;
        }
    }

    setOutput(element, text, isError) {
        element.textContent = text;
        element.classList.remove('empty', 'error', 'success');
        if (!text) {
            element.classList.add('empty');
        } else if (isError) {
            element.classList.add('error');
        }
    }

    showError(element, message) {
        element.classList.add('error');
        if (element instanceof HTMLTextAreaElement) {
            element.style.borderColor = '#fcc';
            setTimeout(() => {
                element.style.borderColor = '';
                element.classList.remove('error');
            }, 3000);
        }
        console.error(message);
    }

    showSuccess(element) {
        element.style.borderColor = '#cfc';
        setTimeout(() => {
            element.style.borderColor = '';
        }, 2000);
    }

    clearOutputs() {
        this.setOutput(this.elements.verificationOutput, '', false);
        this.setOutput(this.elements.solverOutput, '', false);
        this.setOutput(this.elements.solutionOutput, '', false);
        this.currentVerification = '';
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SolverApp();
    });
} else {
    new SolverApp();
}
