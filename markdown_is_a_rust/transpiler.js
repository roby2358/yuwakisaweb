// transpiler.js — MIAR AST -> Rust source, for display alongside the result.
//
// Purely syntactic: it runs on Run regardless of whether the checker accepted
// the program. A rejected program (e.g. the litmus borrow conflict) still
// transpiles — and the Rust it produces is the same code real `rustc` would
// reject for the same reason, which is the point. This is a pretty-printer, not
// a compiler; it leans on the parser's structure and does no analysis.

(function (global) {
  'use strict';

  var IND = '    '; // Rust convention: 4 spaces

  function isLit(v) { return typeof v === 'string' && v.length >= 2 && v[0] === '`' && v[v.length - 1] === '`'; }

  // A backtick literal -> a Rust literal. Integers and bools pass through; any
  // other text is a String, emitted as `"...".to_string()` to match its type.
  function lit(v) {
    var inner = v.slice(1, -1);
    if (/^-?\d+$/.test(inner)) return inner;
    if (inner === 'true' || inner === 'false') return inner;
    var text = inner[0] === '"' ? inner.slice(1, -1) : inner;
    return JSON.stringify(text) + '.to_string()';
  }

  // Tokens (the &/&mut chain plus one base type) -> a parsed type, mirroring the
  // checker's parseTypeTokens.
  function parseType(toks) {
    if (!toks.length) return 'Unit';
    if (toks[0] === '&' || toks[0] === '&mut') {
      return { ref: true, mut: toks[0] === '&mut', to: parseType(toks.slice(1)) };
    }
    return toks[0];
  }
  function rustType(t) {
    if (typeof t === 'string') {
      if (t === 'Vec') return 'Vec<i64>'; // v1 vectors are always i64
      if (t === 'Unit') return '()';
      return t; // i64 / bool / String / user type names pass through
    }
    if (t && t.ref) return '&' + (t.mut ? 'mut ' : '') + rustType(t.to);
    return String(t);
  }

  // A declaration is prefix `Type name [name...]` (see checker's parseDecl).
  function parseDecl(node) {
    var toks = [node.value].concat(node.children.map(function (c) { return c.value; }));
    var i = 0;
    while (toks[i] === '&' || toks[i] === '&mut') i++;
    i++; // the base type token
    return { type: parseType(toks.slice(0, i)), names: toks.slice(i) };
  }

  var FOLD = { '+': 1, '-': 1, '*': 1, '/': 1, '%': 1,
    '<': 1, '<=': 1, '>': 1, '>=': 1, '==': 1, '!=': 1 };

  function transpile(program) {
    // Tables, gathered first so constructors/calls can be rendered in any order.
    var variants = {}; // V -> enum name
    var structs = {};  // Name -> [field...]
    var fns = {};      // name -> { returns }

    program.items.forEach(function (it) {
      if (it.kind === 'enum') {
        it.bullets.forEach(function (b) { variants[b.value] = it.name; });
      } else if (it.kind === 'struct') {
        var order = [];
        it.bullets.forEach(function (b) { parseDecl(b).names.forEach(function (n) { order.push(n); }); });
        structs[it.name] = order;
      } else if (it.kind === 'fn') {
        var returns = 'Unit';
        it.bullets.forEach(function (b) {
          if (b.value === 'returns') returns = parseType(b.children.map(function (c) { return c.value; }));
        });
        fns[it.name] = { returns: returns };
      }
    });

    // --- Expressions -------------------------------------------------------
    // `ind` is the current indentation, used only by multi-line forms (match).
    function expr(node, ind) {
      var v = node.value, c = node.children;
      if (isLit(v)) return lit(v);
      if (v === '&') return '&' + expr(c[0], ind);
      if (v === '&mut') return '&mut ' + expr(c[0], ind);
      if (FOLD[v]) return c.map(function (x) { return expr(x, ind); }).join(' ' + v + ' ');
      if (v === 'and') return c.map(function (x) { return expr(x, ind); }).join(' && ');
      if (v === 'or') return c.map(function (x) { return expr(x, ind); }).join(' || ');
      if (v === 'not') return '!' + expr(c[0], ind);
      if (v === 'if') {
        var head = 'if ' + expr(c[0], ind) + ' { ' + expr(c[1], ind) + ' }';
        return c[2] ? head + ' else { ' + expr(c[2], ind) + ' }' : head;
      }
      if (v === 'match') return matchExpr(node, ind);
      if (v === '.') return expr(c[0], ind) + '.' + c[1].value;
      if (v === 'vec') return 'vec![' + c.map(function (x) { return expr(x, ind); }).join(', ') + ']';
      if (v === 'push') return expr(c[0], ind) + '.push(' + expr(c[1], ind) + ')';
      if (v === 'print') return 'println!("{:?}", ' + expr(c[0], ind) + ')';
      if (variants[v]) return variants[v] + '::' + v + (c.length ? '(' + expr(c[0], ind) + ')' : '');
      if (structs[v]) {
        var fields = structs[v].map(function (f, i) {
          return f + ': ' + (c[i] ? expr(c[i], ind) : '/* missing */');
        });
        return v + ' { ' + fields.join(', ') + ' }';
      }
      if (fns[v]) return v + '(' + c.map(function (x) { return expr(x, ind); }).join(', ') + ')';
      if (c.length === 0) return v; // identifier
      return v + '(' + c.map(function (x) { return expr(x, ind); }).join(', ') + ')';
    }

    function matchExpr(node, ind) {
      var c = node.children;
      var s = 'match ' + expr(c[0], ind) + ' {\n';
      c.slice(1).forEach(function (arm) {
        var pat = armPattern(arm);
        var hasPayload = arm.value !== '_' && variants[arm.value] && arm.children.length && arm.children[0].children.length === 0;
        var bodyStart = hasPayload ? 1 : 0;
        var body = arm.children.slice(bodyStart);
        var inner = ind + IND;
        if (body.length <= 1) {
          var e = body.length ? expr(body[0], inner) : '()';
          s += inner + pat + ' => ' + e + ',\n';
        } else {
          s += inner + pat + ' => {\n';
          body.forEach(function (b, i) {
            var tail = i === body.length - 1;
            s += inner + IND + expr(b, inner + IND) + (tail ? '\n' : ';\n');
          });
          s += inner + '}\n';
        }
      });
      return s + ind + '}';
    }

    function armPattern(arm) {
      if (arm.value === '_') return '_';
      var en = variants[arm.value];
      var head = (en ? en + '::' : '') + arm.value;
      var binder = arm.children.length && arm.children[0].children.length === 0 ? arm.children[0].value : null;
      return binder ? head + '(' + binder + ')' : head;
    }

    // --- Statements --------------------------------------------------------
    function letStmt(node, ind) {
      var kids = node.children.slice();
      var mut = false;
      if (kids.length && kids[0].value === 'mut') { mut = true; kids = kids.slice(1); }
      var name = kids.length ? kids[0].value : '_';
      kids = kids.slice(1);
      if (kids.length && kids[0].value === '=') kids = kids.slice(1);
      var decl = 'let ' + (mut ? 'mut ' : '') + name;
      return ind + decl + (kids.length ? ' = ' + expr(kids[0], ind) : '') + ';';
    }

    function bodyLines(body, returns) {
      return body.map(function (node, i) {
        var isLast = i === body.length - 1;
        if (node.value === 'let') return letStmt(node, IND);
        if (node.value === 'return') {
          return IND + 'return' + (node.children[0] ? ' ' + expr(node.children[0], IND) : '') + ';';
        }
        // The last body expression is the implicit return when the fn yields a
        // value: emit it as a tail expression (no trailing semicolon).
        var tail = isLast && rustType(returns) !== '()';
        return IND + expr(node, IND) + (tail ? '' : ';');
      });
    }

    // --- Items -------------------------------------------------------------
    function structDecl(it) {
      var lines = ['#[derive(Debug)]', 'struct ' + it.name + ' {'];
      it.bullets.forEach(function (b) {
        var d = parseDecl(b);
        d.names.forEach(function (n) { lines.push(IND + n + ': ' + rustType(d.type) + ','); });
      });
      lines.push('}');
      return lines.join('\n');
    }

    function enumDecl(it) {
      var lines = ['#[derive(Debug)]', 'enum ' + it.name + ' {'];
      it.bullets.forEach(function (b) {
        var payload = b.children.length ? '(' + rustType(parseType(b.children.map(function (c) { return c.value; }))) + ')' : '';
        lines.push(IND + b.value + payload + ',');
      });
      lines.push('}');
      return lines.join('\n');
    }

    function fnDecl(it) {
      var params = [], returns = 'Unit', body = [];
      it.bullets.forEach(function (b) {
        if (b.value === 'params') {
          b.children.forEach(function (p) {
            var d = parseDecl(p);
            d.names.forEach(function (n) { params.push(n + ': ' + rustType(d.type)); });
          });
        } else if (b.value === 'returns') {
          returns = parseType(b.children.map(function (c) { return c.value; }));
        } else {
          body.push(b);
        }
      });
      var ret = rustType(returns) === '()' ? '' : ' -> ' + rustType(returns);
      var sig = 'fn ' + it.name + '(' + params.join(', ') + ')' + ret + ' {';
      var inner = bodyLines(body, returns);
      return [sig].concat(inner, '}').join('\n');
    }

    var chunks = program.items.map(function (it) {
      if (it.kind === 'struct') return structDecl(it);
      if (it.kind === 'enum') return enumDecl(it);
      if (it.kind === 'fn') return fnDecl(it);
      return '// unsupported item: ' + it.kind + (it.name ? ' ' + it.name : '');
    });
    return chunks.join('\n\n') + '\n';
  }

  global.MIAR = global.MIAR || {};
  global.MIAR.transpile = transpile;
})(typeof globalThis !== 'undefined' ? globalThis : this);
