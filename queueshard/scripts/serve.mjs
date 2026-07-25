// Minimal static dev server with COOP + COEP headers so that SharedArrayBuffer
// is available. z3-solver's WASM uses pthreads to run solver.check() without
// blocking the UI thread, and pthreads need SAB → cross-origin isolation.
//
// Production sets these headers via the parent yuwakisaweb/_headers file.
// IntelliJ's built-in preview does not, so use this for local testing.
//
//   node scripts/serve.mjs          # serves the app at http://localhost:8181
//   node scripts/serve.mjs 8123     # custom port

import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, resolve, normalize } from 'path';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..');
const port = Number(process.argv[2] ?? 8181);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cache-Control', 'no-store');

  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const requested = urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath;
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }

  try {
    const info = await stat(filePath);
    const resolved = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const body = await readFile(resolved);
    res.setHeader('Content-Type', MIME[extname(resolved)] ?? 'application/octet-stream');
    res.writeHead(200);
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Dev server: http://localhost:${port}/  (COOP/COEP enabled)`);
});
