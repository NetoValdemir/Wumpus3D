// Converte um HTML em PDF A4 com rodapé numerado. Uso: node pdf.cjs entrada.html saida.pdf "Título do rodapé"
const { chromium } = require('playwright');
(async () => {
  const [src, out, title = 'Wumpus 3D — Documentação técnica'] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + src, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({
    path: out, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#8a7a66;padding:0 17mm;display:flex;justify-content:space-between"><span>' + title + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  await b.close();
})();
