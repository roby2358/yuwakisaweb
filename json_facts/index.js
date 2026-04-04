/**
 * JSON Facts — UI Controller
 *
 * Left pane:  JSON facts (parsed into Prolog database entries)
 * Middle pane: Prolog rules & queries (Markdown syntax)
 * Right pane: Query results
 */

const EXAMPLES = {
  family: {
    json: `{
  "parent": [
    ["tom", "bob"],
    ["tom", "liz"],
    ["bob", "ann"],
    ["bob", "pat"]
  ],
  "male": ["tom", "bob"],
  "female": ["liz", "ann", "pat"]
}`,
    rules: `# ancestor
* X, Y
  * parent X, Y
* X, Z
  * parent X, Y
  * ancestor Y, Z

# ?
* ancestor tom, Who
* ancestor X, ann`
  },

  employees: {
    json: `{
  "employee": [
    ["alice", "engineering", 95000],
    ["bob", "engineering", 88000],
    ["carol", "sales", 72000],
    ["dave", "sales", 68000],
    ["eve", "engineering", 102000]
  ],
  "manager": [
    ["alice", "bob"],
    ["alice", "eve"],
    ["carol", "dave"]
  ]
}`,
    rules: `# high-earner
* Name, Dept
  * employee Name, Dept, Salary
  * >= Salary, \`90000\`

# team-member
* Manager, Employee
  * manager Manager, Employee
* Manager, Employee
  * manager Manager, Mid
  * team-member Mid, Employee

# ?
* high-earner Who, Dept
* team-member alice, Who`
  },

  graph: {
    json: `{
  "edge": [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["a", "d"],
    ["b", "d"]
  ]
}`,
    rules: `# connected
* X, Y
  * edge X, Y
* X, Y
  * edge Y, X

# path
* X, Y, [X, Y]
  * connected X, Y
* X, Z, [X | Rest]
  * connected X, Y
  * path Y, Z, Rest

# ?
* connected a, Who
* path a, d, Route`
  },

  inventory: {
    json: `{
  "item": [
    ["widget", 4.99, 150],
    ["gadget", 12.50, 42],
    ["doohickey", 2.25, 300],
    ["thingamajig", 8.75, 0],
    ["whatchamacallit", 15.00, 17]
  ]
}`,
    rules: `# in-stock
* Name, Price
  * item Name, Price, Qty
  * > Qty, \`0\`

# affordable
* Name, Price
  * in-stock Name, Price
  * =< Price, \`5\`

# out-of-stock
* Name
  * item Name, _, \`0\`

# ?
* affordable Name, Price
* out-of-stock Name`
  },

  social: {
    json: `{
  "follows": [
    ["alice", "bob"],
    ["bob", "carol"],
    ["carol", "alice"],
    ["dave", "alice"],
    ["dave", "carol"]
  ]
}`,
    rules: `# mutual
* X, Y
  * follows X, Y
  * follows Y, X

# influencer
* X
  * follows A, X
  * follows B, X
  * not = A, B

# ?
* mutual X, Y
* influencer Who`
  }
};

const DEFAULT_EXAMPLE = 'family';

const initApp = () => {
  const jsonEditor = document.getElementById('jsonEditor');
  const rulesEditor = document.getElementById('rulesEditor');
  const consoleOutput = document.getElementById('consoleOutput');
  const runBtn = document.getElementById('runBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exampleSelect = document.getElementById('exampleSelect');
  const traceToggle = document.getElementById('traceToggle');
  const tracePanel = document.getElementById('tracePanel');
  const traceHeader = document.getElementById('traceHeader');
  const traceOutput = document.getElementById('traceOutput');

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

    // Parse JSON facts
    let jsonEntries;
    try {
      jsonEntries = parseJSONFacts(jsonEditor.value);
    } catch (e) {
      appendLog(`  Error: Invalid JSON — ${e.message}`);
      return;
    }

    // Parse Markdown rules + queries (with stdlib)
    const markdownEntries = parseMarkdown(STDLIB + '\n' + rulesEditor.value);

    // Merge: JSON facts first, then Markdown rules/queries
    const allEntries = [...jsonEntries, ...markdownEntries];
    const { db, queries } = buildDatabase(allEntries);
    const builtins = makeBuiltins(appendLog);
    const solve = makeSolver(db, builtins, 10000, traceFn);

    if (queries.length === 0) {
      appendLog('No queries found. Add a # ? section with goals.');
      return;
    }

    queries.forEach(q => executeQuery(q, solve, appendLog));

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
    const example = EXAMPLES[name];
    if (!example) return;
    jsonEditor.value = example.json;
    rulesEditor.value = example.rules;
    clearConsole();
    tracePanel.classList.remove('visible');
  };

  const handleExampleChange = () => {
    loadExample(exampleSelect.value);
    exampleSelect.value = '';
  };

  // ── Event binding ──────────────────────────────────────────

  runBtn.addEventListener('click', handleRun);
  clearBtn.addEventListener('click', clearConsole);
  exampleSelect.addEventListener('change', handleExampleChange);
  traceHeader.addEventListener('click', toggleTraceCollapse);

  const handleExampleClick = (e) => {
    e.preventDefault();
    loadExample(e.currentTarget.getAttribute('data-example'));
  };

  document.querySelectorAll('.example-link').forEach(link => {
    link.addEventListener('click', handleExampleClick);
  });

  const handleKeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  jsonEditor.addEventListener('keydown', handleKeydown);
  rulesEditor.addEventListener('keydown', handleKeydown);

  // Load default
  loadExample(DEFAULT_EXAMPLE);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
