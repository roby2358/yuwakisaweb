/**
 * ------------------------------------------------------------------
 * UI CONTROLLER
 * ------------------------------------------------------------------
 */

const EXAMPLE_CODES = {
  factorial: `# factorial
* n
* if
  * <=
    * n
    * \`1\`
  * \`1\`
  * *
    * n
    * factorial
      * -
        * n
        * \`1\`

# main
* print
  * \`"Result of 5! is:"\`
  * factorial
    * \`5\``,
  
  fibonacci: `# fibonacci
* n
* if
  * <=
    * n
    * \`1\`
  * n
  * +
    * fibonacci
      * -
        * n
        * \`1\`
    * fibonacci
      * -
        * n
        * \`2\`

# main
* print
  * \`"fibonacci(10) ="\`
  * fibonacci
    * \`10\``,
  
  'fizzbuzz-n': `# fizzbuzz-helper
* current
* max
* if
  * >
    * current
    * max
  * \`""\`
  * +
    * +
      * if
        * and
          * eq
            * %
              * current
              * \`3\`
            * \`0\`
          * eq
            * %
              * current
              * \`5\`
            * \`0\`
        * \`"fizzbuzz "\`
        * if
          * eq
            * %
              * current
              * \`3\`
            * \`0\`
          * \`"fizz "\`
          * if
            * eq
              * %
                * current
                * \`5\`
              * \`0\`
            * \`"buzz "\`
            * +
              * +
                * current
                * \`""\`
              * \`" "\`
      * fizzbuzz-helper
        * +
          * current
          * \`1\`
        * max

# fizzbuzz
* n
* fizzbuzz-helper
  * \`1\`
  * n

# main
* print
  * fizzbuzz
    * \`15\``,
  
  'fizzbuzz-newlines': `# divisible-by-3
* n
* eq
  * %
    * n
    * \`3\`
  * \`0\`

# divisible-by-5
* n
* eq
  * %
    * n
    * \`5\`
  * \`0\`

# fizzbuzz-value
* n
* if
  * and
    * divisible-by-3
      * n
    * divisible-by-5
      * n
  * \`"fizzbuzz "\`
  * if
    * divisible-by-3
      * n
    * \`"fizz "\`
    * if
      * divisible-by-5
        * n
      * \`"buzz "\`
      * +
        * +
          * n
          * \`""\`
        * \`" "\`

# fizzbuzz-helper
* *
  * current
  * max
* if
  * >
    * current
    * max
  * \`""\`
  * +
    * fizzbuzz-value
      * current
    * fizzbuzz-helper
      * +
        * current
        * \`1\`
      * max

# fizzbuzz
* n
* fizzbuzz-helper
  * \`1\`
  * n

# main
* print
  * fizzbuzz
    * \`15\``,
  
  gcd: `# gcd
* *
  * a
  * b
* if
  * eq
    * b
    * \`0\`
  * a
  * gcd
    * b
    * %
      * a
      * b

# main
* print
  * \`"gcd(48, 18) ="\`
  * gcd
    * \`48\`
    * \`18\``
};

const DEFAULT_CODE = EXAMPLE_CODES.factorial;

const initApp = () => {
  const codeEditor = document.getElementById('codeEditor');
  const consoleOutput = document.getElementById('consoleOutput');
  const astOutput = document.getElementById('astOutput');
  const runBtn = document.getElementById('runBtn');
  const resetBtn = document.getElementById('resetBtn');
  const clearBtn = document.getElementById('clearBtn');

  codeEditor.value = DEFAULT_CODE;

  const clearConsole = () => {
    consoleOutput.innerHTML = '<span class="console-placeholder">Ready to execute...</span>';
  };

  const clearAST = () => {
    astOutput.querySelector('pre').textContent = '// AST will appear here after run';
  };

  const appendLog = (message) => {
    if (consoleOutput.querySelector('.console-placeholder')) {
      consoleOutput.innerHTML = '';
    }
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    logLine.textContent = message;
    consoleOutput.appendChild(logLine);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  };

  const updateAST = (ast) => {
    if (!ast) {
      clearAST();
      return;
    }
    const astJson = JSON.stringify(ast, (key, value) => {
      if (key === 'indent') return undefined;
      return value;
    }, 2);
    astOutput.querySelector('pre').textContent = astJson;
  };

  const handleRun = () => {
    clearConsole();
    const code = codeEditor.value;
    const ast = runMarkdownIsALISP(code, appendLog);
    updateAST(ast);
  };

  const handleReset = () => {
    codeEditor.value = DEFAULT_CODE;
    clearConsole();
    updateAST(null);
  };

  const handleExampleClick = (exampleName) => {
    if (EXAMPLE_CODES[exampleName]) {
      codeEditor.value = EXAMPLE_CODES[exampleName];
      clearConsole();
      clearAST();
    }
  };

  runBtn.addEventListener('click', handleRun);
  resetBtn.addEventListener('click', handleReset);
  clearBtn.addEventListener('click', clearConsole);

  const exampleLinks = document.querySelectorAll('.example-link');
  exampleLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const exampleName = link.getAttribute('data-example');
      if (exampleName) {
        handleExampleClick(exampleName);
      }
    });
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

