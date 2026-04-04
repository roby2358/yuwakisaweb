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

  mortal: `# human
* socrates
* plato
* aristotle

# mortal
* X
  * human X

# ?
* mortal Who
* mortal socrates`,

  likes: `# likes
* mary, food
* mary, wine
* mary, john
* john, wine
* john, mary

# mutual
* X, Y
  * likes X, Y
  * likes Y, X

# ?
* likes mary, What
* mutual X, Y`,

  path: `# edge
* a, b
* b, c
* c, d
* a, d

# path
* X, Y
  * edge X, Y
* X, Z
  * edge X, Y
  * path Y, Z

# ?
* path a, d
* path a, Where`,

  write: `# greet
* Name
  * write Name
  * nl

# human
* alice
* bob

# greet-all
* X
  * human X
  * greet X

# ?
* greet-all Who`
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
    const code = codeEditor.value;
    runMarkdownIsAPrologue(code, appendLog);
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

  const exampleLinks = document.querySelectorAll('.example-link');
  exampleLinks.forEach(link => {
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
