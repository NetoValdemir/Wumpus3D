import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona no GitHub Pages (em /nome-do-repo/), Netlify, Vercel etc.
  base: './',
  build: {
    chunkSizeWarningLimit: 900, // o modo escola carrega o Blockly (~800 KB) só na página dele
    // Duas páginas: o jogo completo e o modo escola (D22)
    rollupOptions: { input: { main: 'index.html', escola: 'escola.html' } },
  },
});
