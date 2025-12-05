import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Code, Terminal, FileText } from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * MARKDOWNISALISP TYPES
 * ------------------------------------------------------------------
 */

type NodeType = 'PROGRAM' | 'DEF' | 'EXPRESSION' | 'LITERAL' | 'SYMBOL';

interface ASTNode {
  type: NodeType;
  value?: any;
  children: ASTNode[];
  indent?: number; // Used during parsing
}

interface Env {
  parent: Env | null;
  vars: Record<string, any>;
}

/**
 * ------------------------------------------------------------------
 * PARSER
 * ------------------------------------------------------------------
 */

// Helper to calculate indentation level (2 spaces or 1 tab = 1 level)
const getIndentLevel = (line: string): number => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const whitespace = match[1];
  // Normalize: 1 tab = 2 spaces
  const spaces = whitespace.replace(/\t/g, '  ').length;
  return Math.floor(spaces / 2);
};

// Strip surrounding quotes from a string if present
const stripQuotes = (val: string): string => {
  if ((val.startsWith('"') && val.endsWith('"')) || 
      (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
};

// Parse a string as a numeric literal, returning null if not numeric
const parseNumericLiteral = (val: string): number | null => {
  const trimmedVal = val.trim();
  const num = Number(trimmedVal);
  const isNumeric = !isNaN(num) && isFinite(num) && trimmedVal === String(num);
  return isNumeric ? num : null;
};

// Check if a value is truthy in the LISP sense
const isTruthy = (value: any): boolean => {
  return value !== false && value !== null && value !== 0;
};

// Extract operator name from raw operator value
const extractOperatorName = (opRaw: any): string => {
  if (typeof opRaw === 'object' && opRaw.type === 'SYMBOL') {
    return opRaw.name;
  }
  if (typeof opRaw === 'string') {
    return opRaw;
  }
  return '';
};

// Find the parent node in the stack for a given indent level
const findParentNode = (stack: ASTNode[], indent: number): ASTNode | null => {
  while (stack.length > 0 && (stack[stack.length - 1].indent ?? -1) >= indent) {
    stack.pop();
  }
  return stack.length > 0 ? stack[stack.length - 1] : null;
};

// Parse a header line into a definition node
const parseHeader = (line: string): ASTNode => {
  const defName = line.replace(/^#+\s*/, '').trim();
  return {
    type: 'DEF',
    value: defName,
    children: []
  };
};

// Parse a list item into an AST node
const parseListItem = (line: string, indent: number): ASTNode => {
  const content = line.replace(/^[-*]\s+/, '');
  const parsed = parseContent(content);
  return {
    ...parsed,
    type: parsed.type,
    indent: indent,
    children: []
  };
};

// Add a node to the appropriate parent in the hierarchy
const addNodeToHierarchy = (
  node: ASTNode,
  stack: ASTNode[],
  currentDef: ASTNode | null
): void => {
  const parent = findParentNode(stack, node.indent ?? -1);
  if (parent) {
    parent.children.push(node);
  } else if (currentDef) {
    currentDef.children.push(node);
  }
  stack.push(node);
};

// Parse a literal value from backtick-wrapped text
const parseLiteral = (text: string): ASTNode | null => {
  const literalMatch = text.match(/^`([^`]+)`$/);
  if (!literalMatch) {
    return null;
  }
  
  let val = literalMatch[1];
  val = stripQuotes(val);
  const num = parseNumericLiteral(val);
  
  return {
    type: 'LITERAL',
    value: num !== null ? num : val,
    children: []
  };
};

// Parse a symbol from text
const parseSymbol = (text: string): ASTNode => {
  return {
    type: 'SYMBOL',
    value: text,
    children: []
  };
};

// Helper to parse content: "`10`" -> literal 10, "add" -> symbol "add"
const parseContent = (text: string): ASTNode => {
  text = text.trim();
  // Remove list markers if present at start of content parsing
  text = text.replace(/^[-*]\s+/, '');

  const literal = parseLiteral(text);
  if (literal) {
    return literal;
  }

  return parseSymbol(text);
};

// Check if a line is a header
const isHeader = (line: string): boolean => {
  return line.trim().startsWith('#');
};

// Check if a line is a list item
const isListItem = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('-') || trimmed.startsWith('*');
};

// Filter out empty lines
const filterNonEmptyLines = (lines: string[]): string[] => {
  return lines.filter(l => l.trim().length > 0);
};

const parseMarkdown = (input: string): ASTNode => {
  const lines = filterNonEmptyLines(input.split('\n'));
  const root: ASTNode = { type: 'PROGRAM', children: [] };

  let currentDef: ASTNode | null = null;
  let stack: ASTNode[] = [];

  for (let line of lines) {
    const trimLine = line.trim();

    // Handle Headers (Definitions)
    if (isHeader(trimLine)) {
      currentDef = parseHeader(trimLine);
      root.children.push(currentDef);
      stack = []; // Reset stack for new definition body
      continue;
    }

    // Handle List Items (Expressions)
    if (currentDef && isListItem(trimLine)) {
      const indent = getIndentLevel(line);
      const node = parseListItem(trimLine, indent);
      addNodeToHierarchy(node, stack, currentDef);
    }
  }

  return root;
};

/**
 * ------------------------------------------------------------------
 * INTERPRETER
 * ------------------------------------------------------------------
 */

const createEnv = (parent: Env | null = null): Env => ({
  parent,
  vars: {},
});

const getVar = (env: Env, name: string): any => {
  if (name in env.vars) return env.vars[name];
  if (env.parent) return getVar(env.parent, name);
  throw new Error(`Undefined symbol: ${name}`);
};

const setVar = (env: Env, name: string, val: any) => {
  env.vars[name] = val;
};

// Transform a literal node to its value
const transformLiteral = (node: ASTNode): any => {
  return node.value;
};

// Transform a function call node to array form
const transformFunctionCall = (node: ASTNode): any[] => {
  return [node.value, ...node.children.map(transformNode)];
};

// Transform a symbol node to symbol reference
const transformSymbol = (node: ASTNode): any => {
  return { type: 'SYMBOL', name: node.value };
};

// Convert AST node back to Lisp-like structure for internal evaluation
const transformNode = (node: ASTNode): any => {
  // If it's a LITERAL with no children, return raw value
  if (node.type === 'LITERAL' && node.children.length === 0) {
    return transformLiteral(node);
  }

  // If it has children, it's a function call/expression: (func arg1 arg2 ...)
  if (node.children.length > 0) {
    return transformFunctionCall(node);
  }

  // If it's a SYMBOL with no children, it's a variable reference
  if (node.type === 'SYMBOL') {
    return transformSymbol(node);
  }

  // If it's an EXPRESSION with no children, it was originally a SYMBOL
  if (node.type === 'EXPRESSION') {
    return transformSymbol(node);
  }

  // Fallback: return the value if it's a primitive
  if (typeof node.value === 'string' || typeof node.value === 'number') {
    return node.value;
  }

  // If we get here, something is wrong with the AST structure
  throw new Error(`Unexpected node type in transformNode: ${node.type} with value: ${JSON.stringify(node.value)}`);
};

// Bind a single lambda parameter
const bindSingleParameter = (param: any, arg: any, localEnv: Env): void => {
  if (param && param.type === 'SYMBOL') {
    setVar(localEnv, param.name, arg);
  }
};

// Bind multiple lambda parameters
const bindMultipleParameters = (params: any[], args: any[], localEnv: Env): void => {
  params.forEach((param, idx) => {
    bindSingleParameter(param, args[idx], localEnv);
  });
};

// Bind lambda parameters to arguments in local environment
const bindLambdaParameters = (paramsRaw: any, args: any[], localEnv: Env): void => {
  if (paramsRaw && paramsRaw.type === 'SYMBOL') {
    bindSingleParameter(paramsRaw, args[0], localEnv);
  } else if (Array.isArray(paramsRaw)) {
    bindMultipleParameters(paramsRaw, args, localEnv);
  }
};

// Evaluate an if expression
const evaluateIf = (x: any[], env: Env): any => {
  const test = evaluate(x[1], env);
  if (isTruthy(test)) {
    return evaluate(x[2], env);
  } else {
    return x[3] ? evaluate(x[3], env) : null;
  }
};

// Evaluate a lambda expression
const evaluateLambda = (x: any[], env: Env): Function => {
  // Convention: First child of lambda is params, second is body.
  const paramsRaw = x[1];
  const bodyRaw = x[2];

  return (...args: any[]) => {
    const localEnv = createEnv(env);
    bindLambdaParameters(paramsRaw, args, localEnv);
    return evaluate(bodyRaw, localEnv);
  };
};

// Evaluate special forms (if, lambda, etc.)
const evaluateSpecialForm = (opName: string, x: any[], env: Env): any | null => {
  if (opName === 'if') {
    return evaluateIf(x, env);
  }

  if (opName === 'lambda') {
    return evaluateLambda(x, env);
  }

  return null; // Not a special form
};

// Apply a function with evaluated arguments
const applyFunction = (proc: any, x: any[], env: Env): any => {
  if (typeof proc !== 'function') {
    throw new Error(`Attempt to call non-function: ${JSON.stringify(x[0])}`);
  }
  const args = x.slice(1).map((arg: any) => evaluate(arg, env));
  return proc(...args);
};

// Check if value is a literal (number or string)
const isLiteral = (x: any): boolean => {
  return typeof x === 'number' || typeof x === 'string';
};

// Check if value is a symbol reference
const isSymbolReference = (x: any): boolean => {
  return x && x.type === 'SYMBOL';
};

// Resolve a function/procedure from the first element of a list
const resolveProcedure = (first: any, env: Env): any => {
  if (typeof first === 'string') {
    return getVar(env, first);
  } else {
    return evaluate(first, env);
  }
};

const evaluate = (x: any, env: Env): any => {
  // 1. Literal
  if (isLiteral(x)) {
    return x;
  }

  // 2. Symbol Reference
  if (isSymbolReference(x)) {
    return getVar(env, x.name);
  }

  // 3. List / Function Call
  if (Array.isArray(x)) {
    if (x.length === 0) return null;

    const opName = extractOperatorName(x[0]);
    
    // Check for special forms first
    const specialResult = evaluateSpecialForm(opName, x, env);
    if (specialResult !== null) {
      return specialResult;
    }

    // Regular function application
    const proc = resolveProcedure(x[0], env);
    return applyFunction(proc, x, env);
  }

  return x;
};

/**
 * ------------------------------------------------------------------
 * RUNNER
 * ------------------------------------------------------------------
 */

// Setup standard library functions in the global environment
const setupStandardLibrary = (env: Env, logFn: (s: string) => void): void => {
  setVar(env, '+', (a:any, b:any) => a + b);
  setVar(env, '-', (a:any, b:any) => a - b);
  setVar(env, '*', (a:any, b:any) => a * b);
  setVar(env, '/', (a:any, b:any) => a / b);
  setVar(env, '<=', (a:any, b:any) => a <= b);
  setVar(env, '>=', (a:any, b:any) => a >= b);
  setVar(env, '<', (a:any, b:any) => a < b);
  setVar(env, '>', (a:any, b:any) => a > b);
  setVar(env, '!=', (a:any, b:any) => a !== b);
  setVar(env, 'eq', (a:any, b:any) => a === b);
  setVar(env, 'and', (a:any, b:any) => a && b);
  setVar(env, 'or', (a:any, b:any) => a || b);
  setVar(env, 'not', (a:any) => !a);
  setVar(env, 'cons', (a:any, b:any) => [a, b]);
  setVar(env, 'car', (pair:any) => {
    if (!Array.isArray(pair) || pair.length === 0) {
      throw new Error('car: expected a cons cell');
    }
    return pair[0];
  });
  setVar(env, 'cdr', (pair:any) => {
    if (!Array.isArray(pair) || pair.length === 0) {
      throw new Error('cdr: expected a cons cell');
    }
    return pair.length > 1 ? pair[1] : null;
  });
  setVar(env, 'print', (...args:any) => {
    const out = args.join(' ');
    logFn(out);
    return out;
  });
};

// Register all definitions from AST into the environment
const registerDefinitions = (ast: ASTNode, env: Env): void => {
  ast.children.forEach(defNode => {
    if (defNode.type === 'DEF') {
      const name = defNode.value;
      if (defNode.children.length > 0) {
        // Always treat definitions as lambda functions
        // If 2+ children: first is parameter(s), second is body
        // If 1 child: no parameters, that child is the body
        const paramsRaw = defNode.children.length >= 2 
          ? transformNode(defNode.children[0])
          : null; // No parameters for single-child definitions
        const bodyRaw = transformNode(defNode.children[defNode.children.length >= 2 ? 1 : 0]);
        
        // Create lambda expression: ['lambda', params, body]
        const lambdaExpr = ['lambda', paramsRaw, bodyRaw];
        const val = evaluate(lambdaExpr, env);
        setVar(env, name, val);
      }
    }
  });
};

// Check if error is "main not found" error
const isMainNotFoundError = (e: any): boolean => {
  return e.message && e.message.includes('Undefined symbol: main');
};

// Execute the main function if it exists
const executeMain = (env: Env, logFn: (s: string) => void): void => {
  try {
    const main = getVar(env, 'main');
    if (typeof main === 'function') {
      main();
    }
    logFn(`\n--- Execution Finished ---`);
  } catch (e: any) {
    if (isMainNotFoundError(e)) {
      logFn(`No '# main' definition found.`);
    } else {
      throw e;
    }
  }
};

const runMarkdownIsALISP = (code: string, logFn: (s: string) => void) => {
  try {
    const ast = parseMarkdown(code);
    const globalEnv = createEnv();

    setupStandardLibrary(globalEnv, logFn);
    registerDefinitions(ast, globalEnv);
    executeMain(globalEnv, logFn);

    return ast;
  } catch (e: any) {
    logFn(`Error: ${e.message}`);
    return null;
  }
};


/**
 * ------------------------------------------------------------------
 * REACT UI
 * ------------------------------------------------------------------
 */

const DEFAULT_CODE = `# factorial
* n
* if
  * <=
    * n
    * \`1\`
  * \`1\`
  * *
    * n
    * factorial
      * -
        * n
        * \`1\`

# main
* print
  * \`"Result of 5! is:"\`
  * factorial
    * \`5\`
`;

export default function MarkdownIsALISPIDE() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<string[]>([]);
  const [ast, setAst] = useState<ASTNode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleRun = () => {
    setLogs([]);
    const parsedAst = runMarkdownIsALISP(code, (msg) => {
      setLogs(prev => [...prev, msg]);
    });
    setAst(parsedAst);
  };

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="text-emerald-400 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight text-emerald-400">MarkdownIsALISP Interpreter</h1>
        </div>
        <div className="flex gap-3">
           <button
            onClick={() => setCode(DEFAULT_CODE)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <FileText className="w-4 h-4" /> Reset Ex.
          </button>
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
          >
            <Play className="w-4 h-4" /> Run Code
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Editor Pane */}
        <div className="w-1/2 flex flex-col border-r border-slate-800">
          <div className="bg-slate-900/50 px-4 py-2 text-xs font-mono text-slate-500 uppercase tracking-wider border-b border-slate-800 flex justify-between">
            <span>Source Code (Markdown)</span>
            <span>.md</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full bg-slate-900 p-6 font-mono text-sm leading-6 resize-none focus:outline-none text-slate-300 selection:bg-emerald-500/30"
            spellCheck={false}
          />
        </div>

        {/* Output Pane */}
        <div className="w-1/2 flex flex-col bg-slate-950">

          {/* Console Output */}
          <div className="flex-1 flex flex-col border-b border-slate-800 overflow-hidden">
             <div className="bg-slate-950 px-4 py-2 text-xs font-mono text-slate-500 uppercase tracking-wider border-b border-slate-800 flex justify-between items-center">
              <span>Console Output</span>
              <button onClick={() => setLogs([])} className="hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
            <div className="flex-1 p-6 font-mono text-sm overflow-y-auto font-medium">
              {logs.length === 0 ? (
                <span className="text-slate-600 italic">Ready to execute...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1 text-emerald-300 border-l-2 border-slate-800 pl-3">
                    {log}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* AST Visualization */}
          <div className="h-1/3 flex flex-col bg-slate-900 border-t border-slate-800">
             <div className="bg-slate-900 px-4 py-2 text-xs font-mono text-slate-500 uppercase tracking-wider border-b border-slate-800 flex items-center gap-2">
              <Code className="w-3 h-3" />
              <span>Abstract Syntax Tree (AST)</span>
            </div>
            <div className="flex-1 p-4 overflow-auto text-xs font-mono text-blue-300">
              <pre>{ast ? JSON.stringify(ast, (key, value) => {
                if (key === 'indent') return undefined; // hide implementation details
                return value;
              }, 2) : '// AST will appear here after run'}</pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}