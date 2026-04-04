/**
 * MarkdownIsAPrologue — Phase 1+2 Interpreter
 *
 * Same { value, children } node shape as MIAL.
 * Immutable substitution maps — no trailing, no mutation.
 * Generator-based solver for backtracking.
 * Lists as cons cells: node('.', [head, tail]), node('[]') for empty.
 */

// ── Nodes & helpers ────────────────────────────────────────────

const node = (value, children) => ({ value, children: children || [] });

const isVar = (n) =>
  n && typeof n.value === 'object' && n.value !== null && 'var' in n.value;

const NUM_RE = /^-?\d+(\.\d+)?$/;

// ── Parser ─────────────────────────────────────────────────────

const getIndentLevel = (line) => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  return Math.floor(match[1].replace(/\t/g, '  ').length / 2);
};

// Split text by a separator character, respecting backtick/bracket/paren nesting.
// Shared by parseArgList (split on ',') and parseList (split on '|').
const splitAtDepth0 = (text, separator) => {
  const segments = [];
  let current = '';
  let inBacktick = false;
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '`') { inBacktick = !inBacktick; current += ch; }
    else if (!inBacktick && (ch === '[' || ch === '(')) { depth++; current += ch; }
    else if (!inBacktick && (ch === ']' || ch === ')')) { depth--; current += ch; }
    else if (ch === separator && !inBacktick && depth === 0) { segments.push(current); current = ''; }
    else { current += ch; }
  }
  segments.push(current);
  return segments;
};

const buildConsList = (elements, tail) => {
  let list = tail;
  for (let i = elements.length - 1; i >= 0; i--) list = node('.', [elements[i], list]);
  return list;
};

const parseList = (text, anonCounter) => {
  const inner = text.slice(1, -1).trim();
  if (!inner) return node('[]');

  const pipeParts = splitAtDepth0(inner, '|');
  if (pipeParts.length >= 2) {
    const heads = parseArgList(pipeParts[0], anonCounter);
    const tail = parseTerm(pipeParts.slice(1).join('|').trim(), anonCounter);
    return buildConsList(heads, tail);
  }

  return buildConsList(parseArgList(inner, anonCounter), node('[]'));
};

const parseTerm = (text, anonCounter) => {
  text = text.trim();
  if (!text) return null;

  // Backtick literal
  const litMatch = text.match(/^`([^`]*)`$/);
  if (litMatch) {
    const val = litMatch[1];
    if (NUM_RE.test(val)) return node(Number(val));
    return node(val);
  }

  // Empty list
  if (text === '[]') return node('[]');

  // List [...]
  if (text[0] === '[' && text[text.length - 1] === ']') {
    return parseList(text, anonCounter);
  }

  // Anonymous variable
  if (text === '_') return node({ var: `_anon${anonCounter.count++}` });

  // Named variable (uppercase or _prefix)
  if ((text[0] >= 'A' && text[0] <= 'Z') ||
      (text[0] === '_' && text.length > 1)) {
    return node({ var: text });
  }

  // Compound term: functor(args)
  const parenIdx = text.indexOf('(');
  if (parenIdx > 0 && text[text.length - 1] === ')') {
    const functor = text.slice(0, parenIdx);
    const argsText = text.slice(parenIdx + 1, -1);
    const args = parseArgList(argsText, anonCounter);
    return node(functor, args);
  }

  // Bare number (no backticks needed inside compound terms)
  if (NUM_RE.test(text)) return node(Number(text));

  // Bare atom
  return node(text);
};

const parseArgList = (text, anonCounter) =>
  splitAtDepth0(text, ',')
    .map(s => s.trim())
    .filter(s => s)
    .map(s => parseTerm(s, anonCounter))
    .filter(t => t !== null);

const parseGoal = (text, anonCounter) => {
  text = text.trim();
  const spaceIdx = text.indexOf(' ');
  if (spaceIdx === -1) return node(text);
  const predName = text.slice(0, spaceIdx);

  // `not` consumes the rest as a single sub-goal
  if (predName === 'not') {
    const subGoal = parseGoal(text.slice(spaceIdx + 1), anonCounter);
    return node('not', [subGoal]);
  }

  const args = parseArgList(text.slice(spaceIdx + 1), anonCounter);
  return node(predName, args);
};

const parseMarkdown = (input) => {
  const anonCounter = { count: 0 };
  const lines = input.split('\n');
  const entries = [];
  let current = null;
  let currentClause = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      const name = trimmed.replace(/^#+\s*/, '').trim();
      current = { name, clauses: [] };
      entries.push(current);
      currentClause = null;
      continue;
    }

    if (!current) continue;
    if (!trimmed.startsWith('*') && !trimmed.startsWith('-')) continue;

    const indent = getIndentLevel(line);
    const content = trimmed.replace(/^[-*]\s*/, '');
    const isQuery = current.name === '?';

    if (indent === 0) {
      currentClause = isQuery
        ? { goals: [parseGoal(content, anonCounter)] }
        : { headArgs: content ? parseArgList(content, anonCounter) : [], body: [] };
      current.clauses.push(currentClause);
    } else if (currentClause) {
      const goal = parseGoal(content, anonCounter);
      if (isQuery) currentClause.goals.push(goal);
      else currentClause.body.push(goal);
    }
  }

  return entries;
};

// ── Unification (immutable substitution) ───────────────────────

const deref = (term, subst) => {
  while (isVar(term) && subst.has(term.value.var)) {
    term = subst.get(term.value.var);
  }
  return term;
};

const deepDeref = (term, subst) => {
  term = deref(term, subst);
  if (isVar(term)) return term;
  if (term.children.length === 0) return term;
  return node(term.value, term.children.map(c => deepDeref(c, subst)));
};

const unify = (t1, t2, subst) => {
  t1 = deref(t1, subst);
  t2 = deref(t2, subst);

  if (isVar(t1) && isVar(t2) && t1.value.var === t2.value.var) return subst;
  if (isVar(t1)) return new Map(subst).set(t1.value.var, t2);
  if (isVar(t2)) return new Map(subst).set(t2.value.var, t1);

  if (t1.value !== t2.value) return null;
  if (t1.children.length !== t2.children.length) return null;

  let s = subst;
  for (let i = 0; i < t1.children.length; i++) {
    s = unify(t1.children[i], t2.children[i], s);
    if (s === null) return null;
  }
  return s;
};

const unifyArgs = (args1, args2, subst) => {
  if (args1.length !== args2.length) return null;
  let s = subst;
  for (let i = 0; i < args1.length; i++) {
    s = unify(args1[i], args2[i], s);
    if (s === null) return null;
  }
  return s;
};

// ── Variable freshening ────────────────────────────────────────

const freshenTerm = (term, mapping, id) => {
  if (isVar(term)) {
    const name = term.value.var;
    if (!mapping.has(name)) mapping.set(name, `${name}__${id}`);
    return node({ var: mapping.get(name) });
  }
  if (term.children.length === 0) return term;
  return node(term.value, term.children.map(c => freshenTerm(c, mapping, id)));
};

const freshenClause = (clause, freshCounter) => {
  const id = freshCounter.count++;
  const mapping = new Map();
  const f = (term) => freshenTerm(term, mapping, id);
  return {
    headArgs: clause.headArgs.map(f),
    body: clause.body.map(f)
  };
};

// ── Term formatting ────────────────────────────────────────────

const formatList = (term) => {
  const elements = [];
  let current = term;
  while (current.value === '.' && current.children.length === 2) {
    elements.push(formatTerm(current.children[0]));
    current = current.children[1];
  }
  if (current.value === '[]' && current.children.length === 0) {
    return `[${elements.join(', ')}]`;
  }
  return `[${elements.join(', ')} | ${formatTerm(current)}]`;
};

const formatTerm = (term) => {
  if (isVar(term)) {
    const name = term.value.var;
    const idx = name.indexOf('__');
    return idx >= 0 ? name.slice(0, idx) : name;
  }
  if (typeof term.value === 'number') return String(term.value);
  if (term.value === '[]' && term.children.length === 0) return '[]';
  if (term.value === '.' && term.children.length === 2) return formatList(term);
  if (term.children.length > 0) {
    return `${term.value}(${term.children.map(formatTerm).join(', ')})`;
  }
  return String(term.value);
};

const formatGoal = (g) => {
  if (g.value === 'not' && g.children.length === 1) return `not ${formatGoal(g.children[0])}`;
  if (g.children.length === 0) return g.value;
  return `${g.value}(${g.children.map(formatTerm).join(', ')})`;
};

const formatGoals = (goals) => goals.map(formatGoal).join(', ');

// ── Database ───────────────────────────────────────────────────

const predKey = (name, arity) => `${name}/${arity}`;

const buildDatabase = (entries) => {
  const db = new Map();
  const queries = [];

  for (const entry of entries) {
    if (entry.name === '?') {
      queries.push(...entry.clauses);
      continue;
    }
    for (const clause of entry.clauses) {
      const key = predKey(entry.name, clause.headArgs.length);
      if (!db.has(key)) db.set(key, []);
      db.get(key).push(clause);
    }
  }

  return { db, queries };
};

// ── Arithmetic evaluator ───────────────────────────────────────

const ARITH_OPS = {
  '+':   (a, b) => a + b,
  '-':   (a, b) => a - b,
  '*':   (a, b) => a * b,
  '//':  (a, b) => Math.trunc(a / b),
  'mod': (a, b) => ((a % b) + b) % b,
};

const evalArith = (term, subst) => {
  term = deref(term, subst);
  if (typeof term.value === 'number') return term.value;
  if (isVar(term)) throw new Error('Instantiation error: unbound variable in arithmetic');

  // Unary minus
  if (term.value === '-' && term.children.length === 1) {
    return -evalArith(term.children[0], subst);
  }

  // Binary operator
  const op = ARITH_OPS[term.value];
  if (op && term.children.length === 2) {
    return op(evalArith(term.children[0], subst), evalArith(term.children[1], subst));
  }

  throw new Error(`Unknown arithmetic: ${term.value}/${term.children.length}`);
};

// ── Builtins (plain functions: args, subst → subst | null) ────

const makeBuiltins = (logFn) => {
  const builtins = new Map();

  builtins.set('true/0', (args, subst) => subst);
  builtins.set('fail/0', (args, subst) => null);

  builtins.set('=/2', (args, subst) => unify(args[0], args[1], subst));
  builtins.set('\\=/2', (args, subst) =>
    unify(args[0], args[1], subst) === null ? subst : null);

  builtins.set('write/1', (args, subst) => {
    logFn(formatTerm(deepDeref(args[0], subst)));
    return subst;
  });

  builtins.set('nl/0', (args, subst) => {
    logFn('');
    return subst;
  });

  builtins.set('atom/1', (args, subst) => {
    const t = deref(args[0], subst);
    return (typeof t.value === 'string' && t.children.length === 0) ? subst : null;
  });

  builtins.set('number/1', (args, subst) => {
    const t = deref(args[0], subst);
    return typeof t.value === 'number' ? subst : null;
  });

  builtins.set('var/1', (args, subst) =>
    isVar(deref(args[0], subst)) ? subst : null);

  builtins.set('nonvar/1', (args, subst) =>
    !isVar(deref(args[0], subst)) ? subst : null);

  // Arithmetic
  builtins.set('is/2', (args, subst) => {
    const result = evalArith(args[1], subst);
    return unify(args[0], node(result), subst);
  });

  const arithCompare = (op) => (args, subst) => {
    const a = evalArith(args[0], subst);
    const b = evalArith(args[1], subst);
    return op(a, b) ? subst : null;
  };

  builtins.set('</2',   arithCompare((a, b) => a < b));
  builtins.set('>/2',   arithCompare((a, b) => a > b));
  builtins.set('=</2',  arithCompare((a, b) => a <= b));
  builtins.set('>=/2',  arithCompare((a, b) => a >= b));
  builtins.set('=:=/2', arithCompare((a, b) => a === b));
  builtins.set('=\\=/2', arithCompare((a, b) => a !== b));

  return builtins;
};

// ── Solver ─────────────────────────────────────────────────────
//
// Body goals and continuation are resolved separately so that
// cut is scoped to the right predicate's clause loop.
// Cut sets a flag; the clause loop checks it after each clause.
// Not tries a sub-goal and succeeds when it fails.

const makeSolver = (db, builtins, stepLimit) => {
  const freshCounter = { count: 0 };
  const stepCounter = { count: 0 };

  function* solve(goals, subst, cutFlag) {
    stepCounter.count++;
    if (stepCounter.count > stepLimit) {
      throw new Error(`Step limit exceeded (${stepLimit} resolution steps)`);
    }

    if (goals.length === 0) { yield subst; return; }

    const [goal, ...rest] = goals;

    // ── Cut: succeed, then signal parent clause loop to stop
    if (goal.value === 'cut' && goal.children.length === 0) {
      cutFlag.cut = true;
      yield* solve(rest, subst, cutFlag);
      return;
    }

    // ── Not (negation as failure)
    if (goal.value === 'not' && goal.children.length === 1) {
      const hasSolution = !solve([goal.children[0]], subst, { cut: false }).next().done;
      if (!hasSolution) yield* solve(rest, subst, cutFlag);
      return;
    }

    const key = predKey(goal.value, goal.children.length);

    // ── Builtin — leaf call, no recursion
    const builtin = builtins.get(key);
    if (builtin) {
      const result = builtin(goal.children, subst);
      if (result !== null) yield* solve(rest, result, cutFlag);
      return;
    }

    // ── User-defined predicate
    const clauses = db.get(key);
    if (!clauses) throw new Error(`Undefined predicate: ${key}`);

    const bodyCutFlag = { cut: false };
    for (const clause of clauses) {
      const fresh = freshenClause(clause, freshCounter);
      const s = unifyArgs(goal.children, fresh.headArgs, subst);
      if (s === null) continue;

      // Resolve body separately, then continuation
      bodyCutFlag.cut = false;
      for (const bodySubst of solve(fresh.body, s, bodyCutFlag)) {
        yield* solve(rest, bodySubst, cutFlag);
      }
      if (bodyCutFlag.cut) break;
    }
  }

  return (goals) => {
    stepCounter.count = 0;
    return solve(goals, new Map(), { cut: false });
  };
};

// ── Query execution ────────────────────────────────────────────

const collectQueryVars = (goals) => {
  const vars = [];
  const seen = new Set();
  const walk = (term) => {
    if (isVar(term) && !term.value.var.startsWith('_') && !seen.has(term.value.var)) {
      seen.add(term.value.var);
      vars.push(term.value.var);
    }
    term.children.forEach(walk);
  };
  goals.forEach(g => g.children.forEach(walk));
  return vars;
};

const formatSolution = (queryVars, subst) => {
  if (queryVars.length === 0) return '  true';
  const bindings = [];
  for (const v of queryVars) {
    const val = deepDeref(node({ var: v }), subst);
    if (!isVar(val) || val.value.var !== v) {
      bindings.push(`${v} = ${formatTerm(val)}`);
    }
  }
  return bindings.length > 0 ? `  ${bindings.join(', ')}` : '  true';
};

const executeQuery = (query, solve, logFn) => {
  const queryVars = collectQueryVars(query.goals);
  logFn(`?- ${formatGoals(query.goals)}`);

  try {
    let count = 0;
    for (const subst of solve(query.goals)) {
      count++;
      logFn(formatSolution(queryVars, subst));
    }
    logFn(count === 0 ? '  false' : `  ${count} solution${count !== 1 ? 's' : ''}.`);
  } catch (e) {
    const msg = e instanceof RangeError
      ? 'Search too deep — possible infinite recursion (stack overflow)'
      : e.message;
    logFn(`  Error: ${msg}`);
  }

  logFn('');
};

// ── Standard library (Markdown Prolog loaded before user code) ─

const STDLIB = `
# append
* [], L, L
* [H | T], L, [H | R]
  * append T, L, R

# member
* X, [X | _]
* X, [_ | T]
  * member X, T

# length
* [], \`0\`
* [_ | T], N
  * length T, N1
  * is N, +( N1, \`1\`)
`;

// ── Runner ─────────────────────────────────────────────────────

const runMarkdownIsAPrologue = (code, logFn) => {
  const entries = parseMarkdown(STDLIB + '\n' + code);
  const { db, queries } = buildDatabase(entries);
  const builtins = makeBuiltins(logFn);
  const solve = makeSolver(db, builtins, 10000);

  if (queries.length === 0) {
    logFn('No queries found. Add a # ? section with goals.');
    return;
  }

  queries.forEach(q => executeQuery(q, solve, logFn));
};
