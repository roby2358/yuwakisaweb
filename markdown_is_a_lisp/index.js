/**
 * ------------------------------------------------------------------
 * MARKDOWNISALISP TYPES
 * ------------------------------------------------------------------
 */

const NodeType = {
  PROGRAM: 'PROGRAM',
  DEF: 'DEF',
  EXPRESSION: 'EXPRESSION',
  LITERAL: 'LITERAL',
  SYMBOL: 'SYMBOL'
};

/**
 * ------------------------------------------------------------------
 * PARSER
 * ------------------------------------------------------------------
 */

const getIndentLevel = (line) => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const whitespace = match[1];
  const spaces = whitespace.replace(/\t/g, '  ').length;
  return Math.floor(spaces / 2);
};

const parseContent = (text) => {
  text = text.trim();
  text = text.replace(/^[-*]\s+/, '');

  const literalMatch = text.match(/^`([^`]+)`$/);
  if (literalMatch) {
    let val = literalMatch[1];
    // Strip surrounding quotes if present (e.g., `"hello"` -> hello)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    
    // Parse as number only if it's a valid numeric literal
    // This avoids edge cases like Number("") = 0, Number("NaN") = NaN, Number("Infinity") = Infinity
    const trimmedVal = val.trim();
    const num = Number(trimmedVal);
    const isNumeric = !isNaN(num) && isFinite(num) && trimmedVal === String(num);
    
    return {
      type: NodeType.LITERAL,
      value: isNumeric ? num : val,
      children: []
    };
  }

  return {
    type: NodeType.SYMBOL,
    value: text,
    children: []
  };
};

const parseMarkdown = (input) => {
  const lines = input.split('\n').filter(l => l.trim().length > 0);
  const root = { type: NodeType.PROGRAM, children: [] };

  let currentDef = null;
  let stack = [];

  for (let line of lines) {
    const trimLine = line.trim();

    if (trimLine.startsWith('#')) {
      const defName = trimLine.replace(/^#+\s*/, '').trim();
      currentDef = {
        type: NodeType.DEF,
        value: defName,
        children: []
      };
      root.children.push(currentDef);
      stack = [];
      continue;
    }

    if (currentDef && (trimLine.startsWith('-') || trimLine.startsWith('*'))) {
      const indent = getIndentLevel(line);
      const content = trimLine.replace(/^[-*]\s+/, '');

      const parsed = parseContent(content);
      const node = {
        ...parsed,
        // Preserve original type - we'll treat it as EXPRESSION in transformNode if it has children
        type: parsed.type,
        indent: indent,
        children: []
      };

      while (stack.length > 0 && (stack[stack.length - 1].indent ?? -1) >= indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        currentDef.children.push(node);
      } else {
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

const createEnv = (parent = null) => ({
  parent,
  vars: {},
});

const getVar = (env, name) => {
  if (name in env.vars) return env.vars[name];
  if (env.parent) return getVar(env.parent, name);
  throw new Error(`Undefined symbol: ${name}`);
};

const setVar = (env, name, val) => {
  env.vars[name] = val;
};

const transformNode = (node) => {
  // If it's a LITERAL with no children, return raw value
  if (node.type === NodeType.LITERAL && node.children.length === 0) {
    return node.value;
  }

  // If it has children, it's a function call/expression: (func arg1 arg2 ...)
  if (node.children.length > 0) {
    return [node.value, ...node.children.map(transformNode)];
  }

  // If it's a SYMBOL with no children, it's a variable reference
  if (node.type === NodeType.SYMBOL) {
    return { type: NodeType.SYMBOL, name: node.value };
  }

  // If it's an EXPRESSION with no children, it was originally a SYMBOL
  if (node.type === NodeType.EXPRESSION) {
    return { type: NodeType.SYMBOL, name: node.value };
  }

  // Fallback: return the value if it's a primitive
  if (typeof node.value === 'string' || typeof node.value === 'number') {
    return node.value;
  }

  // If we get here, something is wrong with the AST structure
  throw new Error(`Unexpected node type in transformNode: ${node.type} with value: ${JSON.stringify(node.value)}`);
};

const evaluate = (x, env) => {
  if (typeof x === 'number' || typeof x === 'string') {
    return x;
  }

  if (x && x.type === NodeType.SYMBOL) {
    return getVar(env, x.name);
  }

  if (Array.isArray(x)) {
    if (x.length === 0) return null;

    const opRaw = x[0];
    let opName = "";

    if (typeof opRaw === 'object' && opRaw.type === NodeType.SYMBOL) {
      opName = opRaw.name;
    } else if (typeof opRaw === 'string') {
      opName = opRaw;
    }

    if (opName === 'if') {
      const test = evaluate(x[1], env);
      if (test !== false && test !== null && test !== 0) {
        return evaluate(x[2], env);
      } else {
        return x[3] ? evaluate(x[3], env) : null;
      }
    }

    if (opName === 'lambda') {
      // Convention: First child of lambda is params, second is body.
      // Structure:
      // * lambda
      //   * n (single param) OR [param1, param2, ...] (multiple params)
      //   * body (expression)
      const paramsRaw = x[1];
      const bodyRaw = x[2];

      return (...args) => {
        const localEnv = createEnv(env);

        // Handle single parameter: {type: 'SYMBOL', name: 'n'}
        if (paramsRaw && paramsRaw.type === NodeType.SYMBOL) {
          setVar(localEnv, paramsRaw.name, args[0]);
        }
        // Handle multiple parameters: array of symbols
        else if (Array.isArray(paramsRaw)) {
          paramsRaw.forEach((param, idx) => {
            if (param && param.type === NodeType.SYMBOL) {
              setVar(localEnv, param.name, args[idx]);
            }
          });
        }

        return evaluate(bodyRaw, localEnv);
      };
    }

    // If x[0] is a string, it's a symbol name (function name), not a literal
    let proc;
    if (typeof x[0] === 'string') {
      proc = getVar(env, x[0]);
    } else {
      proc = evaluate(x[0], env);
    }

    if (typeof proc === 'function') {
      const args = x.slice(1).map((arg) => evaluate(arg, env));
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

const runMarkdownIsALISP = (code, logFn) => {
  try {
    const ast = parseMarkdown(code);
    const globalEnv = createEnv();

    setVar(globalEnv, '+', (a, b) => a + b);
    setVar(globalEnv, '-', (a, b) => a - b);
    setVar(globalEnv, '*', (a, b) => a * b);
    setVar(globalEnv, '/', (a, b) => a / b);
    setVar(globalEnv, '%', (a, b) => a % b);
    setVar(globalEnv, '<=', (a, b) => a <= b);
    setVar(globalEnv, '>=', (a, b) => a >= b);
    setVar(globalEnv, '<', (a, b) => a < b);
    setVar(globalEnv, '>', (a, b) => a > b);
    setVar(globalEnv, '!=', (a, b) => a !== b);
    setVar(globalEnv, 'eq', (a, b) => a === b);
    setVar(globalEnv, 'and', (a, b) => a && b);
    setVar(globalEnv, 'or', (a, b) => a || b);
    setVar(globalEnv, 'not', (a) => !a);
    setVar(globalEnv, 'cons', (a, b) => [a, b]);
    setVar(globalEnv, 'car', (pair) => {
      if (!Array.isArray(pair) || pair.length === 0) {
        throw new Error('car: expected a cons cell');
      }
      return pair[0];
    });
    setVar(globalEnv, 'cdr', (pair) => {
      if (!Array.isArray(pair) || pair.length === 0) {
        throw new Error('cdr: expected a cons cell');
      }
      return pair.length > 1 ? pair[1] : null;
    });
    setVar(globalEnv, 'print', (...args) => {
      const out = args.join(' ');
      logFn(out);
      return out;
    });

    ast.children.forEach(defNode => {
      if (defNode.type === NodeType.DEF) {
        const name = defNode.value;
        if (defNode.children.length > 0) {
          // Always treat definitions as lambda functions
          // If 2+ children: first is parameter(s), second is body
          // If 1 child: no parameters, that child is the body
          let paramsRaw = defNode.children.length >= 2 
            ? transformNode(defNode.children[0])
            : null; // No parameters for single-child definitions
          
          // If paramsRaw is an array starting with an operator (like ['*', sym1, sym2]),
          // extract just the symbols as the parameter list
          if (Array.isArray(paramsRaw) && paramsRaw.length > 1 && typeof paramsRaw[0] === 'string') {
            paramsRaw = paramsRaw.slice(1);
          }
          
          const bodyRaw = transformNode(defNode.children[defNode.children.length >= 2 ? 1 : 0]);
          
          // Create lambda expression: ['lambda', params, body]
          const lambdaExpr = ['lambda', paramsRaw, bodyRaw];
          const val = evaluate(lambdaExpr, globalEnv);
          setVar(globalEnv, name, val);
        }
      }
    });

    // 2. Look for 'main' and run it
    try {
      const main = getVar(globalEnv, 'main');
      // If main is a function (lambda), call it
      if (typeof main === 'function') {
        main();
      }
      logFn(`\n--- Execution Finished ---`);
    } catch (e) {
      if (e.message && e.message.includes('Undefined symbol: main')) {
        logFn(`No '# main' definition found.`);
      } else {
        throw e; // Re-throw if it's a different error
      }
    }

    return ast;

  } catch (e) {
    logFn(`Error: ${e.message}`);
    return null;
  }
};

/**
 * ------------------------------------------------------------------
 * UI CONTROLLER
 * ------------------------------------------------------------------
 */

const EXAMPLE_CODES = {
  factorial: `# factorial
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
    * \`5\``,
  
  fibonacci: `# fibonacci
* n
* if
  * <=
    * n
    * \`1\`
  * n
  * +
    * fibonacci
      * -
        * n
        * \`1\`
    * fibonacci
      * -
        * n
        * \`2\`

# main
* print
  * \`"fibonacci(10) ="\`
  * fibonacci
    * \`10\``,
  
  'fizzbuzz-n': `# fizzbuzz-helper
* current
* max
* if
  * >
    * current
    * max
  * \`""\`
  * +
    * +
      * if
        * and
          * eq
            * %
              * current
              * \`3\`
            * \`0\`
          * eq
            * %
              * current
              * \`5\`
            * \`0\`
        * \`"fizzbuzz "\`
        * if
          * eq
            * %
              * current
              * \`3\`
            * \`0\`
          * \`"fizz "\`
          * if
            * eq
              * %
                * current
                * \`5\`
              * \`0\`
            * \`"buzz "\`
            * +
              * +
                * current
                * \`""\`
              * \`" "\`
      * fizzbuzz-helper
        * +
          * current
          * \`1\`
        * max

# fizzbuzz
* n
* fizzbuzz-helper
  * \`1\`
  * n

# main
* print
  * fizzbuzz
    * \`15\``,
  
  'fizzbuzz-newlines': `# divisible-by-3
* n
* eq
  * %
    * n
    * \`3\`
  * \`0\`

# divisible-by-5
* n
* eq
  * %
    * n
    * \`5\`
  * \`0\`

# fizzbuzz-value
* n
* if
  * and
    * divisible-by-3
      * n
    * divisible-by-5
      * n
  * \`"fizzbuzz "\`
  * if
    * divisible-by-3
      * n
    * \`"fizz "\`
    * if
      * divisible-by-5
        * n
      * \`"buzz "\`
      * +
        * +
          * n
          * \`""\`
        * \`" "\`

# fizzbuzz-helper
* *
  * current
  * max
* if
  * >
    * current
    * max
  * \`""\`
  * +
    * fizzbuzz-value
      * current
    * fizzbuzz-helper
      * +
        * current
        * \`1\`
      * max

# fizzbuzz
* n
* fizzbuzz-helper
  * \`1\`
  * n

# main
* print
  * fizzbuzz
    * \`15\``
};

const DEFAULT_CODE = EXAMPLE_CODES.factorial;

const initApp = () => {
  const codeEditor = document.getElementById('codeEditor');
  const consoleOutput = document.getElementById('consoleOutput');
  const astOutput = document.getElementById('astOutput');
  const runBtn = document.getElementById('runBtn');
  const resetBtn = document.getElementById('resetBtn');
  const clearBtn = document.getElementById('clearBtn');

  codeEditor.value = DEFAULT_CODE;

  const clearConsole = () => {
    consoleOutput.innerHTML = '<span class="console-placeholder">Ready to execute...</span>';
  };

  const clearAST = () => {
    astOutput.querySelector('pre').textContent = '// AST will appear here after run';
  };

  const appendLog = (message) => {
    if (consoleOutput.querySelector('.console-placeholder')) {
      consoleOutput.innerHTML = '';
    }
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    logLine.textContent = message;
    consoleOutput.appendChild(logLine);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  };

  const updateAST = (ast) => {
    if (!ast) {
      clearAST();
      return;
    }
    const astJson = JSON.stringify(ast, (key, value) => {
      if (key === 'indent') return undefined;
      return value;
    }, 2);
    astOutput.querySelector('pre').textContent = astJson;
  };

  const handleRun = () => {
    clearConsole();
    const code = codeEditor.value;
    const ast = runMarkdownIsALISP(code, appendLog);
    updateAST(ast);
  };

  const handleReset = () => {
    codeEditor.value = DEFAULT_CODE;
    clearConsole();
    updateAST(null);
  };

  const handleExampleClick = (exampleName) => {
    if (EXAMPLE_CODES[exampleName]) {
      codeEditor.value = EXAMPLE_CODES[exampleName];
      clearConsole();
      clearAST();
    }
  };

  runBtn.addEventListener('click', handleRun);
  resetBtn.addEventListener('click', handleReset);
  clearBtn.addEventListener('click', clearConsole);

  const exampleLinks = document.querySelectorAll('.example-link');
  exampleLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const exampleName = link.getAttribute('data-example');
      if (exampleName) {
        handleExampleClick(exampleName);
      }
    });
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

