/**
 * MarkdownIsAPrologue — Phase 1 Interpreter
 *
 * Same { value, children } node shape as MIAL.
 * Immutable substitution maps — no trailing, no mutation.
 * Generator-based solver for backtracking.
 */

// ── Nodes ──────────────────────────────────────────────────────

const node = (value, children) => ({ value, children: children || [] });

// ── Term helpers ───────────────────────────────────────────────

const isVar = (n) =>
  n && typeof n.value === 'object' && n.value !== null && 'var' in n.value;

// ── Parser ─────────────────────────────────────────────────────

const getIndentLevel = (line) => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  return Math.floor(match[1].replace(/\t/g, '  ').length / 2);
};

let anonCount = 0;

const parseTerm = (text) => {
  text = text.trim();
  if (!text) return null;

  // Backtick literal
  const litMatch = text.match(/^`([^`]*)`$/);
  if (litMatch) {
    const val = litMatch[1];
    if (/^-?\d+(\.\d+)?$/.test(val)) return node(Number(val));
    return node(val);
  }

  // Anonymous variable
  if (text === '_') return node({ var: `_anon${anonCount++}` });

  // Named variable (uppercase or _prefix)
  if ((text[0] >= 'A' && text[0] <= 'Z') ||
      (text[0] === '_' && text.length > 1)) {
    return node({ var: text });
  }

  // Bare lowercase atom
  return node(text);
};

const parseArgList = (text) => {
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
      if (trimmed) args.push(parseTerm(trimmed));
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) args.push(parseTerm(trimmed));

  return args.filter(a => a !== null);
};

const parseGoal = (text) => {
  text = text.trim();
  // First word is predicate name, rest are comma-separated args
  const spaceIdx = text.indexOf(' ');
  if (spaceIdx === -1) return node(text); // zero-arity goal
  const predName = text.slice(0, spaceIdx);
  const args = parseArgList(text.slice(spaceIdx + 1));
  return node(predName, args);
};

const parseMarkdown = (input) => {
  anonCount = 0;
  const lines = input.split('\n');
  const entries = [];
  let current = null;
  let currentClause = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heading → predicate or query section
    if (trimmed.startsWith('#')) {
      const name = trimmed.replace(/^#+\s*/, '').trim();
      current = { name, clauses: [] };
      entries.push(current);
      currentClause = null;
      continue;
    }

    if (!current) continue;
    if (!(trimmed.startsWith('*') || trimmed.startsWith('-'))) continue;

    const indent = getIndentLevel(line);
    const content = trimmed.replace(/^[-*]\s*/, '');

    if (indent === 0) {
      // Top-level bullet
      if (current.name === '?') {
        // Query goal
        const goal = parseGoal(content);
        currentClause = { goals: [goal] };
        current.clauses.push(currentClause);
      } else {
        // Clause head arguments
        const headArgs = content ? parseArgList(content) : [];
        currentClause = { headArgs, body: [] };
        current.clauses.push(currentClause);
      }
    } else if (currentClause) {
      // Sub-bullet → body goal or additional query goal
      const goal = parseGoal(content);
      if (current.name === '?') {
        currentClause.goals.push(goal);
      } else {
        currentClause.body.push(goal);
      }
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

  // Same variable
  if (isVar(t1) && isVar(t2) && t1.value.var === t2.value.var) return subst;

  // Bind variable
  if (isVar(t1)) return new Map(subst).set(t1.value.var, t2);
  if (isVar(t2)) return new Map(subst).set(t2.value.var, t1);

  // Both non-variables: must match functor and arity
  if (t1.value !== t2.value) return null;
  if (t1.children.length !== t2.children.length) return null;

  let s = subst;
  for (let i = 0; i < t1.children.length; i++) {
    s = unify(t1.children[i], t2.children[i], s);
    if (s === null) return null;
  }
  return s;
};

// ── Variable freshening ────────────────────────────────────────

let freshCount = 0;

const freshenClause = (clause) => {
  const id = freshCount++;
  const mapping = new Map();

  const freshen = (term) => {
    if (isVar(term)) {
      const name = term.value.var;
      if (!mapping.has(name)) mapping.set(name, `${name}__${id}`);
      return node({ var: mapping.get(name) });
    }
    if (term.children.length === 0) return term;
    return node(term.value, term.children.map(freshen));
  };

  return {
    headArgs: clause.headArgs.map(freshen),
    body: clause.body.map(g => node(g.value, g.children.map(freshen)))
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
  if (typeof term.value === 'string' && term.children.length === 0) return term.value;
  if (term.children.length > 0) {
    return `${term.value}(${term.children.map(formatTerm).join(', ')})`;
  }
  return String(term.value);
};

// ── Runner ─────────────────────────────────────────────────────

const runMarkdownIsAPrologue = (code, logFn) => {
  anonCount = 0;
  freshCount = 0;

  // ── Parse ──────────────────────────────────────────────────
  const entries = parseMarkdown(code);

  // ── Build database ─────────────────────────────────────────
  const db = new Map();
  const queryEntries = [];

  for (const entry of entries) {
    if (entry.name === '?') {
      queryEntries.push(...entry.clauses);
      continue;
    }
    for (const clause of entry.clauses) {
      const key = `${entry.name}/${clause.headArgs.length}`;
      if (!db.has(key)) db.set(key, []);
      db.get(key).push(clause);
    }
  }

  // ── Step counter ───────────────────────────────────────────
  const step = { count: 0, limit: 10000 };

  // ── Builtins ───────────────────────────────────────────────
  const builtins = new Map();

  builtins.set('true/0', function*(args, subst, rest) {
    yield* solve(rest, subst);
  });

  builtins.set('fail/0', function*() {
    // yields nothing — goal fails
  });

  builtins.set('=/2', function*(args, subst, rest) {
    const s = unify(args[0], args[1], subst);
    if (s !== null) yield* solve(rest, s);
  });

  builtins.set('\\=/2', function*(args, subst, rest) {
    const s = unify(args[0], args[1], subst);
    if (s === null) yield* solve(rest, subst);
  });

  builtins.set('write/1', function*(args, subst, rest) {
    const term = deepDeref(args[0], subst);
    logFn(formatTerm(term));
    yield* solve(rest, subst);
  });

  builtins.set('nl/0', function*(args, subst, rest) {
    logFn('');
    yield* solve(rest, subst);
  });

  builtins.set('atom/1', function*(args, subst, rest) {
    const term = deref(args[0], subst);
    if (typeof term.value === 'string' && term.children.length === 0) {
      yield* solve(rest, subst);
    }
  });

  builtins.set('number/1', function*(args, subst, rest) {
    const term = deref(args[0], subst);
    if (typeof term.value === 'number') {
      yield* solve(rest, subst);
    }
  });

  builtins.set('var/1', function*(args, subst, rest) {
    const term = deref(args[0], subst);
    if (isVar(term)) yield* solve(rest, subst);
  });

  builtins.set('nonvar/1', function*(args, subst, rest) {
    const term = deref(args[0], subst);
    if (!isVar(term)) yield* solve(rest, subst);
  });

  // ── Solver ─────────────────────────────────────────────────

  function* solve(goals, subst) {
    step.count++;
    if (step.count > step.limit) {
      throw new Error(`Step limit exceeded (${step.limit} resolution steps)`);
    }

    if (goals.length === 0) {
      yield subst;
      return;
    }

    const [goal, ...rest] = goals;
    const predName = goal.value;
    const arity = goal.children.length;

    // Check builtins first
    const builtin = builtins.get(`${predName}/${arity}`);
    if (builtin) {
      yield* builtin(goal.children, subst, rest);
      return;
    }

    // User-defined clauses
    const clauses = db.get(`${predName}/${arity}`);
    if (!clauses) {
      throw new Error(`Undefined predicate: ${predName}/${arity}`);
    }

    for (const clause of clauses) {
      const fresh = freshenClause(clause);

      // Unify goal args with clause head args
      let s = subst;
      let failed = false;
      for (let i = 0; i < arity; i++) {
        s = unify(goal.children[i], fresh.headArgs[i], s);
        if (s === null) { failed = true; break; }
      }
      if (failed) continue;

      // Resolve body goals then remaining goals
      yield* solve([...fresh.body, ...rest], s);
    }
  }

  // ── Execute queries ────────────────────────────────────────

  if (queryEntries.length === 0) {
    logFn('No queries found. Add a # ? section with goals.');
    return;
  }

  for (const query of queryEntries) {
    step.count = 0;

    // Collect query variable names (skip anonymous)
    const queryVars = [];
    const seen = new Set();
    const collectVars = (term) => {
      if (isVar(term)) {
        const name = term.value.var;
        if (!name.startsWith('_') && !seen.has(name)) {
          seen.add(name);
          queryVars.push(name);
        }
      }
      term.children.forEach(collectVars);
    };
    query.goals.forEach(g => {
      g.children.forEach(collectVars);
    });

    // Format query for display
    const queryStr = query.goals.map(g => {
      if (g.children.length === 0) return g.value;
      return `${g.value}(${g.children.map(formatTerm).join(', ')})`;
    }).join(', ');
    logFn(`?- ${queryStr}`);

    try {
      let count = 0;
      for (const subst of solve(query.goals, new Map())) {
        count++;
        if (queryVars.length === 0) {
          logFn('  true');
        } else {
          const bindings = [];
          for (const v of queryVars) {
            const val = deepDeref(node({ var: v }), subst);
            if (!isVar(val) || val.value.var !== v) {
              bindings.push(`${v} = ${formatTerm(val)}`);
            }
          }
          logFn(bindings.length > 0 ? `  ${bindings.join(', ')}` : '  true');
        }
      }

      if (count === 0) {
        logFn('  false');
      }
      logFn(`  ${count} solution${count !== 1 ? 's' : ''}.`);
    } catch (e) {
      const msg = e instanceof RangeError
        ? 'Search too deep — possible infinite recursion (stack overflow)'
        : e.message;
      logFn(`  Error: ${msg}`);
    }

    logFn('');
  }
};
