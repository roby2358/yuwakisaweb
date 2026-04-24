// One-time offline bundle step for the z3-solver JS wrapper.
// Produces vendor/z3-bundle.js — a single ES module that the page imports.
// The WASM binary is NOT bundled here; it is fetched at runtime from R2
// via the locateFile hook configured in index.js.

import { build } from 'esbuild';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const vendorDir = resolve(root, 'vendor');

mkdirSync(vendorDir, { recursive: true });

await build({
  entryPoints: [resolve(here, 'entry.js')],
  bundle: true,
  // IIFE (not ESM) because emscripten pthread workers load this bundle as
  // a classic script via `new Worker(url)`. A module-format bundle with
  // `export` / `import.meta` is a syntax error in that context.
  format: 'iife',
  globalName: 'MiasZ3',
  outfile: resolve(vendorDir, 'z3-bundle.js'),
  platform: 'browser',
  target: 'es2022',
  loader: { '.wasm': 'file' },
  // Node built-ins that emscripten references behind runtime `isNode` guards.
  // They are never reached in-browser, but esbuild won't bundle a browser
  // target with unresolved requires.
  external: ['fs', 'path', 'os', 'crypto', 'worker_threads'],
  logLevel: 'info',
});

// Copy the WASM so it can be uploaded to R2 from a known location.
const wasmSrc = resolve(root, 'node_modules/z3-solver/build/z3-built.wasm');
const wasmDest = resolve(vendorDir, 'z3-built.wasm');
if (existsSync(wasmSrc)) {
  copyFileSync(wasmSrc, wasmDest);
  console.log(`Copied ${wasmSrc} → ${wasmDest}`);
} else {
  console.warn(`WASM not found at ${wasmSrc}; did you run 'npm install'?`);
}

console.log('Bundle complete.');
