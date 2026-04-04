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
  const resetBtn = document.getElementById('resetBtn');
  const clearBtn = document.getElementById('clearBtn');

  codeEditor.value = EXAMPLES[DEFAULT_EXAMPLE];

  const clearConsole = () => {
    consoleOutput.innerHTML = '<span class="console-placeholder">Ready to execute...</span>';
  };

  const appendLog = (message) => {
    if (consoleOutput.querySelector('.console-placeholder')) {
      consoleOutput.innerHTML = '';
    }
    const line = document.createElement('div');

    if (message === '') {
      line.className = 'log-line log-line-empty';
    } else if (message.startsWith('?-')) {
      line.className = 'log-line log-line-query';
      line.textContent = message;
    } else if (message.startsWith('  Error:')) {
      line.className = 'log-line log-line-error';
      line.textContent = message;
    } else if (message.match(/^\s+\d+ solution/)) {
      line.className = 'log-line log-line-summary';
      line.textContent = message;
    } else if (message.startsWith('  ')) {
      line.className = 'log-line log-line-result';
      line.textContent = message;
    } else {
      line.className = 'log-line';
      line.textContent = message;
    }

    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  };

  const handleRun = () => {
    clearConsole();
    runMarkdownIsAPrologue(codeEditor.value, appendLog);
  };

  const handleReset = () => {
    codeEditor.value = EXAMPLES[DEFAULT_EXAMPLE];
    clearConsole();
  };

  const handleExampleClick = (name) => {
    if (EXAMPLES[name]) {
      codeEditor.value = EXAMPLES[name];
      clearConsole();
    }
  };

  runBtn.addEventListener('click', handleRun);
  resetBtn.addEventListener('click', handleReset);
  clearBtn.addEventListener('click', clearConsole);

  document.querySelectorAll('.example-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const name = link.getAttribute('data-example');
      if (name) handleExampleClick(name);
    });
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
