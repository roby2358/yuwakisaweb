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

  function run(program, out) {
    var fns = {};
    program.items.forEach(function (it) {
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
    callFn(fns.main, [], fns, out);
  }

  function callFn(fn, args, fns, out) {
    var env = {};
    fn.params.forEach(function (p, i) { env[p] = args[i]; });
    var result;
    for (var i = 0; i < fn.body.length; i++) result = evalNode(fn.body[i], env, fns, out);
    return result;
  }

  function evalNode(node, env, fns, out) {
    var v = node.value, c = node.children;
    if (isLit(v)) return litVal(v);
    if (v === 'let') return doLet(node, env, fns, out);
    if (v === 'return') return c[0] ? evalNode(c[0], env, fns, out) : undefined;
    if (v === '&' || v === '&mut') return evalNode(c[0], env, fns, out); // ref == underlying value
    if (BINOPS[v]) return BINOPS[v](n(c[0], env, fns, out), n(c[1], env, fns, out));
    if (v === 'and') return !!evalNode(c[0], env, fns, out) && !!evalNode(c[1], env, fns, out);
    if (v === 'or') return !!evalNode(c[0], env, fns, out) || !!evalNode(c[1], env, fns, out);
    if (v === 'not') return !evalNode(c[0], env, fns, out);
    if (v === 'if') {
      return evalNode(c[0], env, fns, out)
        ? evalNode(c[1], env, fns, out)
        : (c[2] ? evalNode(c[2], env, fns, out) : undefined);
    }
    if (v === 'vec') return c.map(function (x) { return evalNode(x, env, fns, out); });
    if (v === 'push') { env[c[0].value].push(evalNode(c[1], env, fns, out)); return undefined; }
    if (v === 'print') { out(format(evalNode(c[0], env, fns, out))); return undefined; }
    if (fns[v]) {
      var a = c.map(function (x) { return evalNode(x, env, fns, out); });
      return callFn(fns[v], a, fns, out);
    }
    if (c.length === 0) return env[v];
    return undefined;
  }

  function n(node, env, fns, out) { return evalNode(node, env, fns, out); }

  function doLet(node, env, fns, out) {
    var kids = node.children.slice();
    if (kids.length && kids[0].value === 'mut') kids = kids.slice(1);
    var name = kids[0].value;
    kids = kids.slice(1);
    if (kids.length && kids[0].value === '=') kids = kids.slice(1);
    // The checker requires a single-expression initializer (a compound goes on a
    // sub-bullet), so there is at most one child here.
    var val = kids.length ? evalNode(kids[0], env, fns, out) : undefined;
    env[name] = val;
    return undefined;
  }

  global.MIAR = global.MIAR || {};
  global.MIAR.run = run;
  global.MIAR.format = format;
})(typeof globalThis !== 'undefined' ? globalThis : this);
