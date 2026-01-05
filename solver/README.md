# SMT Solver with LLM Translation

Describe a problem in plain English. An LLM translates it to SMT-LIB, a solver finds a solution, and the LLM translates the answer back.

## Quick Start

1. **Install dependencies**: `npm install`
2. **Copy required files to public** (first time only):
   ```powershell
   copy node_modules\z3-solver\build\z3-built.js public\
   copy node_modules\z3-solver\build\z3-built.wasm public\
   copy node_modules\coi-serviceworker\coi-serviceworker.js public\
   ```
3. **Start dev server**: `npm run dev`
4. **Configure API**: Enter your OpenRouter API key in the app.

## How It Works

1. **Describe your problem** — "I need to schedule 3 meetings, each 1 hour, between 9am and 5pm, with no overlaps"
2. **Translate** — LLM converts to SMT-LIB constraints
3. **Verify** — LLM translates the constraints back so you can confirm it understood correctly
4. **Solve** — Z3 WASM finds a satisfying assignment (or proves none exists)
5. **Read the answer** — LLM translates the raw model back to your problem domain

## Good Problems for This

- Scheduling and resource allocation
- Logic puzzles (Sudoku, Einstein's riddle, etc.)
- Configuration problems (compatibility constraints)
- Simple planning with discrete choices

## Tech Stack

- **Z3 WASM** — Official [z3-solver](https://www.npmjs.com/package/z3-solver) npm package
- **OpenRouter API** — LLM provider (default: Anthropic Claude Haiku 4.5)
- **Vite** — Development server with COOP/COEP headers for SharedArrayBuffer
- **coi-serviceworker** — Enables COOP/COEP headers on static hosts (vendored in `public/`)
- **Vanilla JavaScript** — ES modules, no frameworks
- **Client-side** — Runs entirely in the browser

## Requirements

The Z3 WASM solver requires **SharedArrayBuffer**, which needs these HTTP headers:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

For local development, these are configured in `vite.config.js`. For static hosting (like GitHub Pages), the included `coi-serviceworker.js` handles this automatically.

## Deployment

**For GitHub Pages or any static hosting**:
1. Run `npm run build` to create static files in `dist/`
2. Commit and push — `dist/` is tracked in git and served directly

The bundled service worker (`coi-serviceworker.js`) enables SharedArrayBuffer on hosts that don't support custom headers. On first load, users may see a brief reload as the service worker activates.

## Security Notes

### API Key Handling

⚠️ **This is a client-side application.** Any API key you enter is accessible to JavaScript running on the page.

- API keys are kept in memory only and never persisted to disk
- Keys are cleared when you close or refresh the tab
- Use a dedicated API key with spending limits—never use a production key
- Create a low-limit key at [openrouter.ai/keys](https://openrouter.ai/keys)

If you don't trust a hosted version of this app, run it locally or audit the source code.

### COOP/COEP Headers

This app requires special HTTP headers to enable `SharedArrayBuffer` (needed by Z3's multi-threaded WASM):

| Header | Effect |
|--------|--------|
| `Cross-Origin-Opener-Policy: same-origin` | Isolates the page from cross-origin popups |
| `Cross-Origin-Embedder-Policy: credentialless` | Loads cross-origin resources without credentials |

These headers **improve security** by isolating your browsing context. They don't expose you to additional risk—they're a prerequisite for accessing powerful browser APIs safely.

## Limitations

- Satisfiability only (no optimization in v1)
- LLM translation can misunderstand—always check the verification step
- Complex problems may timeout

## License

MIT
