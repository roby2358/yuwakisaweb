// checker.js — the heart of MarkdownIsARust.
//
// Walks the AST and decides, statically, whether the program is safe to run.
// It is a hand-rolled state machine over the tree (no solver; see RUST.md). Each
// binding is Owned or Moved and carries a borrow state (shared count / one mut).
//
// v1 rules enforced:
//   - ownership + move: a move-type value used by-value invalidates its source.
//   - borrowing: aliasing XOR mutability (any number of & OR one &mut).
//   - lexical lifetimes: a borrow is live until the end of the scope that holds
//     the reference; loans are released when that scope exits.
//   - immutability by default: mutating / &mut requires a `mut` binding.
//   - dangling references: returning a reference to a local is rejected.
//
// Returns { diags: [ { cls, line, message, src } ], fns }.

(function (global) {
  'use strict';

  function isLiteralTok(v) {
    return typeof v === 'string' && v.length >= 2 && v[0] === '`' && v[v.length - 1] === '`';
  }
  function litType(v) {
    var inner = v.slice(1, -1);
    if (/^-?\d+$/.test(inner)) return 'i64';
    if (inner === 'true' || inner === 'false') return 'bool';
    return 'String'; // quoted or bare text
  }

  // & T (shared) is Copy; &mut T, String, Vec, user types move.
  function isCopy(t) {
    if (typeof t === 'string') return t === 'i64' || t === 'bool' || t === 'Unit';
    if (t && t.ref) return !t.mut;
    return false;
  }
  function typeName(t) {
    if (typeof t === 'string') return t;
    if (t && t.ref) return (t.mut ? '&mut ' : '& ') + typeName(t.to);
    return String(t);
  }
  function parseTypeTokens(toks) {
    var words = toks.map(function (x) { return typeof x === 'string' ? x : x.value; });
    if (words.length === 0) return 'Unit';
    if (words[0] === '&' || words[0] === '&mut') {
      return { ref: true, mut: words[0] === '&mut', to: parseTypeTokens(words.slice(1)) };
    }
    return words[0];
  }

  function bulletText(node) {
    if (!node) return '';
    var head = node.value;
    var kids = node.children.map(function (c) {
      return c.children.length ? '(' + bulletText(c) + ')' : c.value;
    }).join(' ');
    return kids ? head + ' ' + kids : head;
  }

  function check(program) {
    var diags = [];
    function err(cls, line, message, src) {
      diags.push({ cls: cls, line: line, message: message, src: src || '' });
    }

    var fns = {};
    var seen = {};
    var hasMain = false;

    program.items.forEach(function (it) {
      if (seen[it.name]) err('duplicate-item', it.line, 'duplicate item name `' + it.name + '`');
      seen[it.name] = true;
      if (it.kind !== 'fn') {
        err('unsupported', it.line, '`' + it.kind + '` items are deferred in v1 core (only `fn` is supported)');
        return;
      }
      var params = [], returns = 'Unit', body = [];
      it.bullets.forEach(function (b) {
        if (b.value === 'params') {
          b.children.forEach(function (p) { params.push({ name: p.value, type: parseTypeTokens(p.children) }); });
        } else if (b.value === 'returns') {
          returns = parseTypeTokens(b.children);
        } else {
          body.push(b);
        }
      });
      fns[it.name] = { name: it.name, params: params, returns: returns, body: body, line: it.line };
      if (it.name === 'main') hasMain = true;
    });

    if (!hasMain) err('no-main', 1, 'program has no `# main` entry point');

    Object.keys(fns).forEach(function (name) { checkFn(fns[name]); });

    function newScope(parent) { return { bindings: {}, parent: parent, loans: [] }; }
    function lookup(scope, name) {
      for (var s = scope; s; s = s.parent) {
        if (Object.prototype.hasOwnProperty.call(s.bindings, name)) return s.bindings[name];
      }
      return null;
    }
    function releaseScope(scope) {
      scope.loans.forEach(function (loan) {
        if (loan.kind === 'shared') loan.of.shared = Math.max(0, loan.of.shared - 1);
        else loan.of.mutBorrow = false;
      });
    }

    function checkFn(fn) {
      var root = newScope(null);
      fn.params.forEach(function (p) {
        root.bindings[p.name] = mkBinding(p.name, p.type, false, false, fn.line);
      });
      var lastType = 'Unit', lastNode = null;
      fn.body.forEach(function (stmt) { lastType = checkStmt(stmt, root, fn); lastNode = stmt; });
      // Implicit return: the last body expression is the function's value.
      if (lastNode && lastNode.value !== 'return') checkReturnRef(lastNode, lastType, fn);
      releaseScope(root);
    }

    function mkBinding(name, type, mutable, isLocal, line) {
      return {
        name: name, type: type, mutable: mutable, state: 'owned',
        shared: 0, mutBorrow: false, isLocal: isLocal, declLine: line,
        movedAt: 0, lastBorrowLine: 0
      };
    }

    function checkReturnRef(exprNode, t, fn) {
      if (t && t.ref && t.referent && t.referent.isLocal) {
        err('dangling-reference', exprNode.line,
          'returns a reference to `' + t.referent.name + '`, a local of `' + fn.name +
          '` that is dropped when the function returns', bulletText(exprNode));
      }
    }

    function checkStmt(node, scope, fn) {
      if (node.value === 'let') return checkLet(node, scope);
      if (node.value === 'return') {
        var t = node.children[0] ? checkExpr(node.children[0], scope, true) : 'Unit';
        checkReturnRef(node.children[0] || node, t, fn);
        return t;
      }
      return checkExpr(node, scope, false);
    }

    function checkLet(node, scope) {
      var kids = node.children.slice();
      var mutable = false;
      if (kids.length && kids[0].value === 'mut') { mutable = true; kids = kids.slice(1); }
      if (kids.length === 0) { err('parse', node.line, '`let` without a binding name', bulletText(node)); return 'Unit'; }
      var name = kids[0].value;
      kids = kids.slice(1);
      if (kids.length && kids[0].value === '=') kids = kids.slice(1); // cosmetic separator
      var initType = 'Unit';
      if (kids.length === 1) initType = checkExpr(kids[0], scope, true);
      else if (kids.length > 1) err('parse', node.line,
        '`let` initializer must be a single expression — put the compound on a sub-bullet', bulletText(node));
      var b = mkBinding(name, initType, mutable, true, node.line);
      if (initType && initType.ref) b.referent = initType.referent;
      scope.bindings[name] = b;
      return 'Unit';
    }

    function checkExpr(node, scope, moving) {
      var v = node.value;
      if (isLiteralTok(v)) return litType(v);
      if (v === '&' || v === '&mut') return checkBorrow(node, scope);
      if (v === '+' || v === '-' || v === '*' || v === '/' || v === '%') return nary(node, scope, 'i64', 'i64');
      if (v === '<' || v === '<=' || v === '>' || v === '>=' || v === '==' || v === '!=') return nary(node, scope, 'i64', 'bool');
      if (v === 'and' || v === 'or') return nary(node, scope, 'bool', 'bool');
      if (v === 'not') { if (node.children[0]) expectType(node.children[0], scope, 'bool'); return 'bool'; }
      if (v === 'if') return checkIf(node, scope);
      if (v === 'vec') return nary(node, scope, 'i64', 'Vec');
      if (v === 'push') return checkPush(node, scope);
      if (v === 'print') { if (node.children[0]) checkExpr(node.children[0], scope, false); return 'Unit'; }
      if (fns[v]) return checkCall(node, scope);
      if (node.children.length === 0) return useBinding(node, scope, moving);
      err('undeclared', node.line, 'unknown operator or function `' + v + '`', bulletText(node));
      return 'Unit';
    }

    function useBinding(node, scope, moving) {
      var b = lookup(scope, node.value);
      if (!b) { err('undeclared', node.line, 'use of undeclared name `' + node.value + '`', bulletText(node)); return 'Unit'; }
      if (b.state === 'moved') {
        err('use-after-move', node.line, 'use of moved value `' + b.name + '` (moved at line ' + b.movedAt + ')', bulletText(node));
        return b.type;
      }
      if (b.mutBorrow) err('borrow-conflict', node.line, 'cannot use `' + b.name + '` while it is mutably borrowed (borrowed at line ' + b.lastBorrowLine + ')', bulletText(node));
      if (moving && !isCopy(b.type)) { b.state = 'moved'; b.movedAt = node.line; }
      return b.type;
    }

    // Every operand must be `argType`; the expression as a whole is `resultType`.
    function nary(node, scope, argType, resultType) {
      node.children.forEach(function (c) { expectType(c, scope, argType); });
      return resultType;
    }

    function expectType(node, scope, want) {
      var t = checkExpr(node, scope, false);
      if (typeName(t) !== typeName(want)) {
        err('type-mismatch', node.line, 'expected ' + typeName(want) + ', found ' + typeName(t), bulletText(node));
      }
      return t;
    }

    function checkBorrow(node, scope) {
      var operand = node.children[0];
      if (!operand) { err('parse', node.line, 'borrow without an operand', bulletText(node)); return 'Unit'; }
      var b = lookup(scope, operand.value);
      if (!b) { err('undeclared', node.line, 'borrow of undeclared name `' + operand.value + '`', bulletText(node)); return 'Unit'; }
      if (b.state === 'moved') err('use-after-move', node.line, 'borrow of moved value `' + b.name + '`', bulletText(node));
      var isMut = node.value === '&mut';
      if (isMut) {
        if (!b.mutable) err('mutate-immutable', node.line, 'cannot borrow `' + b.name + '` as mutable: not declared `mut`', bulletText(node));
        if (b.shared > 0 || b.mutBorrow) err('borrow-conflict', node.line, 'cannot mutably borrow `' + b.name + '` while it is already borrowed (borrowed at line ' + b.lastBorrowLine + ')', bulletText(node));
        b.mutBorrow = true;
        scope.loans.push({ of: b, kind: 'mut', line: node.line });
      } else {
        if (b.mutBorrow) err('borrow-conflict', node.line, 'cannot borrow `' + b.name + '` as shared while it is mutably borrowed (borrowed at line ' + b.lastBorrowLine + ')', bulletText(node));
        b.shared++;
        scope.loans.push({ of: b, kind: 'shared', line: node.line });
      }
      b.lastBorrowLine = node.line;
      return { ref: true, mut: isMut, to: b.type, referent: b, borrowLine: node.line };
    }

    function checkPush(node, scope) {
      var target = node.children[0], arg = node.children[1];
      if (!target) { err('parse', node.line, '`push` without a target', bulletText(node)); return 'Unit'; }
      var b = lookup(scope, target.value);
      if (!b) { err('undeclared', node.line, 'push to undeclared name `' + target.value + '`', bulletText(node)); return 'Unit'; }
      if (b.state === 'moved') err('use-after-move', node.line, 'use of moved value `' + b.name + '`', bulletText(node));
      if (typeName(b.type) !== 'Vec') err('type-mismatch', node.line, '`push` target `' + b.name + '` must be a Vec, found ' + typeName(b.type), bulletText(node));
      if (!b.mutable) {
        err('mutate-immutable', node.line, 'cannot mutate `' + b.name + '`: not declared `mut`', bulletText(node));
      } else if (b.shared > 0 || b.mutBorrow) {
        var which = b.shared > 0 ? 'shared' : 'mutably';
        err('borrow-conflict', node.line, 'cannot mutate `' + b.name + '` while it is ' + which + ' borrowed (borrowed at line ' + b.lastBorrowLine + '); the borrow is still live', bulletText(node));
      }
      if (arg) expectType(arg, scope, 'i64');
      return 'Unit';
    }

    function checkIf(node, scope) {
      var cond = node.children[0], cons = node.children[1], alt = node.children[2];
      if (cond) expectType(cond, scope, 'bool');
      var t1 = cons ? checkExpr(cons, scope, false) : 'Unit';
      if (alt) checkExpr(alt, scope, false);
      return t1;
    }

    function checkCall(node, scope) {
      var fn = fns[node.value], args = node.children;
      if (args.length !== fn.params.length) {
        err('arity', node.line, '`' + fn.name + '` expects ' + fn.params.length + ' argument(s), got ' + args.length, bulletText(node));
      }
      fn.params.forEach(function (p, i) {
        var a = args[i];
        if (!a) return;
        var byValueMove = !isCopy(p.type) && !(p.type && p.type.ref);
        var at = checkExpr(a, scope, byValueMove);
        if (typeName(at) !== typeName(p.type)) {
          err('type-mismatch', node.line, 'argument ' + (i + 1) + ' to `' + fn.name + '` expects ' + typeName(p.type) + ', found ' + typeName(at), bulletText(node));
        }
      });
      return fn.returns;
    }

    return { diags: diags, fns: fns };
  }

  global.MIAR = global.MIAR || {};
  global.MIAR.check = check;
  global.MIAR.typeName = typeName;
  global.MIAR.bulletText = bulletText;
})(typeof globalThis !== 'undefined' ? globalThis : this);
