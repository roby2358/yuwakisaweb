// parser.js — Markdown -> AST. Structure only; no semantic analysis.
//
// AST node: { value, children, line }
//   - Atoms have children.length === 0; compounds carry the operator/keyword in
//     `value` and operands in `children`.
//   - A bullet's first token becomes `value`; remaining same-line tokens become
//     flat (atom) children; indented sub-bullets become additional children.
//   - Nesting is by sub-bullets (2 spaces = 1 level). Backtick-wrapped tokens are
//     literals; bare tokens are symbols / operator names.
//
// Program: { items: [ { kind, name, line, bullets: [node...] } ] }
// kind is one of fn|struct|enum|impl. A bare `# name` heading is treated as `fn`.

(function (global) {
  'use strict';

  // Split bullet content into tokens. Whitespace separates, except a backtick
  // span (`...`) is a single token even if it contains spaces.
  function tokenize(s) {
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '`') {
        var j = i + 1;
        while (j < s.length && s[j] !== '`') j++;
        tokens.push(s.slice(i, j + 1)); // include both backticks
        i = j + 1;
      } else {
        var k = i;
        while (k < s.length && s[k] !== ' ' && s[k] !== '\t' && s[k] !== '`') k++;
        tokens.push(s.slice(i, k));
        i = k;
      }
    }
    return tokens;
  }

  function node(value, children, line) {
    return { value: value, children: children || [], line: line || 0 };
  }

  function headingWords(line) {
    return line.replace(/^#+/, '').trim().split(/\s+/).filter(Boolean);
  }

  function parse(src) {
    var lines = src.split('\n');
    var items = [];
    var current = null;
    var stack = []; // [{ level, node }] for bullet nesting within the current item

    for (var li = 0; li < lines.length; li++) {
      var raw = lines[li];
      var lineNo = li + 1;
      if (/^\s*$/.test(raw)) continue;

      // Heading (column 0) opens a new item.
      if (/^#/.test(raw)) {
        var words = headingWords(raw);
        var kws = { fn: 1, struct: 1, enum: 1, impl: 1 };
        var kind, name;
        if (words.length && kws[words[0]]) { kind = words[0]; name = words[1]; }
        else { kind = 'fn'; name = words[0]; }
        current = { kind: kind, name: name, line: lineNo, bullets: [] };
        items.push(current);
        stack = [];
        continue;
      }

      // Bullet line.
      var m = raw.match(/^(\s*)([*-])\s+(.*)$/);
      if (!m) continue; // prose / unsupported line — ignored in v1

      var indent = m[1].replace(/\t/g, '  ').length;
      var level = Math.floor(indent / 2);
      var toks = tokenize(m[3]);
      if (toks.length === 0) continue;

      var kids = toks.slice(1).map(function (t) { return node(t, [], lineNo); });
      var n = node(toks[0], kids, lineNo);

      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      if (stack.length === 0) {
        if (current) current.bullets.push(n);
      } else {
        stack[stack.length - 1].node.children.push(n);
      }
      stack.push({ level: level, node: n });
    }

    return { items: items };
  }

  global.MIAR = global.MIAR || {};
  global.MIAR.parse = parse;
  global.MIAR.node = node;
})(typeof globalThis !== 'undefined' ? globalThis : this);
