import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona no GitHub Pages (em /nome-do-repo/), Netlify, Vercel etc.
  base: './',
  build: { chunkSizeWarningLimit: 700 },
});
