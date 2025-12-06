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

const stripQuotes = (val) => {
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
};

const parseNumericLiteral = (val) => {
  const trimmedVal = val.trim();
  const num = Number(trimmedVal);
  const isNumeric = !isNaN(num) && isFinite(num) && trimmedVal === String(num);
  return isNumeric ? num : null;
};

const createLiteralNode = (value) => ({
  type: NodeType.LITERAL,
  value,
  children: []
});

const createSymbolNode = (value) => ({
  type: NodeType.SYMBOL,
  value,
  children: []
});

const parseContent = (text) => {
  text = text.trim();
  text = text.replace(/^[-*]\s+/, '');

  const literalMatch = text.match(/^`([^`]+)`$/);
  if (literalMatch) {
    let val = literalMatch[1];
    val = stripQuotes(val);
    
    const num = parseNumericLiteral(val);
    return createLiteralNode(num !== null ? num : val);
  }

  return createSymbolNode(text);
};

const parseHeader = (trimLine) => {
  const defName = trimLine.replace(/^#+\s*/, '').trim();
  return {
    type: NodeType.DEF,
    value: defName,
    children: []
  };
};

const findParentInStack = (stack, indent) => {
  while (stack.length > 0 && (stack[stack.length - 1].indent ?? -1) >= indent) {
    stack.pop();
  }
  return stack.length > 0 ? stack[stack.length - 1] : null;
};

const addNodeToHierarchy = (node, stack, currentDef) => {
  const parent = findParentInStack(stack, node.indent);
  if (parent) {
    parent.children.push(node);
  } else {
    currentDef.children.push(node);
  }
  stack.push(node);
};

const parseListItem = (line, trimLine, currentDef, stack) => {
  const indent = getIndentLevel(line);
  const content = trimLine.replace(/^[-*]\s+/, '');
  const parsed = parseContent(content);
  const node = {
    ...parsed,
    type: parsed.type,
    indent: indent,
    children: []
  };
  addNodeToHierarchy(node, stack, currentDef);
};

const parseMarkdown = (input) => {
  const lines = input.split('\n').filter(l => l.trim().length > 0);
  const root = { type: NodeType.PROGRAM, children: [] };

  let currentDef = null;
  let stack = [];

  for (let line of lines) {
    const trimLine = line.trim();

    if (trimLine.startsWith('#')) {
      currentDef = parseHeader(trimLine);
      root.children.push(currentDef);
      stack = [];
      continue;
    }

    if (currentDef && (trimLine.startsWith('-') || trimLine.startsWith('*'))) {
      parseListItem(line, trimLine, currentDef, stack);
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

const isTruthy = (value) => {
  return value !== false && value !== null && value !== 0;
};

const extractOperatorName = (opRaw) => {
  if (typeof opRaw === 'object' && opRaw.type === NodeType.SYMBOL) {
    return opRaw.name;
  }
  if (typeof opRaw === 'string') {
    return opRaw;
  }
  return "";
};

const evaluateIf = (x, env) => {
  const test = evaluate(x[1], env);
  if (isTruthy(test)) {
    return evaluate(x[2], env);
  }
  return x[3] ? evaluate(x[3], env) : null;
};

const bindLambdaParameters = (paramsRaw, args, localEnv) => {
  if (paramsRaw && paramsRaw.type === NodeType.SYMBOL) {
    setVar(localEnv, paramsRaw.name, args[0]);
  } else if (Array.isArray(paramsRaw)) {
    paramsRaw.forEach((param, idx) => {
      if (param && param.type === NodeType.SYMBOL) {
        setVar(localEnv, param.name, args[idx]);
      }
    });
  }
};

const evaluateLambda = (x, env) => {
  const paramsRaw = x[1];
  const bodyRaw = x[2];

  return (...args) => {
    const localEnv = createEnv(env);
    bindLambdaParameters(paramsRaw, args, localEnv);
    return evaluate(bodyRaw, localEnv);
  };
};

const resolveProcedure = (first, env) => {
  if (typeof first === 'string') {
    return getVar(env, first);
  }
  return evaluate(first, env);
};

const applyFunction = (proc, x, env) => {
  if (typeof proc !== 'function') {
    throw new Error(`Attempt to call non-function: ${JSON.stringify(x[0])}`);
  }
  const args = x.slice(1).map((arg) => evaluate(arg, env));
  return proc(...args);
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

    const opName = extractOperatorName(x[0]);

    if (opName === 'if') {
      return evaluateIf(x, env);
    }

    if (opName === 'lambda') {
      return evaluateLambda(x, env);
    }

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

const setupStandardLibrary = (env, logFn) => {
  setVar(env, '+', (a, b) => a + b);
  setVar(env, '-', (a, b) => a - b);
  setVar(env, '*', (a, b) => a * b);
  setVar(env, '/', (a, b) => a / b);
  setVar(env, '%', (a, b) => a % b);
  setVar(env, '<=', (a, b) => a <= b);
  setVar(env, '>=', (a, b) => a >= b);
  setVar(env, '<', (a, b) => a < b);
  setVar(env, '>', (a, b) => a > b);
  setVar(env, '!=', (a, b) => a !== b);
  setVar(env, 'eq', (a, b) => a === b);
  setVar(env, 'and', (a, b) => a && b);
  setVar(env, 'or', (a, b) => a || b);
  setVar(env, 'not', (a) => !a);
  setVar(env, 'cons', (a, b) => [a, b]);
  setVar(env, 'car', (pair) => {
    if (!Array.isArray(pair) || pair.length === 0) {
      throw new Error('car: expected a cons cell');
    }
    return pair[0];
  });
  setVar(env, 'cdr', (pair) => {
    if (!Array.isArray(pair) || pair.length === 0) {
      throw new Error('cdr: expected a cons cell');
    }
    return pair.length > 1 ? pair[1] : null;
  });
  setVar(env, 'print', (...args) => {
    const out = args.join(' ');
    logFn(out);
    return out;
  });
};

const extractParameterList = (paramsRaw) => {
  if (Array.isArray(paramsRaw) && paramsRaw.length > 1 && typeof paramsRaw[0] === 'string') {
    return paramsRaw.slice(1);
  }
  return paramsRaw;
};

const registerDefinition = (defNode, globalEnv) => {
  const name = defNode.value;
  if (defNode.children.length === 0) return;

  let paramsRaw = defNode.children.length >= 2 
    ? transformNode(defNode.children[0])
    : null;
  
  paramsRaw = extractParameterList(paramsRaw);
  
  const bodyRaw = transformNode(defNode.children[defNode.children.length >= 2 ? 1 : 0]);
  const lambdaExpr = ['lambda', paramsRaw, bodyRaw];
  const val = evaluate(lambdaExpr, globalEnv);
  setVar(globalEnv, name, val);
};

const registerDefinitions = (ast, globalEnv) => {
  ast.children.forEach(defNode => {
    if (defNode.type === NodeType.DEF) {
      registerDefinition(defNode, globalEnv);
    }
  });
};

const isMainNotFoundError = (e) => {
  return e.message && e.message.includes('Undefined symbol: main');
};

const executeMain = (globalEnv, logFn) => {
  try {
    const main = getVar(globalEnv, 'main');
    if (typeof main === 'function') {
      main();
    }
    logFn(`\n--- Execution Finished ---`);
  } catch (e) {
    if (isMainNotFoundError(e)) {
      logFn(`No '# main' definition found.`);
    } else {
      throw e;
    }
  }
};

const runMarkdownIsALISP = (code, logFn) => {
  try {
    const ast = parseMarkdown(code);
    const globalEnv = createEnv();

    setupStandardLibrary(globalEnv, logFn);
    registerDefinitions(ast, globalEnv);
    executeMain(globalEnv, logFn);

    return ast;

  } catch (e) {
    logFn(`Error: ${e.message}`);
    return null;
  }
};

