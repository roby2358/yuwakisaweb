/**
 * ------------------------------------------------------------------
 * PARSER
 * ------------------------------------------------------------------
 */

const node = (value, children) => ({ value, children: children || [] });

// Indentation: 1 level = 2 spaces; tabs expand to 2 spaces. Returns both the
// rounded level and the raw space count so the caller can flag indentation
// that isn't a clean multiple of 2 (rounding is a defined, reported behavior,
// not a silent guess).
const measureIndent = (line) => {
  const spaces = line.match(/^(\s*)/)[1].replace(/\t/g, '  ').length;
  return { level: Math.floor(spaces / 2), spaces };
};

/**
 * Literal grammar (backtick-wrapped). Bare words are symbols.
 *   `null` `true` `false`   → those values
 *   `"..."` / `'...'`       → string (surrounding quotes stripped)
 *   ``  (empty)             → empty string
 *   `42` `-3.5`             → number, ONLY when it round-trips exactly
 *                            (String(Number(v)) === v). This is deliberate:
 *                            `1.0`, `1e3`, `+5`, `0x10` stay strings so that
 *                            parse → render → parse is stable.
 *   anything else           → string
 * A backtick cannot appear inside a literal — there is no escape syntax.
 */
const parseToken = (token) => {
  const literalMatch = token.match(/^`([^`]*)`$/);
  if (!literalMatch) return node(token);
  const val = literalMatch[1];
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return node({ string: val.slice(1, -1) });
  }
  if (val === 'null') return node(null);
  if (val === 'true') return node(true);
  if (val === 'false') return node(false);
  const num = Number(val);
  if (val !== '' && !isNaN(num) && isFinite(num) && val === String(num)) return node(num);
  return node({ string: val });
};

// Total: every branch advances `i`, so no input can hang. An opening backtick
// with no closing partner is dropped (the stray char is skipped) and flagged
// via `unterminated` so the caller can report it.
const tokenize = (text) => {
  const tokens = [];
  let unterminated = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) { unterminated = true; i++; continue; }
      tokens.push(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let end = i;
    while (end < text.length && text[end] !== ' ' && text[end] !== '\t' && text[end] !== '`') end++;
    tokens.push(text.slice(i, end));
    i = end;
  }
  return { tokens, unterminated };
};

const parseContent = (text) => {
  const stripped = text.trim().replace(/^[-*]\s+/, '');
  const { tokens, unterminated } = tokenize(stripped);
  const errors = unterminated ? ['unterminated backtick literal'] : [];
  if (tokens.length === 0) return { node: node(''), errors };
  const head = parseToken(tokens[0]);
  if (tokens.length > 1) head.children = tokens.slice(1).map(parseToken);
  return { node: head, errors };
};

const findParentInStack = (stack, indent) => {
  while (stack.length > 0 && (stack[stack.length - 1]._indent ?? -1) >= indent) {
    stack.pop();
  }
  return stack.length > 0 ? stack[stack.length - 1] : null;
};

// Returns { defs, diagnostics }. Nothing malformed is dropped silently —
// every ignored or rounded line produces a diagnostic carrying its line number.
const parseMarkdown = (input) => {
  const lines = input.split('\n');
  const defs = [];
  const diagnostics = [];
  let currentDef = null;
  let stack = [];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const trimLine = line.trim();
    if (trimLine.length === 0) return;

    if (trimLine.startsWith('#')) {
      const name = trimLine.replace(/^#+\s*/, '').trim();
      currentDef = { _isDef: true, name, children: [] };
      defs.push(currentDef);
      stack = [];
      return;
    }

    if (!/^[-*]\s/.test(trimLine)) {
      diagnostics.push(`line ${lineNo}: not a "# heading" or "- bullet" — ignored: ${trimLine}`);
      return;
    }

    if (!currentDef) {
      diagnostics.push(`line ${lineNo}: bullet before any "# heading" — ignored: ${trimLine}`);
      return;
    }

    const { level, spaces } = measureIndent(line);
    if (spaces % 2 !== 0) {
      diagnostics.push(`line ${lineNo}: indentation of ${spaces} space(s) is not a multiple of 2 — rounded down to level ${level}`);
    }

    const { node: parsed, errors } = parseContent(trimLine);
    errors.forEach(e => diagnostics.push(`line ${lineNo}: ${e}`));

    const n = node(parsed.value, parsed.children ? [...parsed.children] : []);
    n._indent = level;
    const parent = findParentInStack(stack, level);
    (parent ? parent.children : currentDef.children).push(n);
    stack.push(n);
  });

  return { defs, diagnostics };
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
  if (opName === 'mial') {
    if (n.children.length !== 1) {
      return makeError('mial', `takes exactly one child, got ${n.children.length}`);
    }
    return n.children[0];
  }
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

  setVar(env, 'make-mial', (tagNode, childrenList) => {
    // A string-literal tag denotes a symbol: `"*"` builds a node tagged *.
    // Literal atoms never need make-mial (an evaluated value already is one),
    // so the string representation is free to mean "symbol name" here.
    const tag = (typeof tagNode.value === 'object' && tagNode.value !== null && 'string' in tagNode.value)
      ? tagNode.value.string
      : tagNode.value;
    if (!childrenList || (childrenList.value === null && childrenList.children.length === 0)) {
      return node(tag);
    }
    return node(tag, [...childrenList.children]);
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

  setVar(env, 'print-mial', (n) => {
    const md = nodeToMarkdown(n, 0);
    logFn(md);
    return n;
  });

  // Parse exposed at runtime — print-mial's inverse (Markdown string → MIAL)
  setVar(env, 'parse-mial', (code) => {
    const src = typeof code.value === 'object' && 'string' in code.value
      ? code.value.string : String(code.value);
    const { defs } = parseMarkdown(src);
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
    const { defs, diagnostics } = parseMarkdown(code);
    diagnostics.forEach(d => logFn(`Warning: ${d}`));
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
