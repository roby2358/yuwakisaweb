// Compiler — walk the parsed AST and build Z3 expressions via the
// z3-solver direct API (Context builders and expression methods).
// Never produces an SMT-LIB string. Sort correctness is checked before
// any solver call.
//
// A "typed expression" here is a plain object: { expr, sort } — where
// `expr` is a Z3 expression from the Context and `sort` is one of
// 'Int' | 'Real' | 'Bool' | 'String'.

const ARITH_SORTS = new Set(['Int', 'Real']);

const numericResultSort = (a, b) => (a === 'Real' || b === 'Real') ? 'Real' : 'Int';

const expectSort = (typed, expected, opLabel) => {
  if (typed.sort !== expected) {
    throw new Error(`Operator '${opLabel}' expects ${expected}, got ${typed.sort}`);
  }
};

const expectArith = (typed, opLabel) => {
  if (!ARITH_SORTS.has(typed.sort)) {
    throw new Error(`Operator '${opLabel}' expects Int or Real, got ${typed.sort}`);
  }
};

const expectSameSort = (args, opLabel) => {
  const first = args[0].sort;
  for (const a of args) {
    if (a.sort !== first) {
      throw new Error(`Operator '${opLabel}' expects all arguments of the same sort; got ${args.map(x => x.sort).join(', ')}`);
    }
  }
};

const expectArity = (op, args, expected) => {
  if (args.length !== expected) {
    throw new Error(`Operator '${op}' expects ${expected} argument${expected === 1 ? '' : 's'}, got ${args.length}`);
  }
};

const expectArityAtLeast = (op, args, expected) => {
  if (args.length < expected) {
    throw new Error(`Operator '${op}' expects at least ${expected} arguments, got ${args.length}`);
  }
};

const makeConstant = (ctx, name, sort) => {
  switch (sort) {
    case 'Int':    return ctx.Int.const(name);
    case 'Real':   return ctx.Real.const(name);
    case 'Bool':   return ctx.Bool.const(name);
    case 'String': return ctx.String.const(name);
    default: throw new Error(`Unknown sort '${sort}'`);
  }
};

const liftLiteral = (ctx, lit, sort) => {
  switch (sort) {
    case 'Int':    return { expr: ctx.Int.val(lit),    sort };
    case 'Real':   return { expr: ctx.Real.val(lit),   sort };
    case 'Bool':   return { expr: ctx.Bool.val(lit),   sort };
    case 'String': return { expr: ctx.String.val(lit), sort };
    default: throw new Error(`Unknown literal sort '${sort}'`);
  }
};

// Promote Int to Real for mixed arithmetic.
const promoteNumeric = (ctx, typed, targetSort) => {
  if (typed.sort === targetSort) return typed;
  if (typed.sort === 'Int' && targetSort === 'Real') {
    return { expr: ctx.ToReal(typed.expr), sort: 'Real' };
  }
  throw new Error(`Cannot promote ${typed.sort} to ${targetSort}`);
};

// Bring two typed expressions to a common sort. Identical sorts pass through;
// mixed Int/Real get promoted to Real. Returns null when sorts differ and
// can't be unified, so callers can raise an op-specific error.
const unifySorts = (ctx, a, b) => {
  if (a.sort === b.sort) return { a, b, sort: a.sort };
  if (ARITH_SORTS.has(a.sort) && ARITH_SORTS.has(b.sort)) {
    const sort = numericResultSort(a.sort, b.sort);
    return { a: promoteNumeric(ctx, a, sort), b: promoteNumeric(ctx, b, sort), sort };
  }
  return null;
};

// Build a binary arithmetic operation using expression methods.
// Callers must supply exactly two typed args; arity is validated here.
const binaryArith = (ctx, opLabel, args, method) => {
  expectArity(opLabel, args, 2);
  const [a, b] = args;
  expectArith(a, opLabel);
  expectArith(b, opLabel);
  const sort = numericResultSort(a.sort, b.sort);
  const la = promoteNumeric(ctx, a, sort);
  const lb = promoteNumeric(ctx, b, sort);
  return { expr: la.expr[method](lb.expr), sort };
};

const foldArith = (ctx, args, method, opLabel) => {
  for (const a of args) expectArith(a, opLabel);
  const sort = args.reduce((acc, a) => numericResultSort(acc, a.sort), 'Int');
  const lifted = args.map(a => promoteNumeric(ctx, a, sort));
  return {
    expr: lifted.slice(1).reduce((acc, next) => acc[method](next.expr), lifted[0].expr),
    sort,
  };
};

// Build a binary comparison (always yields Bool). Arity is validated here.
const binaryCompare = (ctx, opLabel, args, method) => {
  expectArity(opLabel, args, 2);
  const [a, b] = args;
  expectArith(a, opLabel);
  expectArith(b, opLabel);
  const sort = numericResultSort(a.sort, b.sort);
  const la = promoteNumeric(ctx, a, sort);
  const lb = promoteNumeric(ctx, b, sort);
  return { expr: la.expr[method](lb.expr), sort: 'Bool' };
};

// Shared guard for binary boolean operators (implies, iff).
const expectBinaryBool = (op, args) => {
  expectArity(op, args, 2);
  expectSort(args[0], 'Bool', op);
  expectSort(args[1], 'Bool', op);
};

// Shared builder for n-ary boolean operators (and, or).
const buildBoolNary = (ctx, op, method, args) => {
  expectArityAtLeast(op, args, 1);
  for (const a of args) expectSort(a, 'Bool', op);
  return { expr: ctx[method](...args.map(a => a.expr)), sort: 'Bool' };
};

const buildOp = (ctx, op, args) => {
  switch (op) {
    case 'and':  return buildBoolNary(ctx, 'and', 'And', args);
    case 'or':   return buildBoolNary(ctx, 'or',  'Or',  args);
    case 'not': {
      expectArity('not', args, 1);
      expectSort(args[0], 'Bool', 'not');
      return { expr: ctx.Not(args[0].expr), sort: 'Bool' };
    }
    case 'implies': {
      expectBinaryBool('implies', args);
      return { expr: ctx.Implies(args[0].expr, args[1].expr), sort: 'Bool' };
    }
    case 'iff': {
      expectBinaryBool('iff', args);
      return { expr: args[0].expr.eq(args[1].expr), sort: 'Bool' };
    }
    case 'ite': {
      expectArity('ite', args, 3);
      expectSort(args[0], 'Bool', 'ite');
      const [cond, t, e] = args;
      const u = unifySorts(ctx, t, e);
      if (!u) throw new Error(`Operator 'ite' branches must have the same sort; got ${t.sort} and ${e.sort}`);
      return { expr: ctx.If(cond.expr, u.a.expr, u.b.expr), sort: u.sort };
    }
    case '=': {
      expectArity('=', args, 2);
      const u = unifySorts(ctx, args[0], args[1]);
      if (!u) throw new Error(`Operator '=' expects matching sorts; got ${args[0].sort} and ${args[1].sort}`);
      return { expr: u.a.expr.eq(u.b.expr), sort: 'Bool' };
    }
    case 'distinct': {
      expectArityAtLeast('distinct', args, 2);
      expectSameSort(args, 'distinct');
      return { expr: ctx.Distinct(...args.map(a => a.expr)), sort: 'Bool' };
    }
    case '+':  return foldArith(ctx, args, 'add', '+');
    case '-': {
      if (args.length === 1) {
        expectArith(args[0], '-');
        return { expr: args[0].expr.neg(), sort: args[0].sort };
      }
      return binaryArith(ctx, '-', args, 'sub');
    }
    case '*':  return foldArith(ctx, args, 'mul', '*');
    case '/':  return binaryArith(ctx, '/', args, 'div');
    case 'mod': {
      expectArity('mod', args, 2);
      expectSort(args[0], 'Int', 'mod');
      expectSort(args[1], 'Int', 'mod');
      return { expr: args[0].expr.mod(args[1].expr), sort: 'Int' };
    }
    case '<':  return binaryCompare(ctx, '<',  args, 'lt');
    case '<=': return binaryCompare(ctx, '<=', args, 'le');
    case '>':  return binaryCompare(ctx, '>',  args, 'gt');
    case '>=': return binaryCompare(ctx, '>=', args, 'ge');
    default:
      throw new Error(`Unknown operator '${op}'`);
  }
};

const compileTerm = (node, ctx, env) => {
  const v = node.value;
  if ('name' in v) {
    const entry = env.get(v.name);
    if (!entry) throw new Error(`Undeclared symbol '${v.name}'`);
    return entry;
  }
  if ('lit' in v) {
    return liftLiteral(ctx, v.lit, v.sort);
  }
  if ('op' in v) {
    const args = node.children.map(child => compileTerm(child, ctx, env));
    return buildOp(ctx, v.op, args);
  }
  throw new Error(`Unknown node shape: ${JSON.stringify(v)}`);
};

// Compile the parsed program against a fresh Z3 context.
// Returns { solver, env, labels } — caller invokes solver.check() / .model() / .unsatCore().
// `labels` maps each tracking constant name to the human-readable source text of
// the assertion it guards, so an unsat core can be rendered as the set of rules
// (or JSON facts) that conflict.
export const compile = (program, ctx) => {
  const env = new Map();
  const solver = new ctx.Solver();
  const labels = new Map();

  const track = (source, expr) => {
    const label = `_a${labels.size}`;
    labels.set(label, source);
    solver.addAndTrack(expr, label);
  };

  for (const d of program.declarations) {
    env.set(d.name, { expr: makeConstant(ctx, d.name, d.sort), sort: d.sort });
  }

  // JSON-derived constants: track-assert equality to their literal value.
  for (const d of program.declarations) {
    if (d.origin !== 'json') continue;
    const lhs = env.get(d.name);
    const rhs = liftLiteral(ctx, d.value, d.sort);
    track(`${d.name} = ${JSON.stringify(d.value)}`, lhs.expr.eq(rhs.expr));
  }

  // Markdown assertions — one tracking constant per top-level `assert` bullet.
  for (const a of program.assertions) {
    const typed = compileTerm(a.node, ctx, env);
    if (typed.sort !== 'Bool') {
      throw new Error(`Assertion must be Bool, got ${typed.sort}`);
    }
    track(a.source, typed.expr);
  }

  return { solver, env, labels };
};
