/**
 * Main application controller for SMT Solver with LLM Translation
 */
import { OpenRouterAPI } from './OpenRouterAPI.js';
import { Z3Solver } from './z3solver.js';
import { SAMPLE_MEETING_SCHEDULING, SAMPLE_GRAPH_COLORING, SAMPLE_SUBSET_SUM } from './sample_problems.js';

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
            sample3: document.getElementById('sample3')
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
            3: SAMPLE_SUBSET_SUM
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
                // Explain why no solution exists
                const explanation = await this.explainUnsat(this.currentProblem, solverResult);
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
        const systemPrompt = `You are an expert in SMT-LIB (Satisfiability Modulo Theories Library) format. 
Your task is to translate natural language constraint problems into valid SMT-LIB format.

Guidelines:
- Output ONLY valid SMT-LIB code, wrapped in a code block (\`\`\`smtlib ... \`\`\`)
- Use appropriate SMT-LIB theories (Int, Real, Bool, Array, etc.)
- Declare all variables and functions
- Use (assert ...) for constraints
- Include (check-sat) at the end
- After (check-sat), include (get-model) to retrieve the solution
- Keep the problem simple - avoid complex features that might not be supported
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

    async explainUnsat(originalProblem, solverResult) {
        const systemPrompt = `You are a helpful assistant that explains why a constraint problem has no solution.
Your task is to explain in plain English why the constraints cannot be satisfied.

Guidelines:
- Explain what constraints conflict
- Be clear and helpful
- Suggest what might be wrong with the problem formulation`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { 
                role: 'user', 
                content: `Original problem:\n${originalProblem}\n\nSolver result:\n${solverResult}\n\nExplain why no solution exists.`
            }
        ];

        const response = await this.api.chat(messages, { temperature: 0.5 });
        return response.trim();
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
