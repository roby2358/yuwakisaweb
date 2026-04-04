/**
 * MarkdownIsAPrologue — UI Controller
 */

const EXAMPLES = {
  family: `# parent
* tom, bob
* tom, liz
* bob, ann
* bob, pat

# ancestor
* X, Y
  * parent X, Y
* X, Z
  * parent X, Y
  * ancestor Y, Z

# ?
* ancestor tom, Who`,

  lists: `# reverse
* [], []
* [H | T], R
  * reverse T, RevT
  * append RevT, [H], R

# ?
* append [a, b], [c, d], R
* member X, [x, y, z]
* reverse [a, b, c], R
* append X, Y, [a, b, c]`,

  arithmetic: `# factorial
* \`0\`, \`1\`
* N, F
  * > N, \`0\`
  * is N1, -(N, \`1\`)
  * factorial N1, F1
  * is F, *(N, F1)

# fibonacci
* \`0\`, \`0\`
* \`1\`, \`1\`
* N, F
  * > N, \`1\`
  * is N1, -(N, \`1\`)
  * is N2, -(N, \`2\`)
  * fibonacci N1, F1
  * fibonacci N2, F2
  * is F, +(F1, F2)

# ?
* factorial \`7\`, F
* fibonacci \`10\`, F`,

  cut: `# max
* X, Y, X
  * >= X, Y
  * cut
* X, Y, Y

# classify
* N, positive
  * > N, \`0\`
  * cut
* \`0\`, zero
  * cut
* _, negative

# ?
* max \`5\`, \`3\`, M
* classify \`7\`, C
* classify \`0\`, C
* classify \`-3\`, C`,

  negation: `# human
* alice
* bob
* carol

# vegetarian
* bob
* carol

# meat-eater
* X
  * human X
  * not vegetarian X

# safe-pair
* X, Y
  * human X
  * human Y
  * not = X, Y

# ?
* meat-eater Who
* safe-pair X, Y`,

  hanoi: `# hanoi
* \`0\`, _, _, _
* N, From, To, Via
  * > N, \`0\`
  * is N1, -(N, \`1\`)
  * hanoi N1, From, Via, To
  * write From
  * write to
  * write To
  * nl
  * hanoi N1, Via, To, From

# ?
* hanoi \`3\`, left, right, center`
};

const DEFAULT_EXAMPLE = 'family';

const initApp = () => {
  const codeEditor = document.getElementById('codeEditor');
  const consoleOutput = document.getElementById('consoleOutput');
  const runBtn = document.getElementById('runBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exampleSelect = document.getElementById('exampleSelect');
  const traceToggle = document.getElementById('traceToggle');
  const tracePanel = document.getElementById('tracePanel');
  const traceHeader = document.getElementById('traceHeader');
  const traceOutput = document.getElementById('traceOutput');

  codeEditor.value = EXAMPLES[DEFAULT_EXAMPLE];

  // ── Console ────────────────────────────────────────────────

  const clearConsole = () => {
    consoleOutput.innerHTML = '<span class="console-placeholder">Ready to execute...</span>';
  };

  const classifyMessage = (message) => {
    if (message === '') return 'log-line log-line-empty';
    if (message.startsWith('?-')) return 'log-line log-line-query';
    if (message.startsWith('  Error:')) return 'log-line log-line-error';
    if (message.match(/^\s+\d+ solution/)) return 'log-line log-line-summary';
    if (message.startsWith('  ')) return 'log-line log-line-result';
    return 'log-line';
  };

  const appendLog = (message) => {
    if (consoleOutput.querySelector('.console-placeholder')) {
      consoleOutput.innerHTML = '';
    }
    const line = document.createElement('div');
    line.className = classifyMessage(message);
    line.textContent = message;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  };

  // ── Trace ──────────────────────────────────────────────────

  const renderTrace = (traceLines) => {
    if (traceLines.length === 0) {
      traceOutput.textContent = '(no trace events)';
      return;
    }
    traceOutput.textContent = traceLines
      .map(({ depth, text }) => '  '.repeat(depth) + text)
      .join('\n');
  };

  const toggleTraceCollapse = () => {
    tracePanel.classList.toggle('collapsed');
  };

  // ── Run ────────────────────────────────────────────────────

  const handleRun = () => {
    clearConsole();

    const tracing = traceToggle.checked;
    const traceLines = [];
    const traceFn = tracing
      ? (depth, text) => traceLines.push({ depth, text })
      : null;

    runMarkdownIsAPrologue(codeEditor.value, appendLog, traceFn);

    if (tracing) {
      tracePanel.classList.add('visible');
      tracePanel.classList.remove('collapsed');
      renderTrace(traceLines);
    } else {
      tracePanel.classList.remove('visible');
    }
  };

  // ── Examples ───────────────────────────────────────────────

  const loadExample = (name) => {
    if (!EXAMPLES[name]) return;
    codeEditor.value = EXAMPLES[name];
    clearConsole();
    tracePanel.classList.remove('visible');
  };

  const handleExampleChange = () => {
    loadExample(exampleSelect.value);
    exampleSelect.value = '';
  };

  // ── Event binding ───────────────────────────────────────��──

  runBtn.addEventListener('click', handleRun);
  clearBtn.addEventListener('click', clearConsole);
  exampleSelect.addEventListener('change', handleExampleChange);
  traceHeader.addEventListener('click', toggleTraceCollapse);

  document.querySelectorAll('.example-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      loadExample(link.getAttribute('data-example'));
    });
  });

  codeEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
