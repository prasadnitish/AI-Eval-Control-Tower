import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  // Dashboard is served from /evals/ on the live site (Cloudflare Worker),
  // so assets must be referenced with that prefix. Override with --base=/
  // for local previews at the root.
  base: '/evals/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
