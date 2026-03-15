/**
 * ------------------------------------------------------------------
 * PARSER
 * ------------------------------------------------------------------
 */

const node = (value, children) => ({ value, children: children || [] });

const getIndentLevel = (line) => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  return Math.floor(match[1].replace(/\t/g, '  ').length / 2);
};

const parseToken = (token) => {
  const literalMatch = token.match(/^`([^`]+)`$/);
  if (literalMatch) {
    let val = literalMatch[1];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return node({ string: val.slice(1, -1) });
    }
    if (val === 'null') return node(null);
    if (val === 'true') return node(true);
    if (val === 'false') return node(false);
    const num = Number(val);
    if (!isNaN(num) && isFinite(num) && val === String(num)) {
      return node(num);
    }
    return node({ string: val });
  }
  return node(token);
};

const tokenize = (text) => {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ' ' || text[i] === '\t') { i++; continue; }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        tokens.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    let end = i;
    while (end < text.length && text[end] !== ' ' && text[end] !== '\t' && text[end] !== '`') end++;
    tokens.push(text.slice(i, end));
    i = end;
  }
  return tokens;
};

const parseContent = (text) => {
  text = text.trim().replace(/^[-*]\s+/, '');
  const tokens = tokenize(text);
  if (tokens.length === 0) return node('');
  const head = parseToken(tokens[0]);
  if (tokens.length === 1) return head;
  head.children = tokens.slice(1).map(t => parseToken(t));
  return head;
};

const findParentInStack = (stack, indent) => {
  while (stack.length > 0 && (stack[stack.length - 1]._indent ?? -1) >= indent) {
    stack.pop();
  }
  return stack.length > 0 ? stack[stack.length - 1] : null;
};

const parseMarkdown = (input) => {
  const lines = input.split('\n').filter(l => l.trim().length > 0);
  const defs = [];
  let currentDef = null;
  let stack = [];

  for (const line of lines) {
    const trimLine = line.trim();

    if (trimLine.startsWith('#')) {
      const defName = trimLine.replace(/^#+\s*/, '').trim();
      currentDef = { _isDef: true, name: defName, children: [] };
      defs.push(currentDef);
      stack = [];
      continue;
    }

    if (currentDef && (trimLine.startsWith('-') || trimLine.startsWith('*'))) {
      const indent = getIndentLevel(line);
      const parsed = parseContent(trimLine);
      const n = node(parsed.value, parsed.children ? [...parsed.children] : []);
      n._indent = indent;

      const parent = findParentInStack(stack, indent);
      if (parent) {
        parent.children.push(n);
      } else {
        currentDef.children.push(n);
      }
      stack.push(n);
    }
  }

  return defs;
};

/**
 * ------------------------------------------------------------------
 * AST → MARKDOWN
 * ------------------------------------------------------------------
 */

const formatValue = (val) => {
  if (val === null) return '`null`';
  if (typeof val === 'number') return `\`${val}\``;
  if (typeof val === 'boolean') return `\`${val}\``;
  if (typeof val === 'object' && val !== null && 'error' in val) return `\`ERROR: ${val.error}\``;
  if (typeof val === 'object' && val !== null && 'string' in val) return `\`"${val.string}"\``;
  return String(val);
};

const nodeToMarkdown = (n, indent, compact) => {
  if (indent === undefined) indent = 0;
  if (compact === undefined) compact = false;

  if (n && n._isLambda) {
    const prefix = '  '.repeat(indent);
    const paramLines = n.params.map(p => '  '.repeat(indent + 1) + '- ' + p).join('\n');
    const bodyLines = n.body.map(b => nodeToMarkdown(b, indent + 1, compact)).join('\n');
    return `${prefix}* lambda\n${paramLines}\n${bodyLines}`;
  }

  if (Array.isArray(n)) {
    return n.map(d => {
      if (d._isDef) {
        const header = `# ${d.name}`;
        const body = d.children.map(c => nodeToMarkdown(c, 0, compact)).join('\n');
        return body ? `${header}\n${body}` : header;
      }
      return nodeToMarkdown(d, 0, compact);
    }).join('\n\n');
  }

  if (!n || typeof n !== 'object') return '  '.repeat(indent) + '- ' + formatValue(n);

  const prefix = '  '.repeat(indent);

  // Data list (null-valued node with children) — render children as sibling bullets
  if (n.value === null && n.children.length > 0) {
    return n.children.map(c => nodeToMarkdown(c, indent, compact)).join('\n');
  }

  const line = `${prefix}- ${formatValue(n.value)}`;
  if (!n.children || n.children.length === 0) return line;

  if (compact) {
    // Collect leading atoms onto the same line, break out at first compound child
    const inlineParts = [];
    let breakIdx = 0;
    for (; breakIdx < n.children.length; breakIdx++) {
      const c = n.children[breakIdx];
      if (c && c.children && c.children.length > 0) break;
      if (c && c._isLambda) break;
      inlineParts.push(formatValue(c.value));
    }
    const remaining = n.children.slice(breakIdx);
    const inlineStr = inlineParts.length > 0 ? ' ' + inlineParts.join(' ') : '';
    if (remaining.length === 0) return `${line}${inlineStr}`;
    const remainingMd = remaining.map(c => nodeToMarkdown(c, indent + 1, compact)).join('\n');
    return `${line}${inlineStr}\n${remainingMd}`;
  }

  const childrenMd = n.children.map(c => nodeToMarkdown(c, indent + 1, compact)).join('\n');
  return `${line}\n${childrenMd}`;
};

/**
 * ------------------------------------------------------------------
 * INTERPRETER
 * ------------------------------------------------------------------
 */

const createEnv = (parent) => ({ parent, vars: {} });

const getVar = (env, name) => {
  if (name in env.vars) return env.vars[name];
  if (env.parent) return getVar(env.parent, name);
  return makeError(name, 'undefined symbol');
};

const setVar = (env, name, val) => { env.vars[name] = val; };

const isSelfEvaluating = (val) =>
  typeof val === 'number' || typeof val === 'boolean' || val === null ||
  (typeof val === 'object' && val !== null && 'string' in val) ||
  (typeof val === 'object' && val !== null && 'error' in val);

const makeError = (symbol, reason) => node(
  { error: `${symbol}: ${reason}` },
  [node(symbol, [node({ string: reason })])]
);
const addTrace = (err, reason) => node(err.value, [...err.children, node({ string: reason })]);
const isError = (n) => n && typeof n === 'object' && n.value && typeof n.value === 'object' && 'error' in n.value;

const isTruthy = (n) => {
  if (!n || typeof n !== 'object') return !!n;
  const v = n.value;
  return v !== false && v !== null && v !== 0;
};

const extractParams = (paramNode) => {
  if (paramNode.children.length > 0) {
    return paramNode.children.map(c => c.value);
  }
  return [paramNode.value];
};

const makeClosure = (paramNames, bodyNodes, env) => ({
  _isLambda: true,
  params: paramNames,
  body: bodyNodes,
  env
});

const evaluateIf = (n, env) => {
  const test = evaluate(n.children[0], env);
  if (isError(test)) return addTrace(test, 'in if condition');
  if (isTruthy(test)) return evaluate(n.children[1], env);
  return n.children[2] ? evaluate(n.children[2], env) : node(null);
};

const evaluateBody = (bodyNodes, env) => {
  let result = node(null);
  for (const n of bodyNodes) {
    result = evaluate(n, env);
    if (isError(result)) return addTrace(result, 'in body');
  }
  return result;
};

const evaluateLambda = (n, env) => {
  const paramNames = extractParams(n.children[0]);
  return makeClosure(paramNames, n.children.slice(1), env);
};

const evaluate = (n, env) => {
  if (!n || typeof n !== 'object' || !('value' in n)) return n;

  // Atom (no children)
  if (n.children.length === 0) {
    if (isSelfEvaluating(n.value)) return n;
    if (typeof n.value === 'string') return getVar(env, n.value);
    return n;
  }

  // Node with children — value is operator
  const opName = n.value;

  // Special forms
  if (opName === 'quote') return n.children[0];
  if (opName === 'eval') {
    const inner = evaluate(n.children[0], env);
    if (isError(inner)) return addTrace(inner, 'in eval');
    return evaluate(inner, env);
  }
  if (opName === 'if') return evaluateIf(n, env);
  if (opName === 'lambda') return evaluateLambda(n, env);

  // Function call
  const proc = getVar(env, opName);
  if (isError(proc)) return proc;
  const args = n.children.map(child => evaluate(child, env));
  const firstErr = args.find(isError);
  if (firstErr) return addTrace(firstErr, `in argument to ${opName}`);

  if (proc && proc._isLambda) {
    const localEnv = createEnv(proc.env);
    proc.params.forEach((p, i) => setVar(localEnv, p, args[i]));
    const result = evaluateBody(proc.body, localEnv);
    if (isError(result)) return addTrace(result, `in call to ${opName}`);
    return result;
  }

  if (typeof proc === 'function') {
    const result = proc(...args);
    if (isError(result)) return addTrace(result, `in ${opName}`);
    return result;
  }

  return makeError(opName, 'not a function');
};

/**
 * ------------------------------------------------------------------
 * STANDARD LIBRARY
 * ------------------------------------------------------------------
 */

const setupStandardLibrary = (env, logFn) => {
  // Arithmetic
  setVar(env, '+', (a, b) => {
    const av = a.value, bv = b.value;
    if (typeof av === 'object' && 'string' in av || typeof bv === 'object' && 'string' in bv) {
      const sa = typeof av === 'object' && 'string' in av ? av.string : av;
      const sb = typeof bv === 'object' && 'string' in bv ? bv.string : bv;
      return node({ string: String(sa) + String(sb) });
    }
    return node(av + bv);
  });
  setVar(env, '-', (a, b) => node(a.value - b.value));
  setVar(env, '*', (a, b) => node(a.value * b.value));
  setVar(env, '/', (a, b) => node(a.value / b.value));
  setVar(env, '%', (a, b) => node(a.value % b.value));

  // Comparison
  setVar(env, '<=', (a, b) => node(a.value <= b.value));
  setVar(env, '>=', (a, b) => node(a.value >= b.value));
  setVar(env, '<', (a, b) => node(a.value < b.value));
  setVar(env, '>', (a, b) => node(a.value > b.value));
  setVar(env, '!=', (a, b) => {
    const av = a.value, bv = b.value;
    if (typeof av === 'object' && 'string' in av && typeof bv === 'object' && 'string' in bv) {
      return node(av.string !== bv.string);
    }
    return node(av !== bv);
  });
  setVar(env, 'eq', (a, b) => {
    const av = a.value, bv = b.value;
    if (typeof av === 'object' && 'string' in av && typeof bv === 'object' && 'string' in bv) {
      return node(av.string === bv.string);
    }
    return node(av === bv);
  });

  // Logic
  setVar(env, 'and', (a, b) => node(isTruthy(a) && isTruthy(b)));
  setVar(env, 'or', (a, b) => node(isTruthy(a) || isTruthy(b)));
  setVar(env, 'not', (a) => node(!isTruthy(a)));
  setVar(env, 'null?', (a) => node(a.value === null && a.children.length === 0));
  setVar(env, 'atom?', (a) => node(a.children.length === 0));
  setVar(env, 'list?', (a) => node(a.value === null && a.children.length > 0));
  setVar(env, 'error?', (a) => node(isError(a)));

  // Tree primitives — code introspection and construction
  setVar(env, 'tag', (n) => node(n.value));

  setVar(env, 'children', (n) => {
    if (!n.children || n.children.length === 0) return node(null);
    return node(null, [...n.children]);
  });

  setVar(env, 'make-node', (tagNode, childrenList) => {
    if (!childrenList || (childrenList.value === null && childrenList.children.length === 0)) {
      return node(tagNode.value);
    }
    return node(tagNode.value, [...childrenList.children]);
  });

  // List primitives — flat data lists (null-valued nodes)
  setVar(env, 'car', (n) => {
    if (!n.children || n.children.length === 0) return makeError('car', 'empty list');
    return n.children[0];
  });

  setVar(env, 'cdr', (n) => {
    if (n.value === null) {
      // Data list: always return a data list
      if (!n.children || n.children.length <= 1) return node(null);
      return node(null, n.children.slice(1));
    }
    // Cons pair: return second child directly
    if (!n.children || n.children.length < 2) return makeError('cdr', 'insufficient elements');
    if (n.children.length === 2) return n.children[1];
    return node(null, n.children.slice(1));
  });

  setVar(env, 'cons', (a, b) => {
    if (b && b.value === null && b.children && b.children.length > 0) {
      return node(null, [a, ...b.children]);
    }
    return node(null, [a, b]);
  });

  setVar(env, 'list', (...args) => {
    return node(null, args);
  });

  // I/O
  setVar(env, 'print', (...args) => {
    const out = args.map(a => {
      const v = a.value;
      if (typeof v === 'object' && v !== null && 'error' in v) return `ERROR: ${v.error}`;
      if (typeof v === 'object' && v !== null && 'string' in v) return v.string;
      return String(v);
    }).join(' ');
    logFn(out);
    return node({ string: out });
  });

  setVar(env, 'print-ast', (n) => {
    const md = nodeToMarkdown(n, 0);
    logFn(md);
    return n;
  });

  // Parse exposed at runtime
  setVar(env, 'parse', (code) => {
    const src = typeof code.value === 'object' && 'string' in code.value
      ? code.value.string : String(code.value);
    const defs = parseMarkdown(src);
    return node('program', defs.map(d => node(d.name, d.children)));
  });
};

/**
 * ------------------------------------------------------------------
 * RUNNER
 * ------------------------------------------------------------------
 */

const isParamSpec = (n) => {
  if (typeof n.value !== 'string') return false;
  if (isSelfEvaluating(n.value)) return false;
  if (n.children.length === 0) return true;
  return n.children.every(c => typeof c.value === 'string' && !isSelfEvaluating(c.value) && c.children.length === 0);
};

const registerDefinition = (def, globalEnv) => {
  if (def.children.length === 0) return;

  if (def.children.length === 1 && isSelfEvaluating(def.children[0].value) && def.children[0].children.length === 0) {
    setVar(globalEnv, def.name, def.children[0]);
    return;
  }

  const firstChild = def.children[0];
  if (def.children.length >= 2 && isParamSpec(firstChild)) {
    const paramNames = extractParams(firstChild);
    const bodyNodes = def.children.slice(1);
    setVar(globalEnv, def.name, makeClosure(paramNames, bodyNodes, globalEnv));
    return;
  }

  setVar(globalEnv, def.name, makeClosure([], def.children, globalEnv));
};

const runMarkdownIsALISP = (code, logFn) => {
  try {
    const defs = parseMarkdown(code);
    const globalEnv = createEnv(null);

    setupStandardLibrary(globalEnv, logFn);
    defs.forEach(def => registerDefinition(def, globalEnv));

    const main = getVar(globalEnv, 'main');
    if (isError(main)) {
      logFn(`No '# main' definition found.`);
    } else if (main && main._isLambda) {
      const localEnv = createEnv(main.env);
      const result = evaluateBody(main.body, localEnv);
      if (isError(result)) {
        logFn(`Error: ${result.value.error}`);
      }
      logFn(`\n--- Execution Finished ---`);
    } else {
      logFn(`\n--- Execution Finished ---`);
    }

    return defs;

  } catch (e) {
    logFn(`Error: ${e.message}`);
    return null;
  }
};
