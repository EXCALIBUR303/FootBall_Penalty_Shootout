import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path or a plain file server.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 }, // three.js + Rapier WASM are big by nature
  server: { port: 5173 },
});
