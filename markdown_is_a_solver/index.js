// UI controller — wires panes, loads examples, runs the parse → compile → solve pipeline.

import { Z3_WASM_URL } from './config.js';
import { parseProgram } from './parser.js';
import { compile } from './compiler.js';
import { EXAMPLES, DEFAULT_EXAMPLE } from './examples.js';

const jsonEditor = document.getElementById('jsonEditor');
const rulesEditor = document.getElementById('rulesEditor');
const consoleOutput = document.getElementById('consoleOutput');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const z3Status = document.getElementById('z3Status');

// ── Output ─────────────────────────────────────────────────────────────

const clearConsole = () => {
  consoleOutput.innerHTML = '<span class="console-placeholder">Ready to solve…</span>';
};

const appendLine = (text, className) => {
  if (consoleOutput.querySelector('.console-placeholder')) {
    consoleOutput.innerHTML = '';
  }
  const line = document.createElement('div');
  line.className = `log-line ${className}`;
  line.textContent = text;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
};

const appendError = (message) => appendLine(`Error: ${message}`, 'log-line-error');
const appendVerdict = (verdict) => appendLine(verdict, `log-line-verdict-${verdict}`);
const appendJSON = (obj) => appendLine(JSON.stringify(obj, null, 2), 'log-line-binding');

// Unwrap a Z3 model value back to a JS-native primitive using the sort we
// tracked at compile time. Falls back to the Z3 toString() form if an
// extraction method isn't available for this value (shouldn't happen for
// v1 sorts, but keeps rendering honest rather than throwing).
const modelValue = (model, entry) => {
  const v = model.eval(entry.expr, true);
  try {
    if (entry.sort === 'Int')    return Number(v.asString());
    if (entry.sort === 'Real')   return v.asNumber();
    if (entry.sort === 'Bool')   return v.toString() === 'true';
    if (entry.sort === 'String') {
      const s = v.toString();
      return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
    }
  } catch {}
  return v.toString();
};

// Set a dot-qualified path on a nested object, creating intermediate
// objects as needed. `observation.bmi` → `{ observation: { bmi: ... } }`.
const setPath = (obj, path, value) => {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
};

// ── Z3 lifecycle ───────────────────────────────────────────────────────

let z3Context = null;

const setStatus = (text, cls) => {
  z3Status.textContent = text;
  z3Status.className = `z3-status ${cls}`;
};

const initZ3 = async () => {
  setStatus('Loading Z3…', '');
  try {
    if (typeof globalThis.MiasZ3?.init !== 'function') {
      throw new Error("vendor/z3-bundle.js did not load (MiasZ3 global missing)");
    }
    const bundleUrl = new URL('./vendor/z3-bundle.js', document.baseURI).href;
    const { Context } = await globalThis.MiasZ3.init({
      locateFile: (path) => path.endsWith('.wasm') ? Z3_WASM_URL : path,
      // Pthread workers re-load the bundle from this URL; the IIFE re-executes
      // and z3-built.js self-detects pthread mode via self.name.
      mainScriptUrlOrBlob: bundleUrl,
    });
    z3Context = Context('main');
    setStatus('Z3 ready', 'ready');
    runBtn.disabled = false;
  } catch (e) {
    setStatus('Z3 failed to load', 'failed');
    appendError(`Z3 initialization failed: ${e.message}. Check that vendor/z3-bundle.js exists (run scripts/bundle.mjs) and that ${Z3_WASM_URL} is reachable.`);
  }
};

// ── Run ────────────────────────────────────────────────────────────────

const handleRun = async () => {
  clearConsole();
  if (!z3Context) { appendError('Z3 is not ready yet.'); return; }

  let program;
  try {
    program = parseProgram(jsonEditor.value, rulesEditor.value);
  } catch (e) {
    appendError(e.message);
    return;
  }

  let solver, env, labels;
  try {
    ({ solver, env, labels } = compile(program, z3Context));
  } catch (e) {
    appendError(e.message);
    return;
  }

  runBtn.disabled = true;
  setStatus('Solving…', '');
  try {
    const result = await solver.check();
    appendVerdict(result);
    if (result === 'sat') {
      const model = solver.model();
      const out = { sat: true };
      for (const [name, entry] of env) {
        setPath(out, name, modelValue(model, entry));
      }
      appendJSON(out);
    } else if (result === 'unsat') {
      const conflicts = [...solver.unsatCore()]
        .map(lit => labels.get(lit.toString()))
        .join('\n\n');
      const out = { sat: false };
      for (const d of program.declarations) {
        if (d.origin === 'json') setPath(out, d.name, d.value);
      }
      out.conflicts = conflicts;
      appendJSON(out);
    } else {
      appendJSON({ sat: null });
    }
  } catch (e) {
    appendError(`Solver: ${e.message}`);
  } finally {
    runBtn.disabled = false;
    setStatus('Z3 ready', 'ready');
  }
};

// ── Examples ───────────────────────────────────────────────────────────

const loadExample = (name) => {
  const ex = EXAMPLES[name];
  if (!ex) return;
  jsonEditor.value = ex.json;
  rulesEditor.value = ex.rules;
  clearConsole();
};

const handleExampleClick = (e) => {
  e.preventDefault();
  loadExample(e.currentTarget.getAttribute('data-example'));
};

// ── Wiring ─────────────────────────────────────────────────────────────

runBtn.addEventListener('click', handleRun);
clearBtn.addEventListener('click', clearConsole);
document.querySelectorAll('.example-link').forEach(link => {
  link.addEventListener('click', handleExampleClick);
});

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!runBtn.disabled) handleRun();
  }
};
jsonEditor.addEventListener('keydown', handleKeydown);
rulesEditor.addEventListener('keydown', handleKeydown);

loadExample(DEFAULT_EXAMPLE);
initZ3();
