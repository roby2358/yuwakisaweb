import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Code, Terminal, FileText } from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * MARKLISP TYPES
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

// Helper to parse content: "`10`" -> literal 10, "add" -> symbol "add"
const parseContent = (text: string): ASTNode => {
  text = text.trim();

  // Remove list markers if present at start of content parsing
  text = text.replace(/^[-*]\s+/, '');

  // Check for literal (backticks)
  const literalMatch = text.match(/^`([^`]+)`$/);
  if (literalMatch) {
    const val = literalMatch[1];
    const num = Number(val);
    return {
      type: 'LITERAL',
      value: isNaN(num) ? val : num,
      children: []
    };
  }

  // Otherwise it's a symbol
  return {
    type: 'SYMBOL',
    value: text,
    children: []
  };
};

const parseMarkdown = (input: string): ASTNode => {
  const lines = input.split('\n').filter(l => l.trim().length > 0);
  const root: ASTNode = { type: 'PROGRAM', children: [] };

  let currentDef: ASTNode | null = null;
  let stack: ASTNode[] = [];

  for (let line of lines) {
    const trimLine = line.trim();

    // 1. Handle Headers (Definitions)
    if (trimLine.startsWith('#')) {
      const defName = trimLine.replace(/^#+\s*/, '').trim();
      currentDef = {
        type: 'DEF',
        value: defName,
        children: []
      };
      root.children.push(currentDef);
      stack = []; // Reset stack for new definition body
      continue;
    }

    // 2. Handle List Items (Expressions)
    // Only process list items if we are inside a definition
    if (currentDef && (trimLine.startsWith('-') || trimLine.startsWith('*'))) {
      const indent = getIndentLevel(line);
      const content = trimLine.replace(/^[-*]\s+/, '');

      const node: ASTNode = {
        ...parseContent(content),
        type: 'EXPRESSION', // It starts as an expression, might degenerate to symbol/literal later if leaf
        indent: indent,
        children: []
      };

      // Since the node is derived from a list item, the parseContent helper might have set it to SYMBOL or LITERAL.
      // We need to respect that structure but maintain the hierarchy.
      // Actually, in MarkLisp:
      // - sum      <-- Operator (Symbol)
      //   - `1`    <-- Operand (Literal)
      //   - `2`    <-- Operand (Literal)
      //
      // So the list item *itself* is the head of the list.

      // Logic: Find the parent on the stack.
      // The parent is the nearest node with indent < current indent.

      while (stack.length > 0 && (stack[stack.length - 1].indent ?? -1) >= indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Top level of this definition
        currentDef.children.push(node);
      } else {
        // Child of the last valid parent
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
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

// Convert AST node back to Lisp-like structure for internal evaluation
const transformNode = (node: ASTNode): any => {
  // If it's a LITERAL, return raw value
  if (node.type === 'LITERAL') return node.value;

  // If it's an EXPRESSION (list item), it represents a list: (value child1 child2 ...)
  // But wait, the `value` of the node is the function name/symbol.
  // So a node structure: { value: "+", children: [A, B] }
  // Should evaluate to: apply("+", [eval(A), eval(B)])

  // However, we need to handle raw symbols.
  // If parseContent identified it as SYMBOL, but it has no children, it's just a variable reference.
  if (node.type === 'SYMBOL' || node.type === 'EXPRESSION') {
    // If it has children, it is a function call: (func arg1 arg2)
    if (node.children.length > 0) {
      return [node.value, ...node.children.map(transformNode)];
    }
    // If no children, check if it was explicitly a literal in disguise or just a symbol
    // Our parser distinguishes strictly via backticks.
    return { type: 'SYMBOL', name: node.value };
  }
};

const evaluate = (x: any, env: Env): any => {
  // 1. Literal
  if (typeof x === 'number' || typeof x === 'string') {
    return x;
  }

  // 2. Symbol Reference
  if (x && x.type === 'SYMBOL') {
    return getVar(env, x.name);
  }

  // 3. List / Function Call
  if (Array.isArray(x)) {
    if (x.length === 0) return null;

    // Handle Symbols that resolve to special forms or functions
    const opRaw = x[0];
    let opName = "";

    if (typeof opRaw === 'object' && opRaw.type === 'SYMBOL') {
      opName = opRaw.name;
    }

    // --- SPECIAL FORMS ---

    // (def symbol value) - but in MarkLisp, defs are mostly via Headers.
    // We can support local defs? Maybe later.

    // (if test trueBranch falseBranch)
    if (opName === 'if') {
      const test = evaluate(x[1], env);
      if (test !== false && test !== null && test !== 0) {
        return evaluate(x[2], env);
      } else {
        return x[3] ? evaluate(x[3], env) : null;
      }
    }

    // (lambda (arg1 arg2) body)
    if (opName === 'lambda') {
      // In MarkLisp structure:
      // - lambda
      //   - args (this list item's content is ignored or used as container?)
      //     - arg1
      //     - arg2
      //   - body

      // x[1] is the args node. x[2] is the body node.
      // This depends heavily on how the markdown was written.
      // Let's assume:
      // * lambda
      //   * args  <-- This node's children are the actual args
      //   * body  <-- The expression to evaluate

      // To make it simpler for the MarkLisp style:
      // * lambda
      //   * n (param)
      //   * body (expression)

      // If x[1] is an array (a node with children), we treat it as the parameter list.
      // If x[1] is a single symbol, it's a single param.

      // Let's look at the recursive structure.
      // The AST transformer turns `* n` into `[{type:SYMBOL, name:'n'}]` if it has no children.

      // We need to be flexible.
      // Convention: First child of lambda is params, second is body.
      const paramsRaw = x[1];
      const bodyRaw = x[2];

      return (...args: any[]) => {
        const localEnv = createEnv(env);

        // Map args.
        // If paramsRaw is a list (nested bullets), iterate.
        // If paramsRaw is a single symbol (one bullet), bind it.

        if (Array.isArray(paramsRaw)) {
          // It's a list like ['argContainer', param1, param2]
          // Or just [param1]

          // We need to extract variable names.
          // If the user wrote:
          // * lambda
          //   * x
          //   * * x x

          // x[1] is result of transforming `* x`. It might be {type:'SYMBOL', name:'x'}.

          if (paramsRaw.type === 'SYMBOL') {
             setVar(localEnv, paramsRaw.name, args[0]);
          } else if (Array.isArray(paramsRaw)) {
             // If the first element is a dummy container name (like "args"), skip it.
             // But usually in Lisp (lambda (x y) ...)
             // In MarkLisp:
             // * lambda
             //   * args
             //     * x
             //     * y

             // This is getting complex. Let's support the simple single-arg recursion first shown in the prompt.
             // Prompt example:
             // * lambda
             //   * n
             //   * if ...

             // Here x[1] is 'n'.
             if (paramsRaw.type === 'SYMBOL') {
               setVar(localEnv, paramsRaw.name, args[0]);
             } else {
               // Multivariable support logic would go here
               // For now, let's assume single arg or strict structure
             }
          }
        } else if (paramsRaw && paramsRaw.type === 'SYMBOL') {
             setVar(localEnv, paramsRaw.name, args[0]);
        }

        return evaluate(bodyRaw, localEnv);
      };
    }

    // --- FUNCTION APPLICATION ---

    const proc = evaluate(x[0], env);

    if (typeof proc === 'function') {
      const args = x.slice(1).map((arg: any) => evaluate(arg, env));
      return proc(...args);
    }

    throw new Error(`Attempt to call non-function: ${JSON.stringify(x[0])}`);
  }

  return x;
};

/**
 * ------------------------------------------------------------------
 * RUNNER
 * ------------------------------------------------------------------
 */

const runMarkLisp = (code: string, logFn: (s: string) => void) => {
  try {
    const ast = parseMarkdown(code);
    const globalEnv = createEnv();

    // Standard Lib
    setVar(globalEnv, '+', (a:any, b:any) => a + b);
    setVar(globalEnv, '-', (a:any, b:any) => a - b);
    setVar(globalEnv, '*', (a:any, b:any) => a * b);
    setVar(globalEnv, '/', (a:any, b:any) => a / b);
    setVar(globalEnv, '<=', (a:any, b:any) => a <= b);
    setVar(globalEnv, '>=', (a:any, b:any) => a >= b);
    setVar(globalEnv, 'eq', (a:any, b:any) => a === b);
    setVar(globalEnv, 'print', (...args:any) => {
      const out = args.join(' ');
      logFn(out);
      return out;
    });

    // 1. Register all Definitions (Headers)
    // In MarkLisp, a header `# Name` with body is essentially `(def Name (body))`
    // But usually the body is a function definition or a value.

    ast.children.forEach(defNode => {
      if (defNode.type === 'DEF') {
        const name = defNode.value;
        // The body of the def is its children.
        // If multiple children, it's an implicit `begin` block?
        // Let's assume one main expression per def for now.
        if (defNode.children.length > 0) {
          // We don't evaluate yet, we just parse the structure
          const rawExpr = transformNode(defNode.children[0]);

          // HACK: If the expression is NOT a lambda, we evaluate it immediately (global const).
          // If it IS a lambda (symbol 'lambda' at head), we evaluate it to get the closure.
          // This allows recursion because we bind the name before fully executing if needed?
          // Actually simplest is: evaluate the body and store it in globalEnv.

          // However, for recursion (factorial calling factorial), 'factorial' must be in env
          // inside the lambda body.
          // If we eval `(lambda ...)` it returns a JS function. That function, when called,
          // will look up `factorial` in globalEnv. So we just need to set it.

          const val = evaluate(rawExpr, globalEnv);
          setVar(globalEnv, name, val);
        }
      }
    });

    // 2. Look for 'main' and run it
    const main = getVar(globalEnv, 'main');
    if (typeof main !== 'undefined') {
      // If main is a function (lambda), call it?
      // Or is main just an expression that ran?
      // In the prompt example: `# main` contained `* print ...`.
      // So evaluating the def body *executed* the print.

      // Wait, if I evaluate definitions immediately above, `main` runs immediately.
      // So we are good.
      logFn(`\n--- Execution Finished ---`);
    } else {
      logFn(`No '# main' definition found.`);
    }

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
* lambda
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

export default function MarkLispIDE() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<string[]>([]);
  const [ast, setAst] = useState<ASTNode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleRun = () => {
    setLogs([]);
    const parsedAst = runMarkLisp(code, (msg) => {
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
          <h1 className="text-xl font-bold tracking-tight text-emerald-400">MarkLisp Interpreter</h1>
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