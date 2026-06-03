// runner.js — executes a program the checker has already accepted.
//
// The checker guarantees ownership/borrow safety, so the runner is deliberately
// naive: references are just the underlying value, and moves need no enforcement.
// Its only job is to show that accepted programs mean something.

(function (global) {
  'use strict';

  function isLit(v) { return typeof v === 'string' && v.length >= 2 && v[0] === '`' && v[v.length - 1] === '`'; }
  function litVal(v) {
    var s = v.slice(1, -1);
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s[0] === '"') return s.slice(1, -1);
    return s;
  }
  function format(val) {
    if (val && typeof val === 'object' && 'struct' in val) {
      var fs = Object.keys(val.fields).map(function (k) { return k + ': ' + format(val.fields[k]); });
      return val.struct + ' { ' + fs.join(', ') + ' }';
    }
    if (val && typeof val === 'object' && 'tag' in val) {
      return val.payload === undefined ? val.tag : val.tag + '(' + format(val.payload) + ')';
    }
    if (Array.isArray(val)) return '[' + val.map(format).join(', ') + ']';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (val === undefined || val === null) return '()';
    return String(val);
  }

  // Binary operators share one shape: eval both operands, then combine. `and`/`or`
  // are NOT here — they short-circuit and so stay explicit in evalNode.
  var BINOPS = {
    '+':  function (a, b) { return a + b; },
    '-':  function (a, b) { return a - b; },
    '*':  function (a, b) { return a * b; },
    '/':  function (a, b) { return Math.trunc(a / b); },
    '%':  function (a, b) { return a % b; },
    '<':  function (a, b) { return a < b; },
    '<=': function (a, b) { return a <= b; },
    '>':  function (a, b) { return a > b; },
    '>=': function (a, b) { return a >= b; },
    '==': function (a, b) { return a === b; },
    '!=': function (a, b) { return a !== b; }
  };

  // The eval helpers close over the program's tables (fns, variants) and the
  // output sink, so they take only (node, env) — no per-call plumbing.
  function run(program, out) {
    var fns = {};
    var variants = {}; // VariantName -> { arity: 0 | 1 }
    var structs = {};  // Name -> { order: [field...] }
    program.items.forEach(function (it) {
      if (it.kind === 'enum') {
        it.bullets.forEach(function (b) { variants[b.value] = { arity: b.children.length ? 1 : 0 }; });
        return;
      }
      if (it.kind === 'struct') {
        structs[it.name] = { order: it.bullets.map(function (b) { return b.value; }) };
        return;
      }
      if (it.kind !== 'fn') return;
      var params = [], body = [];
      it.bullets.forEach(function (b) {
        if (b.value === 'params') b.children.forEach(function (p) { params.push(p.value); });
        else if (b.value === 'returns') { /* signature only */ }
        else body.push(b);
      });
      fns[it.name] = { params: params, body: body };
    });
    if (!fns.main) { out('(no main)'); return; }
    callFn(fns.main, []);

    function callFn(fn, args) {
      var env = {};
      fn.params.forEach(function (p, i) { env[p] = args[i]; });
      var result;
      for (var i = 0; i < fn.body.length; i++) result = evalNode(fn.body[i], env);
      return result;
    }

    function evalNode(node, env) {
      var v = node.value, c = node.children;
      if (isLit(v)) return litVal(v);
      if (v === 'let') return doLet(node, env);
      if (v === 'return') return c[0] ? evalNode(c[0], env) : undefined;
      if (v === '&' || v === '&mut') return evalNode(c[0], env); // ref == underlying value
      if (BINOPS[v]) return BINOPS[v](evalNode(c[0], env), evalNode(c[1], env));
      if (v === 'and') return !!evalNode(c[0], env) && !!evalNode(c[1], env);
      if (v === 'or') return !!evalNode(c[0], env) || !!evalNode(c[1], env);
      if (v === 'not') return !evalNode(c[0], env);
      if (v === 'if') return evalNode(c[0], env) ? evalNode(c[1], env) : (c[2] ? evalNode(c[2], env) : undefined);
      if (v === 'match') return doMatch(node, env);
      if (v === '.') return evalNode(c[0], env).fields[c[1].value];
      if (v === 'vec') return c.map(function (x) { return evalNode(x, env); });
      if (v === 'push') { env[c[0].value].push(evalNode(c[1], env)); return undefined; }
      if (v === 'print') { out(format(evalNode(c[0], env))); return undefined; }
      if (variants[v]) return { tag: v, payload: variants[v].arity ? evalNode(c[0], env) : undefined };
      if (structs[v]) return buildStruct(v, c, env);
      if (fns[v]) return callFn(fns[v], c.map(function (x) { return evalNode(x, env); }));
      if (c.length === 0) return env[v];
      return undefined;
    }

    function doLet(node, env) {
      var kids = node.children.slice();
      if (kids.length && kids[0].value === 'mut') kids = kids.slice(1);
      var name = kids[0].value;
      kids = kids.slice(1);
      if (kids.length && kids[0].value === '=') kids = kids.slice(1);
      // The checker requires a single-expression initializer (a compound goes on a
      // sub-bullet), so there is at most one child here.
      env[name] = kids.length ? evalNode(kids[0], env) : undefined;
      return undefined;
    }

    // Build a struct value: positional field args in declaration order, tagged
    // with the type name so format() can render `Name { f: v, ... }`.
    function buildStruct(name, args, env) {
      var fields = {};
      structs[name].order.forEach(function (f, i) { fields[f] = evalNode(args[i], env); });
      return { struct: name, fields: fields };
    }

    // Select the arm matching the scrutinee's tag (or `_`), bind any payload into
    // an arm-local env, and evaluate the arm body. The checker has already proven
    // some arm matches, so a fallthrough should not happen for accepted programs.
    function doMatch(node, env) {
      var scrutVal = evalNode(node.children[0], env); // tagged value { tag, payload }
      var arms = node.children.slice(1);
      for (var i = 0; i < arms.length; i++) {
        var arm = arms[i];
        if (arm.value !== '_' && arm.value !== scrutVal.tag) continue;
        var armEnv = Object.create(env); // arm-local bindings over the outer env
        var bodyStart = 0;
        if (arm.value !== '_' && variants[arm.value] && variants[arm.value].arity) {
          armEnv[arm.children[0].value] = scrutVal.payload;
          bodyStart = 1;
        }
        var result;
        for (var j = bodyStart; j < arm.children.length; j++) result = evalNode(arm.children[j], armEnv);
        return result;
      }
      return undefined;
    }
  }

  global.MIAR = global.MIAR || {};
  global.MIAR.run = run;
  global.MIAR.format = format;
})(typeof globalThis !== 'undefined' ? globalThis : this);
