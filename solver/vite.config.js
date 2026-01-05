import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative paths so the build works from any subdirectory
  base: './',
  // COOP/COEP headers required for SharedArrayBuffer (needed by z3-solver)
  // Using credentialless for COEP to allow loading from same origin without CORP headers
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    }
  }
});
