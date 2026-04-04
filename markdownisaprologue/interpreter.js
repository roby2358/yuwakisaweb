/**
 * MarkdownIsAPrologue — Phase 1 Interpreter
 *
 * Same { value, children } node shape as MIAL.
 * Immutable substitution maps — no trailing, no mutation.
 * Generator-based solver for backtracking.
 */

// ── Nodes & helpers ────────────────────────────────────────────

const node = (value, children) => ({ value, children: children || [] });

const isVar = (n) =>
  n && typeof n.value === 'object' && n.value !== null && 'var' in n.value;

// ── Parser ─────────────────────────────────────────────────────

const getIndentLevel = (line) => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  return Math.floor(match[1].replace(/\t/g, '  ').length / 2);
};

const parseTerm = (text, anonCounter) => {
  text = text.trim();
  if (!text) return null;

  const litMatch = text.match(/^`([^`]*)`$/);
  if (litMatch) {
    const val = litMatch[1];
    if (/^-?\d+(\.\d+)?$/.test(val)) return node(Number(val));
    return node(val);
  }

  if (text === '_') return node({ var: `_anon${anonCounter.count++}` });

  if ((text[0] >= 'A' && text[0] <= 'Z') ||
      (text[0] === '_' && text.length > 1)) {
    return node({ var: text });
  }

  return node(text);
};

const parseArgList = (text, anonCounter) => {
  const args = [];
  let current = '';
  let inBacktick = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '`') {
      inBacktick = !inBacktick;
      current += ch;
    } else if (ch === ',' && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) args.push(parseTerm(trimmed, anonCounter));
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) args.push(parseTerm(trimmed, anonCounter));

  return args.filter(a => a !== null);
};

const parseGoal = (text, anonCounter) => {
  text = text.trim();
  const spaceIdx = text.indexOf(' ');
  if (spaceIdx === -1) return node(text);
  const predName = text.slice(0, spaceIdx);
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
    body: clause.body.map(g => node(g.value, g.children.map(f)))
  };
};

// ── Term formatting ────────────────────────────────────────────

const formatTerm = (term) => {
  if (isVar(term)) {
    const name = term.value.var;
    const idx = name.indexOf('__');
    return idx >= 0 ? name.slice(0, idx) : name;
  }
  if (typeof term.value === 'number') return String(term.value);
  if (term.children.length === 0) return String(term.value);
  return `${term.value}(${term.children.map(formatTerm).join(', ')})`;
};

const formatGoals = (goals) =>
  goals.map(g =>
    g.children.length === 0
      ? g.value
      : `${g.value}(${g.children.map(formatTerm).join(', ')})`
  ).join(', ');

// ── Database ───────────────────────────────────────────────────

const buildDatabase = (entries) => {
  const db = new Map();
  const queries = [];

  for (const entry of entries) {
    if (entry.name === '?') {
      queries.push(...entry.clauses);
      continue;
    }
    for (const clause of entry.clauses) {
      const key = `${entry.name}/${clause.headArgs.length}`;
      if (!db.has(key)) db.set(key, []);
      db.get(key).push(clause);
    }
  }

  return { db, queries };
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
    const term = deref(args[0], subst);
    return (typeof term.value === 'string' && term.children.length === 0)
      ? subst : null;
  });

  builtins.set('number/1', (args, subst) => {
    const term = deref(args[0], subst);
    return typeof term.value === 'number' ? subst : null;
  });

  builtins.set('var/1', (args, subst) => {
    return isVar(deref(args[0], subst)) ? subst : null;
  });

  builtins.set('nonvar/1', (args, subst) => {
    return !isVar(deref(args[0], subst)) ? subst : null;
  });

  return builtins;
};

// ── Solver ─────────────────────────────────────────────────────

const makeSolver = (db, builtins, stepLimit) => {
  const freshCounter = { count: 0 };
  const stepCounter = { count: 0 };

  function* solve(goals, subst) {
    stepCounter.count++;
    if (stepCounter.count > stepLimit) {
      throw new Error(`Step limit exceeded (${stepLimit} resolution steps)`);
    }

    if (goals.length === 0) { yield subst; return; }

    const [goal, ...rest] = goals;
    const key = `${goal.value}/${goal.children.length}`;

    // Builtin — plain function, no recursion into solve
    const builtin = builtins.get(key);
    if (builtin) {
      const result = builtin(goal.children, subst);
      if (result !== null) yield* solve(rest, result);
      return;
    }

    // User-defined clauses
    const clauses = db.get(key);
    if (!clauses) throw new Error(`Undefined predicate: ${key}`);

    for (const clause of clauses) {
      const fresh = freshenClause(clause, freshCounter);
      const s = unifyArgs(goal.children, fresh.headArgs, subst);
      if (s === null) continue;
      yield* solve([...fresh.body, ...rest], s);
    }
  }

  // Returns generator, resets step counter per call
  return (goals) => {
    stepCounter.count = 0;
    return solve(goals, new Map());
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

// ── Runner ─────────────────────────────────────────────────────

const runMarkdownIsAPrologue = (code, logFn) => {
  const entries = parseMarkdown(code);
  const { db, queries } = buildDatabase(entries);
  const builtins = makeBuiltins(logFn);
  const solve = makeSolver(db, builtins, 10000);

  if (queries.length === 0) {
    logFn('No queries found. Add a # ? section with goals.');
    return;
  }

  queries.forEach(q => executeQuery(q, solve, logFn));
};
