// index.js — UI controller. Parse -> check -> (only if clean) run.

(function () {
  'use strict';
  var MIAR = window.MIAR;

  var editor = document.getElementById('editor');
  var examplesNav = document.getElementById('examples');
  var runBtn = document.getElementById('run');
  var clearBtn = document.getElementById('clear');
  var results = document.getElementById('results');
  var rustPanel = document.getElementById('rust');

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
      rustPanel.textContent = '';
      return;
    }
    // Transpilation is purely syntactic, so it runs whether or not the checker
    // accepts: a rejected program shows the Rust that `rustc` would reject too.
    try {
      rustPanel.textContent = MIAR.transpile(program);
    } catch (e) {
      rustPanel.textContent = '// transpile error: ' + e.message;
    }

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
    rustPanel.textContent = '';
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
    rustPanel.textContent = '';
  });
  editor.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runProgram(); }
  });
})();
