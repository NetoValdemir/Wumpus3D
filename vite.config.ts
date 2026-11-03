import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona no GitHub Pages (em /nome-do-repo/), Netlify, Vercel etc.
  base: './',
  build: {
    chunkSizeWarningLimit: 900, // o modo escola carrega o Blockly (~800 KB) só na página dele
    // Páginas: o jogo completo e o modo escola (tela inicial, área do aluno e área do professor; D22, D23)
    rollupOptions: { input: { main: 'index.html', escola: 'escola.html', aluno: 'aluno.html', professor: 'professor.html' } },
  },
});
