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
    var enums = {};      // Name -> { name, order: [variant...], variants: { V: {name, payload} } }
    var variants = {};   // VariantName -> { enum, payload }  (variant names are global in v1)
    var structs = {};    // Name -> { name, order: [field...], fields: { f: {name, type} } }
    var seen = {};
    var hasMain = false;

    // First pass over enums so variant constructors are known before any fn body
    // (which may construct them) is checked.
    program.items.forEach(function (it) {
      if (it.kind !== 'enum') return;
      var def = { name: it.name, order: [], variants: {} };
      it.bullets.forEach(function (b) {
        var payload = b.children.length ? parseTypeTokens(b.children) : 'Unit';
        def.order.push(b.value);
        def.variants[b.value] = { name: b.value, payload: payload };
        if (variants[b.value]) err('duplicate-item', b.line, 'duplicate variant name `' + b.value + '`');
        variants[b.value] = { enum: it.name, payload: payload };
      });
      enums[it.name] = def;
    });

    // Likewise collect struct definitions so constructors and field types are
    // known before any fn body is checked, and before bindings of struct type
    // are created (mkBinding gives each struct binding per-field sub-state).
    program.items.forEach(function (it) {
      if (it.kind !== 'struct') return;
      var def = { name: it.name, order: [], fields: {} };
      it.bullets.forEach(function (b) {
        if (def.fields[b.value]) err('duplicate-item', b.line, 'duplicate field name `' + b.value + '`');
        def.order.push(b.value);
        def.fields[b.value] = { name: b.value, type: parseTypeTokens(b.children) };
      });
      structs[it.name] = def;
    });

    program.items.forEach(function (it) {
      if (seen[it.name]) err('duplicate-item', it.line, 'duplicate item name `' + it.name + '`');
      seen[it.name] = true;
      if (it.kind === 'enum') return;   // handled above
      if (it.kind === 'struct') return; // handled above
      if (it.kind !== 'fn') {
        err('unsupported', it.line, '`' + it.kind + '` items are deferred in v1 core (only `fn`, `struct`, and `enum` are supported)');
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
      var b = {
        name: name, type: type, mutable: mutable, state: 'owned',
        shared: 0, mutBorrow: false, isLocal: isLocal, declLine: line,
        movedAt: 0, lastBorrowLine: 0
      };
      // A struct binding owns its fields: each gets its own sub-binding so a field
      // can be moved out (partial move) or borrowed disjointly. Field mutability
      // follows the binding (Rust has no per-field `mut`).
      var sd = structs[typeName(type)];
      if (sd) {
        b.fields = {};
        sd.order.forEach(function (f) {
          b.fields[f] = mkBinding(name + '.' + f, sd.fields[f].type, mutable, isLocal, line);
        });
      }
      return b;
    }

    function anyField(b, pred) {
      return !!b.fields && Object.keys(b.fields).some(function (f) { return pred(b.fields[f]); });
    }
    function fieldMutBorrowed(b) { return anyField(b, function (f) { return f.mutBorrow; }); }
    function fieldShared(b)      { return anyField(b, function (f) { return f.shared > 0; }); }
    function fieldMoved(b)       { return anyField(b, function (f) { return f.state === 'moved'; }); }

    // Resolve a "place" — either a whole binding (atom) or a struct field
    // (`. base field`) — to the sub-binding it names. Reports and returns null on
    // an unknown name, a non-struct base, or an unknown field.
    function resolvePlace(node, scope) {
      if (node.value === '.') {
        var base = node.children[0], fld = node.children[1];
        if (!base || !fld) { err('parse', node.line, 'field access needs a base and a field name', bulletText(node)); return null; }
        if (base.value === '.') { err('unsupported', node.line, 'v1 field access is one level deep', bulletText(node)); return null; }
        var bb = lookup(scope, base.value);
        if (!bb) { err('undeclared', node.line, 'use of undeclared name `' + base.value + '`', bulletText(node)); return null; }
        if (!bb.fields) { err('type-mismatch', node.line, '`' + base.value + '` is not a struct; cannot access field `' + fld.value + '`', bulletText(node)); return null; }
        if (!bb.fields[fld.value]) { err('undeclared', node.line, 'struct `' + typeName(bb.type) + '` has no field `' + fld.value + '`', bulletText(node)); return null; }
        return { b: bb.fields[fld.value], parent: bb, label: bb.name + '.' + fld.value };
      }
      var b = lookup(scope, node.value);
      if (!b) { err('undeclared', node.line, 'use of undeclared name `' + node.value + '`', bulletText(node)); return null; }
      return { b: b, parent: null, label: b.name };
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
      if (v === 'match') return checkMatch(node, scope);
      if (v === '.') return checkField(node, scope, moving);
      if (v === 'vec') return nary(node, scope, 'i64', 'Vec');
      if (v === 'push') return checkPush(node, scope);
      if (v === 'print') { if (node.children[0]) checkExpr(node.children[0], scope, false); return 'Unit'; }
      if (variants[v]) return checkVariant(node, scope);
      if (structs[v]) return checkConstruct(node, scope);
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
      if (b.fields) {
        if (fieldMutBorrowed(b)) err('borrow-conflict', node.line, 'cannot use `' + b.name + '` while one of its fields is mutably borrowed', bulletText(node));
        if (moving && fieldMoved(b)) {
          err('use-after-move', node.line, 'cannot move `' + b.name + '`: a field has already been moved out (partial move)', bulletText(node));
          return b.type;
        }
        if (moving && fieldShared(b)) err('borrow-conflict', node.line, 'cannot move `' + b.name + '` while one of its fields is borrowed', bulletText(node));
      }
      if (moving && !isCopy(b.type)) { b.state = 'moved'; b.movedAt = node.line; }
      return b.type;
    }

    // Field read / move-out, e.g. `. p x`. Moving out a move-type field is a
    // partial move: that field becomes Moved, the other fields remain usable, and
    // the struct can no longer be used by value (see useBinding).
    function checkField(node, scope, moving) {
      var place = resolvePlace(node, scope);
      if (!place || !place.parent) return 'Unit';
      var fb = place.b, parent = place.parent;
      if (parent.state === 'moved') err('use-after-move', node.line, 'use of moved value `' + parent.name + '` (moved at line ' + parent.movedAt + ')', bulletText(node));
      if (parent.mutBorrow) err('borrow-conflict', node.line, 'cannot access field `' + place.label + '` while `' + parent.name + '` is mutably borrowed (borrowed at line ' + parent.lastBorrowLine + ')', bulletText(node));
      if (fb.state === 'moved') {
        err('use-after-move', node.line, 'use of moved field `' + place.label + '` (moved at line ' + fb.movedAt + ')', bulletText(node));
        return fb.type;
      }
      if (fb.mutBorrow) err('borrow-conflict', node.line, 'cannot use field `' + place.label + '` while it is mutably borrowed (borrowed at line ' + fb.lastBorrowLine + ')', bulletText(node));
      if (moving && !isCopy(fb.type)) { fb.state = 'moved'; fb.movedAt = node.line; }
      return fb.type;
    }

    // A struct constructor, e.g. `Point `1` `2``. Fields are positional, in
    // declaration order; a move-type field value is moved into the struct.
    function checkConstruct(node, scope) {
      var def = structs[node.value], args = node.children;
      if (args.length !== def.order.length) {
        err('arity', node.line, '`' + node.value + '` expects ' + def.order.length + ' field value(s), got ' + args.length, bulletText(node));
      }
      def.order.forEach(function (f, i) {
        var a = args[i];
        if (!a) return;
        var ft = def.fields[f].type;
        var at = checkExpr(a, scope, !isCopy(ft));
        if (typeName(at) !== typeName(ft)) {
          err('type-mismatch', node.line, 'field `' + f + '` of `' + node.value + '` expects ' + typeName(ft) + ', found ' + typeName(at), bulletText(node));
        }
      });
      return node.value;
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
      var place = resolvePlace(operand, scope);
      if (!place) return 'Unit'; // resolvePlace already reported the error
      var b = place.b, parent = place.parent, label = place.label;
      if (b.state === 'moved') err('use-after-move', node.line, 'borrow of moved value `' + label + '`', bulletText(node));
      if (parent) {
        // Borrowing a field: the struct as a whole must be available.
        if (parent.state === 'moved') err('use-after-move', node.line, 'borrow of field of moved value `' + parent.name + '`', bulletText(node));
        if (parent.mutBorrow) err('borrow-conflict', node.line, 'cannot borrow field `' + label + '` while `' + parent.name + '` is mutably borrowed (borrowed at line ' + parent.lastBorrowLine + ')', bulletText(node));
      } else if (b.fields) {
        // Borrowing the whole struct conflicts with any live field borrow.
        if (fieldMutBorrowed(b) || (node.value === '&mut' && fieldShared(b))) {
          err('borrow-conflict', node.line, 'cannot borrow `' + b.name + '` while one of its fields is borrowed', bulletText(node));
        }
      }
      var isMut = node.value === '&mut';
      if (isMut) {
        if (!b.mutable) err('mutate-immutable', node.line, 'cannot borrow `' + label + '` as mutable: not declared `mut`', bulletText(node));
        if (b.shared > 0 || b.mutBorrow) err('borrow-conflict', node.line, 'cannot mutably borrow `' + label + '` while it is already borrowed (borrowed at line ' + b.lastBorrowLine + ')', bulletText(node));
        b.mutBorrow = true;
        scope.loans.push({ of: b, kind: 'mut', line: node.line });
      } else {
        if (b.mutBorrow) err('borrow-conflict', node.line, 'cannot borrow `' + label + '` as shared while it is mutably borrowed (borrowed at line ' + b.lastBorrowLine + ')', bulletText(node));
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

    // A variant constructor, e.g. `Some `5`` or `None`. Produces its enum type.
    function checkVariant(node, scope) {
      var info = variants[node.value];
      var hasPayload = info.payload !== 'Unit';
      var args = node.children;
      var want = hasPayload ? 1 : 0;
      if (args.length !== want) {
        err('arity', node.line, 'variant `' + node.value + '` expects ' + want + ' payload value(s), got ' + args.length, bulletText(node));
      }
      if (hasPayload && args[0]) {
        var at = checkExpr(args[0], scope, !isCopy(info.payload));
        if (typeName(at) !== typeName(info.payload)) {
          err('type-mismatch', node.line, 'variant `' + node.value + '` payload expects ' + typeName(info.payload) + ', found ' + typeName(at), bulletText(node));
        }
      }
      return info.enum;
    }

    // match scrutinee + arms. children[0] is the scrutinee; the rest are arms.
    // An arm head is a variant name or `_`; a payload variant binds its first
    // child (an atom) and the remaining children are the body, evaluated in order.
    function checkMatch(node, scope) {
      var scrut = node.children[0];
      if (!scrut) { err('parse', node.line, '`match` without a scrutinee', bulletText(node)); return 'Unit'; }
      // Typing the scrutinee by value moves a move-type binding; `& x` borrows it.
      var st = checkExpr(scrut, scope, true);
      var enumName = (st && st.ref) ? typeName(st.to) : typeName(st);
      var def = enums[enumName];
      if (!def) err('type-mismatch', node.line, '`match` scrutinee must be an enum, found ' + enumName, bulletText(scrut));

      var arms = node.children.slice(1);
      if (arms.length === 0) err('parse', node.line, '`match` has no arms', bulletText(node));

      var covered = {}, wildcard = false, resultType = 'Unit', haveResult = false;
      arms.forEach(function (arm) {
        var armScope = newScope(scope);
        var variant = null;
        if (arm.value === '_') {
          wildcard = true;
        } else if (def && !def.variants[arm.value]) {
          err('type-mismatch', arm.line, 'arm `' + arm.value + '` is not a variant of `' + enumName + '`', bulletText(arm));
        } else if (def) {
          if (covered[arm.value]) err('unreachable-arm', arm.line, 'duplicate arm for variant `' + arm.value + '`', bulletText(arm));
          covered[arm.value] = true;
          variant = def.variants[arm.value];
        }
        var bodyStart = bindArm(arm, variant, armScope);
        var bodyType = checkArmBody(arm, bodyStart, armScope);
        if (!haveResult) { resultType = bodyType; haveResult = true; }
        releaseScope(armScope);
      });

      if (def && !wildcard) {
        var missing = def.order.filter(function (vn) { return !covered[vn]; });
        if (missing.length) err('non-exhaustive', node.line, 'non-exhaustive `match` on `' + enumName +
          '`: missing variant(s) ' + missing.map(function (m) { return '`' + m + '`'; }).join(', '), bulletText(node));
      }
      return resultType;
    }

    // Bind a payload variant's single binder (its first child) into the arm scope.
    // Returns the index where the arm body begins; the binder count is known from
    // the variant, so it does not depend on guessing structure.
    function bindArm(arm, variant, armScope) {
      if (!variant || variant.payload === 'Unit') return 0;
      var binder = arm.children[0];
      if (!binder || binder.children.length > 0) {
        err('arity', arm.line, 'variant `' + variant.name + '` binds one payload value', bulletText(arm));
        return 0;
      }
      armScope.bindings[binder.value] = mkBinding(binder.value, variant.payload, false, true, arm.line);
      return 1;
    }

    function checkArmBody(arm, bodyStart, armScope) {
      var t = 'Unit';
      for (var i = bodyStart; i < arm.children.length; i++) t = checkExpr(arm.children[i], armScope, false);
      return t;
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
