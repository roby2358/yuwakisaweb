// index.js — UI controller. Parse -> check -> (only if clean) run.

(function () {
  'use strict';
  var MIAR = window.MIAR;

  var editor = document.getElementById('editor');
  var examplesNav = document.getElementById('examples');
  var runBtn = document.getElementById('run');
  var clearBtn = document.getElementById('clear');
  var results = document.getElementById('results');
  var astPanel = document.getElementById('ast');

  function astText(program) {
    return program.items.map(function (it) {
      var head = '# ' + it.kind + (it.name ? ' ' + it.name : '');
      var body = it.bullets.map(function (b) { return nodeText(b, 0); }).join('\n');
      return body ? head + '\n' + body : head;
    }).join('\n\n');
  }
  // Compact rendering: leading atom children ride on the head's line; the first
  // child that has children of its own breaks out to a sub-bullet (the mirror of
  // how the parser reads compact source — see parser.js).
  function nodeText(node, depth) {
    var pad = new Array(depth + 1).join('  ');
    var inline = [];
    var i = 0;
    for (; i < node.children.length; i++) {
      if (node.children[i].children.length > 0) break;
      inline.push(node.children[i].value);
    }
    var line = pad + '* ' + node.value + (inline.length ? ' ' + inline.join(' ') : '');
    var rest = node.children.slice(i).map(function (c) { return nodeText(c, depth + 1); });
    return [line].concat(rest).join('\n');
  }

  function render(html, cls) {
    results.className = 'pane-body ' + (cls || '');
    results.innerHTML = html;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function runProgram() {
    var src = editor.value;
    var program;
    try {
      program = MIAR.parse(src);
    } catch (e) {
      render('<div class="status err">Parse error</div><pre>' + esc(e.message) + '</pre>', 'rejected');
      astPanel.textContent = '';
      return;
    }
    astPanel.textContent = astText(program);

    var checked = MIAR.check(program);
    if (checked.diags.length) {
      var items = checked.diags.map(function (d) {
        var loc = d.line ? ' <span class="loc">(line ' + d.line + ')</span>' : '';
        var src2 = d.src ? '<div class="src">' + esc(d.src) + '</div>' : '';
        return '<li><span class="cls">' + esc(d.cls) + '</span>' + loc +
          '<div class="msg">' + esc(d.message) + '</div>' + src2 + '</li>';
      }).join('');
      render('<div class="status err">REJECTED — ' + checked.diags.length +
        ' diagnostic' + (checked.diags.length === 1 ? '' : 's') +
        '. The program was not run.</div><ul class="diags">' + items + '</ul>', 'rejected');
      return;
    }

    var lines = [];
    try {
      MIAR.run(program, function (s) { lines.push(s); });
    } catch (e) {
      render('<div class="status err">Runtime error</div><pre>' + esc(e.message) + '</pre>', 'rejected');
      return;
    }
    var out = lines.length ? '<pre>' + esc(lines.join('\n')) + '</pre>'
      : '<pre class="muted">(no output)</pre>';
    render('<div class="status ok">ACCEPTED — checked and run.</div>' + out, 'accepted');
  }

  function loadExample(ex) {
    editor.value = ex.code;
    render('<div class="muted">Loaded <strong>' + esc(ex.name) + '</strong>. ' +
      esc(ex.note) + '<br>Press Run (or Ctrl/Cmd+Enter).</div>', '');
    astPanel.textContent = '';
  }

  MIAR.EXAMPLES.forEach(function (ex, i) {
    var b = document.createElement('button');
    b.textContent = ex.name;
    b.className = 'ex';
    b.addEventListener('click', function () { loadExample(ex); });
    examplesNav.appendChild(b);
    if (i === 0) loadExample(ex);
  });

  runBtn.addEventListener('click', runProgram);
  clearBtn.addEventListener('click', function () {
    render('<div class="muted">Cleared.</div>', '');
    astPanel.textContent = '';
  });
  editor.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runProgram(); }
  });
})();
